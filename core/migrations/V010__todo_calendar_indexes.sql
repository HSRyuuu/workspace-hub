-- Calendar month query indexes:
-- fetch TODO candidates by start date, due date, or completed timestamp.
CREATE INDEX IF NOT EXISTS idx_todo_start_date   ON todo(start_date);
CREATE INDEX IF NOT EXISTS idx_todo_due_date     ON todo(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_completed_at ON todo(completed_at);
