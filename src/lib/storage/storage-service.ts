import { prisma } from "@/lib/db";
import { MinioProvider } from "@/lib/storage/minio-provider";
import { AppError } from "@/lib/errors";

const allowedBuckets = [
  "question-bank-attachments",
  "signed-reports",
  "generated-papers",
  "exports",
  "audit-files",
] as const;

export class StorageService {
  private readonly provider = new MinioProvider();

  async createUploadLink(input: {
    bucket: (typeof allowedBuckets)[number];
    fileName: string;
    mimeType: string;
    size: number;
    uploadedById?: string | null;
    linkedEntityType?: string;
    linkedEntityId?: string;
  }) {
    if (!allowedBuckets.includes(input.bucket)) {
      throw new AppError("Invalid storage bucket", 400);
    }

    const objectKey = `${Date.now()}-${input.fileName.replace(/\s+/g, "-")}`;
    const url = await this.provider.createPresignedPutUrl(input.bucket, objectKey, input.mimeType);

    const asset = await prisma.fileAsset.create({
      data: {
        bucket: input.bucket,
        objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        uploadedById: input.uploadedById ?? null,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
      },
    });

    return { uploadUrl: url, asset };
  }

  async createDownloadLink(fileAssetId: string) {
    const asset = await prisma.fileAsset.findUnique({ where: { id: fileAssetId } });
    if (!asset) {
      throw new AppError("File asset not found", 404);
    }

    return {
      downloadUrl: await this.provider.createPresignedGetUrl(asset.bucket, asset.objectKey),
      asset,
    };
  }
}
