CREATE TABLE IF NOT EXISTS research_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question varchar(500) NOT NULL,
  context_fingerprint varchar(64) NOT NULL,
  mode varchar(16) NOT NULL,
  model varchar(255),
  synthesis text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_briefs_user_created_idx ON research_briefs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS research_briefs_context_fingerprint_idx ON research_briefs(user_id, context_fingerprint);
