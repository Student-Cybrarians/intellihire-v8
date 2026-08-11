export type AssessmentSection =
  | "quantitative"
  | "logical"
  | "verbal"
  | "domain"
  | "coding";

export type AssessmentQuestion = {
  id: string;
  section: AssessmentSection;
  prompt: string;
  options: string[];
  difficulty: number;
  discrimination: number;
};

export type AssessmentState = {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  role: string | null;
  ability: number;
  answered: number;
  questionCount: number;
  currentQuestion: AssessmentQuestion | null;
};

export type AssessmentResult = {
  overallScore: number;
  accuracy: number;
  speedScore: number;
  ability: number;
  sectionScores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};
