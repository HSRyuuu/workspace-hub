-- workspace-hub v0.2: file_explorer_folder
-- files 도메인(텍스트 파일 탐색기)이 연 폴더의 히스토리/즐겨찾기.
-- 파일 내용은 저장하지 않는다 — 폴더 경로 참조와 UI 상태만.
-- 비즐겨찾기는 최대 20개 보관(touch 시 prune), 즐겨찾기는 영구.

CREATE TABLE IF NOT EXISTS file_explorer_folder (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    path           TEXT NOT NULL UNIQUE,
    is_favorite    INTEGER NOT NULL DEFAULT 0,
    last_opened_at TEXT NOT NULL
);
