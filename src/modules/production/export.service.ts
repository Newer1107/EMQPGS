import {
  ExportArtifactStatus,
  ExportFormat,
  Role,
  type Prisma,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { StorageService } from "@/lib/storage/storage-service";
import { DocumentService } from "@/modules/production/document-service";
import { ENTITY_TYPES } from "@/lib/constants";

type Actor = Pick<User, "id" | "role" | "email" | "name" | "departmentId">;

type ExportInput = {
  questionBankId: string;
  format: ExportFormat;
  examDate: string;
  duration: string;
  maximumMarks: number;
  instructions: string[];
  institutionName?: string;
};

export type CoeOverviewItem = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: { include: { academicYear: true, semester: true } };
    aiReports: { orderBy: { createdAt: "desc" }; take: 1; include: { pdfFileAsset: true; jsonFileAsset: true } };
    generatedPapers: { orderBy: { variant: "asc" }; include: { paperFileAsset: true } };
    deanReview: {
      include: {
        reviewedBy: true;
      };
    };
    exportArtifacts: { orderBy: { createdAt: "desc" }; include: { fileAsset: true }; take: 5 };
  };
}>;

export class ExportService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly documentService = new DocumentService(),
  ) {}

  async listCoeOverview(): Promise<CoeOverviewItem[]> {
    return prisma.questionBank.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        subject: true,
  examCycle: { include: { academicYear: true, semester: true } },
        aiReports: { orderBy: { createdAt: "desc" }, take: 1, include: { pdfFileAsset: true, jsonFileAsset: true } },
        generatedPapers: { orderBy: { variant: "asc" }, include: { paperFileAsset: true } },
        deanReview: {
          include: {
            reviewedBy: true,
          },
        },
        exportArtifacts: { orderBy: { createdAt: "desc" }, include: { fileAsset: true }, take: 5 },
      },
    });
  }

  async listExportArtifacts(questionBankId?: string) {
    return prisma.exportArtifact.findMany({
      where: questionBankId ? { questionBankId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        fileAsset: true,
        questionBank: { include: { subject: true, examCycle: true } },
      },
    });
  }

  async createExport(input: ExportInput, actor: Actor) {
    if (actor.role !== Role.COE) throw new ForbiddenError("Only COE can create exports");
    const questionBank = await prisma.questionBank.findUnique({
      where: { id: input.questionBankId },
      include: exportQuestionBankInclude,
    });
    if (!questionBank) throw new NotFoundError("Question bank not found");
    if (!questionBank.deanReview) throw new AppError("Dean selections are required before export", 409);

    const artifact = await prisma.exportArtifact.create({
      data: {
        questionBankId: questionBank.id,
        generatedById: actor.id,
        format: input.format,
        status: ExportArtifactStatus.PENDING,
        metadata: {
          examDate: input.examDate,
          duration: input.duration,
          maximumMarks: input.maximumMarks,
          instructions: input.instructions,
          institutionName: input.institutionName ?? env.INSTITUTION_NAME,
        } as Prisma.InputJsonValue,
        expiresAt: addDays(env.EXPORT_RETENTION_DAYS),
      },
    });

    try {
      const selectedPapers = buildSelectedPapers(questionBank, input);
      let buffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (input.format === ExportFormat.PDF) {
        buffer = Buffer.from(await this.documentService.createCombinedPdf(selectedPapers));
        fileName = `${questionBank.subject.subjectCode}-final-papers.pdf`;
        mimeType = "application/pdf";
      } else if (input.format === ExportFormat.DOCX) {
        buffer = await this.documentService.createCombinedDocx(selectedPapers);
        fileName = `${questionBank.subject.subjectCode}-final-papers.docx`;
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else {
        const pdfBuffer = Buffer.from(await this.documentService.createCombinedPdf(selectedPapers));
        const docxBuffer = await this.documentService.createCombinedDocx(selectedPapers);
        const manifest = Buffer.from(
          JSON.stringify(
            {
              subject: questionBank.subject.subjectCode,
              papers: selectedPapers.map((paper) => paper.label),
              generatedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
          "utf8",
        );
        buffer = await this.documentService.createZipBundle([
          { fileName: `${questionBank.subject.subjectCode}-final-papers.pdf`, content: pdfBuffer },
          { fileName: `${questionBank.subject.subjectCode}-final-papers.docx`, content: docxBuffer },
          { fileName: "manifest.json", content: manifest },
        ]);
        fileName = `${questionBank.subject.subjectCode}-final-papers.zip`;
        mimeType = "application/zip";
      }

      const asset = await this.storageService.uploadServerFile({
        bucket: "exports",
        fileName,
        mimeType,
        body: buffer,
        size: buffer.byteLength,
        uploadedById: actor.id,
        linkedEntityType: ENTITY_TYPES.EXPORT_ARTIFACT,
        linkedEntityId: artifact.id,
      });

      return prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: {
          status: ExportArtifactStatus.COMPLETED,
          fileAssetId: asset.id,
        },
        include: { fileAsset: true },
      });
    } catch (error) {
      await prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: {
          status: ExportArtifactStatus.FAILED,
          metadata: {
            ...(artifact.metadata as object | null ?? {}),
            failure: error instanceof Error ? error.message : "Unknown export error",
          } as Prisma.InputJsonValue,
        },
      });
      throw error;
    }
  }

  async createExportDownloadLink(exportArtifactId: string, actor: Actor) {
    if (actor.role !== Role.COE) throw new ForbiddenError("Only COE can download export artifacts");
    const artifact = await prisma.exportArtifact.findUnique({
      where: { id: exportArtifactId },
      include: { fileAsset: true },
    });
    if (!artifact || !artifact.fileAsset) throw new NotFoundError("Export artifact not found");
    return this.storageService.createDownloadLinkForAsset(artifact.fileAsset);
  }
}

