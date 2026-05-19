-- priority 컬럼을 INTEGER(0-3)에서 TEXT('low'|'mid'|'high')로 이행.
-- run_migrations 가 이 SQL 전체를 하나의 transaction 으로 감싸므로 BEGIN/COMMIT 은 생략한다.
CREATE TABLE todo_new (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  INTEGER REFERENCES workspace(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    due_at        TEXT,
    priority      TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('low','mid','high')),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
    completed_at  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
INSERT INTO todo_new (id, workspace_id, title, description, due_at, priority, status, completed_at, created_at, updated_at)
SELECT id, workspace_id, title, description, due_at,
       CASE priority WHEN 0 THEN 'low' WHEN 1 THEN 'mid' WHEN 2 THEN 'high' WHEN 3 THEN 'high' ELSE 'mid' END,
       status, completed_at, created_at, updated_at
FROM todo;
DROP TABLE todo;
ALTER TABLE todo_new RENAME TO todo;
CREATE INDEX idx_todo_status    ON todo(status);
CREATE INDEX idx_todo_due_at    ON todo(due_at);
CREATE INDEX idx_todo_workspace ON todo(workspace_id);
