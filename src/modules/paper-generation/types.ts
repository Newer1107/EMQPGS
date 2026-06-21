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
  questionGroups: QuestionGroup[];
};
