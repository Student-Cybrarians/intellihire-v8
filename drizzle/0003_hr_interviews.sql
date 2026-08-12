CREATE TABLE IF NOT EXISTS hr_interviews (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(255),
  company varchar(255),
  status varchar(24) NOT NULL DEFAULT 'IN_PROGRESS',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS hr_interviews_user_status_idx
  ON hr_interviews(user_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS hr_questions (
  id uuid PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES hr_interviews(id) ON DELETE CASCADE,
  category varchar(32) NOT NULL,
  prompt text NOT NULL,
  sequence_no integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS hr_questions_interview_idx
  ON hr_questions(interview_id, sequence_no);

CREATE TABLE IF NOT EXISTS hr_responses (
  id uuid PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES hr_interviews(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES hr_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  evaluation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, question_id)
);

CREATE INDEX IF NOT EXISTS hr_responses_interview_idx
  ON hr_responses(interview_id, created_at);

CREATE TABLE IF NOT EXISTS hr_results (
  id uuid PRIMARY KEY,
  interview_id uuid NOT NULL UNIQUE REFERENCES hr_interviews(id) ON DELETE CASCADE,
  overall_score integer NOT NULL,
  communication integer NOT NULL,
  behavioral integer NOT NULL,
  relevance integer NOT NULL,
  structure integer NOT NULL,
  strengths jsonb NOT NULL,
  improvements jsonb NOT NULL,
  recommendations jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
