CREATE TABLE IF NOT EXISTS roadmap_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_fingerprint varchar(128) NOT NULL,
  target_role varchar(255),
  mode varchar(16) NOT NULL DEFAULT 'fallback',
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  integrity jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_fingerprint)
);
CREATE INDEX IF NOT EXISTS roadmap_plans_user_created_idx ON roadmap_plans(user_id, created_at DESC);
