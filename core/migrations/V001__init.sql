-- workspace-hub v0.1 initial schema
-- v0.1 활성: todo, workspace (workspace는 todo.workspace_id FK 대상으로만 사용)
-- 메모·캘린더 이벤트·shortcut은 향후 마이그레이션에서 도입한다.

CREATE TABLE IF NOT EXISTS workspace (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#3F3393',
    icon        TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_sort_order ON workspace(sort_order);

CREATE TABLE IF NOT EXISTS todo (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  INTEGER REFERENCES workspace(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    due_at        TEXT,
    priority      INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    completed_at  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todo_status        ON todo(status);
CREATE INDEX IF NOT EXISTS idx_todo_due_at        ON todo(due_at);
CREATE INDEX IF NOT EXISTS idx_todo_workspace     ON todo(workspace_id);
