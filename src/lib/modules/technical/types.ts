export type TechnicalQuestionKind = "technical" | "dsa" | "system-design" | "project";

export type TechnicalQuestion = {
  id: string;
  kind: TechnicalQuestionKind;
  prompt: string;
  role: string | null;
};

export type TechnicalResult = {
  overallScore: number;
  correctness: number;
  codeQuality: number;
  problemSolving: number;
  communication: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
};
