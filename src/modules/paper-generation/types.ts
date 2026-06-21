export type SubQuestion = {
  label: string;
  questionText: string;
  marks: number;
  courseOutcome: string;
  learningLevel: string;
  orQuestionText?: string;
};

export type QuestionGroup = {
  number: number;
  instruction: string;
  subQuestions: SubQuestion[];
};

export type PaperSection = {
  label: string;        // "Section A", "Section B", "Section C"
  marks: number;        // 2, 5, or 10
  questions: SubQuestion[];  // Each question labeled Q.1, Q.2, ...
};

export type ExamType = "ISE-1" | "ISE-2" | "ENDSEM" | "KT" | "SUPPLEMENTARY";

export type PaperModel = {
  examTitle: string;
  examType: ExamType;
  semester: string;
  subjectCode: string;
  subjectName: string;
  branch: string;
  division: string;
  duration: string;
  timing: string;
  date: string;
  maximumMarks: number;
  instructions: string[];
  sections: PaperSection[];
  questionGroups: QuestionGroup[];
};
