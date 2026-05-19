-- workspace-hub v0.2: memo + memo_folder
-- 맥북 메모앱과 유사한 메모 도메인.
-- memo_folder: 무제한 중첩 트리(self-FK). 사이클 방지는 application 레이어.
-- memo: body 는 markdown 문자열. soft-delete(deleted_at).
--   휴지통 영구 삭제는 수동 비우기만 — 자동 cleanup 없음.

CREATE TABLE IF NOT EXISTS memo_folder (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER REFERENCES memo_folder(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memo_folder_parent ON memo_folder(parent_id);

CREATE TABLE IF NOT EXISTS memo (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id   INTEGER REFERENCES memo_folder(id) ON DELETE SET NULL,
    title       TEXT NOT NULL DEFAULT '',
    body        TEXT NOT NULL DEFAULT '',
    pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
    deleted_at  TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memo_folder      ON memo(folder_id);
CREATE INDEX IF NOT EXISTS idx_memo_deleted_at  ON memo(deleted_at);
-- 활성 메모(휴지통 제외) 정렬용 부분 인덱스: pinned 우선 + 최신순.
CREATE INDEX IF NOT EXISTS idx_memo_active_sort ON memo(pinned DESC, updated_at DESC)
    WHERE deleted_at IS NULL;
