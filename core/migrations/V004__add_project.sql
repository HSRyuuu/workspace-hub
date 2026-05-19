-- workspace-hub v0.2: project + project_directory
-- 기존 workspace 테이블은 보존(어떤 결정도 되돌리지 않음). project 는 "프로젝트 단위" 묶음,
-- project_directory 는 그 아래에 1:N 으로 매달리는 로컬 디렉터리(절대경로) 목록이다.

CREATE TABLE IF NOT EXISTS project (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    color        TEXT NOT NULL DEFAULT '#3F3393',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_sort_order ON project(sort_order);

CREATE TABLE IF NOT EXISTS project_directory (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    path         TEXT NOT NULL,
    label        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_directory_project ON project_directory(project_id);
