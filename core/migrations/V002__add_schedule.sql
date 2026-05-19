-- workspace-hub v0.2: schedule (캘린더 일정)
-- 사용자가 앱 내부 캘린더에 직접 추가하는 일회성 일정.
-- 외부 캘린더(Google, macOS) 연동 없음. 분 단위 시간 보관.

CREATE TABLE IF NOT EXISTS schedule (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    location     TEXT,
    start_at     TEXT NOT NULL,
    end_at       TEXT NOT NULL,
    all_day      INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
    color        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_start_at ON schedule(start_at);
CREATE INDEX IF NOT EXISTS idx_schedule_end_at   ON schedule(end_at);
