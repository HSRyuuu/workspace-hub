-- workspace-hub v0.2: memo ↔ project N:N 매핑
-- 한 메모가 여러 프로젝트에 속할 수 있고, 한 프로젝트도 여러 메모를 가질 수 있다.
-- 메모/프로젝트 어느 쪽이 삭제되어도 매핑은 CASCADE 로 함께 정리된다.

CREATE TABLE IF NOT EXISTS memo_project (
    memo_id    INTEGER NOT NULL REFERENCES memo(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (memo_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_memo_project_memo ON memo_project(memo_id);
CREATE INDEX IF NOT EXISTS idx_memo_project_project ON memo_project(project_id);
