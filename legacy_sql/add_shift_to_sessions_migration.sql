-- Migration: add shift columns to copacker_sessions
-- Run this if Alembic autogenerate is not available on the dev server.
-- Equivalent to: alembic revision --autogenerate -m "add_shift_to_copacker_sessions"
--                alembic upgrade head

ALTER TABLE copacker_sessions
    ADD COLUMN IF NOT EXISTS shift_no          INTEGER,
    ADD COLUMN IF NOT EXISTS shift_start_time  VARCHAR(10),
    ADD COLUMN IF NOT EXISTS shift_end_time    VARCHAR(10);

-- Verify
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_name = 'copacker_sessions'
  AND  column_name IN ('shift_no','shift_start_time','shift_end_time');
