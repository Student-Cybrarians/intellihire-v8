CREATE TABLE IF NOT EXISTS performance_insight_reports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  overall_score integer NOT NULL,
  readiness_level varchar(32) NOT NULL,
  metrics jsonb NOT NULL,
  strengths jsonb NOT NULL,
  gaps jsonb NOT NULL,
  recommendations jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_insight_reports_period_check CHECK (period_end >= period_start),
  CONSTRAINT performance_insight_reports_score_check CHECK (overall_score BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS performance_insight_reports_user_created_idx
  ON performance_insight_reports(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS performance_insight_reports_user_period_idx
  ON performance_insight_reports(user_id, period_start DESC, period_end DESC);
