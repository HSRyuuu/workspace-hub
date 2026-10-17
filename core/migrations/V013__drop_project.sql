-- "프로젝트(Workspace)" 개념 제거.
-- todo.project_id 는 FK 컬럼이라 DROP COLUMN 이 불가하므로 V011 과 같은 방식으로 todo 를 재구성하고,
-- project 계열 테이블은 모두 삭제한다. V010 시드에서 올라오는 경로는 project 테이블이 없을 수 있어 IF EXISTS.
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

DROP TABLE IF EXISTS memo_project;
DROP TABLE IF EXISTS project_application;
DROP TABLE IF EXISTS project_directory;
DROP TABLE IF EXISTS project;
