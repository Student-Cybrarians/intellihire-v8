CREATE TABLE IF NOT EXISTS career_twin_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role varchar(255),
  target_company varchar(255),
  source_fingerprint varchar(64) NOT NULL,
  mode varchar(16) NOT NULL DEFAULT 'fallback',
  confidence integer NOT NULL DEFAULT 0,
  skill_graph jsonb NOT NULL,
  strengths jsonb NOT NULL,
  gaps jsonb NOT NULL,
  recommendations jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_twin_profiles_confidence_check CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT career_twin_profiles_mode_check CHECK (mode IN ('ai', 'fallback')),
  UNIQUE(user_id, source_fingerprint)
);

CREATE INDEX IF NOT EXISTS career_twin_profiles_user_created_idx
  ON career_twin_profiles(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS career_twin_profiles_skill_graph_gin_idx
  ON career_twin_profiles USING gin(skill_graph);
