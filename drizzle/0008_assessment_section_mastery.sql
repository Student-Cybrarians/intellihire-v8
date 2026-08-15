ALTER TABLE assessment_attempts
  ADD COLUMN IF NOT EXISTS section_abilities jsonb NOT NULL DEFAULT '{"quantitative":0,"logical":0,"verbal":0,"domain":0,"coding":0}'::jsonb;

CREATE INDEX IF NOT EXISTS assessment_attempts_section_abilities_gin_idx
  ON assessment_attempts USING gin (section_abilities);
