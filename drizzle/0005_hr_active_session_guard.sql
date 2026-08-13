CREATE UNIQUE INDEX IF NOT EXISTS hr_interviews_one_active_per_user_idx
  ON hr_interviews(user_id)
  WHERE status = 'IN_PROGRESS';
