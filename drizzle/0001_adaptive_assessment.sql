CREATE TABLE IF NOT EXISTS "assessment_questions" (
  "id" uuid PRIMARY KEY,
  "section" varchar(32) NOT NULL,
  "prompt" text NOT NULL,
  "options" jsonb NOT NULL,
  "correct_index" integer NOT NULL,
  "difficulty" real NOT NULL DEFAULT 0,
  "discrimination" real NOT NULL DEFAULT 1,
  "explanation" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "assessment_attempts" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" varchar(255),
  "status" varchar(24) NOT NULL DEFAULT 'IN_PROGRESS',
  "ability" real NOT NULL DEFAULT 0,
  "question_count" integer NOT NULL DEFAULT 0,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "assessment_attempts_user_idx" ON "assessment_attempts" ("user_id");

CREATE TABLE IF NOT EXISTS "assessment_responses" (
  "id" uuid PRIMARY KEY,
  "attempt_id" uuid NOT NULL REFERENCES "assessment_attempts"("id") ON DELETE cascade,
  "question_id" uuid NOT NULL REFERENCES "assessment_questions"("id"),
  "answer_index" integer NOT NULL,
  "is_correct" boolean NOT NULL,
  "response_ms" integer,
  "ability_after" real NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("attempt_id", "question_id")
);
CREATE INDEX IF NOT EXISTS "assessment_responses_attempt_idx" ON "assessment_responses" ("attempt_id");

CREATE TABLE IF NOT EXISTS "assessment_results" (
  "id" uuid PRIMARY KEY,
  "attempt_id" uuid NOT NULL UNIQUE REFERENCES "assessment_attempts"("id") ON DELETE cascade,
  "overall_score" integer NOT NULL,
  "accuracy" integer NOT NULL,
  "speed_score" integer NOT NULL,
  "ability" real NOT NULL,
  "section_scores" jsonb NOT NULL,
  "strengths" jsonb NOT NULL,
  "weaknesses" jsonb NOT NULL,
  "recommendations" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
