-- TODO 날짜 정책 변경:
-- - due_at(DateTime 문자열)을 due_date(Date 문자열)로 이행하고 시간 정보는 폐기한다.
-- - start_date(Date)를 created_at 날짜로 backfill한다.
-- - due_time(분 단위 정수)은 default 0으로 backfill한다.
CREATE TABLE todo_new (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  INTEGER REFERENCES workspace(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    start_date    TEXT NOT NULL,
    due_date      TEXT,
    due_time      INTEGER NOT NULL DEFAULT 0 CHECK (due_time BETWEEN 0 AND 1439),
    priority      TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('low','mid','high')),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
    completed_at  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

INSERT INTO todo_new (
    id, workspace_id, title, description, start_date, due_date, due_time,
    priority, status, completed_at, created_at, updated_at
)
SELECT
    id,
    workspace_id,
    title,
    description,
    substr(created_at, 1, 10),
    CASE
        WHEN due_at IS NULL OR trim(due_at) = '' THEN NULL
        ELSE substr(due_at, 1, 10)
    END,
    0,
    priority,
    status,
    completed_at,
    created_at,
    updated_at
FROM todo;

DROP TABLE todo;
ALTER TABLE todo_new RENAME TO todo;

CREATE INDEX idx_todo_status    ON todo(status);
CREATE INDEX idx_todo_due_date  ON todo(due_date);
CREATE INDEX idx_todo_workspace ON todo(workspace_id);
