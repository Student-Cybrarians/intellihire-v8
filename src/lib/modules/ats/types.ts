export type AtsScreeningInput = {
  resumeText: string;
  jobDescription: string;
};

export type AtsScreeningResult = {
  overallScore: number;
  atsCompatibility: number;
  keywordMatch: number;
  experienceFit: number;
  educationFit: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  recommendations: string[];
};
