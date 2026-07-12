-- TODO 상태를 open / hold / done 3값으로 확장한다.
-- SQLite는 CHECK 제약을 직접 변경할 수 없으므로 현재 V010 스키마를 그대로 재구성한다.
CREATE TABLE todo_new (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  INTEGER REFERENCES workspace(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    start_date    TEXT NOT NULL,
    due_date      TEXT,
    due_time      INTEGER NOT NULL DEFAULT 0 CHECK (due_time BETWEEN 0 AND 1439),
    priority      TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('low','mid','high')),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','hold','done')),
    completed_at  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

INSERT INTO todo_new (
    id, workspace_id, title, description, start_date, due_date, due_time,
    priority, status, completed_at, created_at, updated_at
)
SELECT
    id, workspace_id, title, description, start_date, due_date, due_time,
    priority, status, completed_at, created_at, updated_at
FROM todo;

DROP TABLE todo;
ALTER TABLE todo_new RENAME TO todo;

CREATE INDEX idx_todo_status       ON todo(status);
CREATE INDEX idx_todo_due_date     ON todo(due_date);
CREATE INDEX idx_todo_workspace    ON todo(workspace_id);
CREATE INDEX idx_todo_start_date   ON todo(start_date);
CREATE INDEX idx_todo_completed_at ON todo(completed_at);
