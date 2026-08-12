CREATE TABLE IF NOT EXISTS technical_interviews (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(255),
  status varchar(24) NOT NULL DEFAULT 'IN_PROGRESS',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS technical_interviews_user_status_idx ON technical_interviews(user_id, status, started_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS technical_questions (
  id uuid PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES technical_interviews(id) ON DELETE CASCADE,
  kind varchar(32) NOT NULL,
  prompt text NOT NULL,
  sequence_no integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, sequence_no)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS technical_questions_interview_idx ON technical_questions(interview_id, sequence_no);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS technical_responses (
  id uuid PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES technical_interviews(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES technical_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  code text,
  evaluation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, question_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS technical_responses_interview_idx ON technical_responses(interview_id, created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS technical_results (
  id uuid PRIMARY KEY,
  interview_id uuid NOT NULL UNIQUE REFERENCES technical_interviews(id) ON DELETE CASCADE,
  overall_score integer NOT NULL,
  correctness integer NOT NULL,
  code_quality integer NOT NULL,
  problem_solving integer NOT NULL,
  communication integer NOT NULL,
  strengths jsonb NOT NULL,
  improvements jsonb NOT NULL,
  recommendations jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