const exportQuestionBankInclude = {
  subject: true,
  examCycle: true,
  generatedPapers: {
    include: {
      items: {
        include: { question: true },
      },
    },
  },
  deanReview: {
    include: { reviewedBy: true },
  },
} satisfies Prisma.QuestionBankInclude;

function buildSelectedPapers(
  questionBank: Prisma.QuestionBankGetPayload<{ include: typeof exportQuestionBankInclude }>,
  input: ExportInput,
) {
  const institutionName = input.institutionName ?? env.INSTITUTION_NAME;
  const deanReview = questionBank.deanReview;
  if (!deanReview) throw new AppError("Dean review not found", 409);

  const papersByVariant = new Map(questionBank.generatedPapers.map((paper) => [paper.variant, paper]));
  const regularPaper = papersByVariant.get(deanReview.regularPaper);
  const supplementaryPaper = papersByVariant.get(deanReview.supplementaryPaper);
  const ktPaper = papersByVariant.get(deanReview.ktPaper);

  if (!regularPaper || !supplementaryPaper || !ktPaper) {
    throw new AppError("Dean review references unavailable generated papers", 409);
  }

  return [
    { label: "Regular Exam Paper", paper: regularPaper },
    { label: "Supplementary Paper", paper: supplementaryPaper },
    { label: "KT Paper", paper: ktPaper },
  ].map(({ label, paper }) => ({
    label,
    subjectName: questionBank.subject.subjectName,
    subjectCode: questionBank.subject.subjectCode,
    examType: questionBank.examCycle.examType,
    examDate: input.examDate,
    duration: input.duration,
    maximumMarks: input.maximumMarks,
    institutionName,
    instructions: input.instructions,
    questions: paper.items.map((item) => ({
      moduleNumber: item.question.moduleNumber,
      marks: item.question.marks,
      questionText: item.question.questionText,
      coMapping: item.question.coMapping,
      rbtLevel: item.question.rbtLevel,
    })),
  }));
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
