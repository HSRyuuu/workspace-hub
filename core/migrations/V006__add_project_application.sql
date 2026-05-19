-- workspace-hub v0.2: project_application
-- 프로젝트마다 macOS 응용프로그램(.app) 바로가기를 1:N 으로 매단다.
-- path 는 .app 번들의 절대경로(예: /Applications/IntelliJ IDEA.app).
-- label 은 사용자 별칭(생략 시 .app 의 basename 사용).

CREATE TABLE IF NOT EXISTS project_application (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    path         TEXT NOT NULL,
    label        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_application_project ON project_application(project_id);
