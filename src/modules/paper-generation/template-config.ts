import { convertInchesToTwip, convertMillimetersToTwip } from "docx";

export const TemplateConfig = {
  font: "Times New Roman",

  page: {
    width: convertMillimetersToTwip(210),
    margins: {
      top: convertInchesToTwip(0.8),
      bottom: convertInchesToTwip(0.8),
      left: convertInchesToTwip(1),
      right: convertInchesToTwip(1),
    },
  },

  usableWidth: convertMillimetersToTwip(210) - convertInchesToTwip(1) - convertInchesToTwip(1),

  fontSize: {
    examTitle: 16,
    subjectLine: 13,
    metadata: 10,
    instruction: 10,
    questionLabel: 11,
    questionText: 11,
    marks: 10,
    co: 10,
    bloom: 10,
    orText: 11,
    sectionHeading: 12,
  },

  spacing: {
    afterTitle: 160,
    afterSubject: 120,
    afterSection: 200,
    afterInstruction: 60,
    afterInstructionBlock: 120,
    afterParagraph: 40,
  },

  table: {
    columnWidths: {
      qno: 700,
      marks: 650,
      co: 750,
      bloom: 750,
    },
    headerRow: true,
    borderSize: 1,
  },

  header: {
    aspectRatio: 960 / 137,
    relativePath: "src/modules/paper-generation/assets/tcet-header.png",
    fallbackExtensions: [".webp", ".jpg", ".jpeg"],
  },

  metadata: {
    left: ["Branch", "Div", "Duration"],
    right: ["Date", "Timing", "Maximum Marks"],
  },

  sectionLabels: ["a", "b", "c", "d", "e", "f", "g", "h"],

  questionLabel: (n: number) => `Q.${n}`,
} as const;
