use std::path::Path;

use rusqlite::{params, Connection};

use crate::error::CoreError;
use crate::paths;

/// 마이그레이션 레지스트리.
/// 새 마이그레이션을 추가하려면 (a) `core/migrations/V{N}__...sql` 를 만들고,
/// (b) 이 배열 끝에 `(N, include_str!("../migrations/V{N}__....sql"))` 를 한 줄 추가하면 된다.
/// 적용 순서는 배열 순서 그대로이며, 이미 적용된 버전은 schema_version 테이블이 추적한다.
const MIGRATIONS: &[(u32, &str)] = &[
    (1, include_str!("../migrations/V001__init.sql")),
    (2, include_str!("../migrations/V002__add_schedule.sql")),
    (3, include_str!("../migrations/V003__add_memo.sql")),
    (4, include_str!("../migrations/V004__add_project.sql")),
    (5, include_str!("../migrations/V005__priority_enum.sql")),
    (6, include_str!("../migrations/V006__add_project_application.sql")),
    (7, include_str!("../migrations/V007__add_memo_project.sql")),
    (8, include_str!("../migrations/V008__add_file_explorer.sql")),
    (9, include_str!("../migrations/V009__todo_date_policy.sql")),
];

/// MIGRATIONS 배열의 마지막 버전. 테스트가 매직 넘버 대신 이 상수를 참조하면 새 마이그레이션
/// 추가 시 자동 추종한다.
pub const LATEST_SCHEMA_VERSION: u32 = {
    let mut max = 0u32;
    let mut i = 0;
    while i < MIGRATIONS.len() {
        if MIGRATIONS[i].0 > max {
            max = MIGRATIONS[i].0;
        }
        i += 1;
    }
    max
};

/// 실 사용 진입점 — `~/.workspace-hub/workspace-hub.sqlite` (또는 `WORKSPACE_HUB_DATA_DIR` 오버라이드)
/// 위치를 자동으로 결정해 연다.
pub fn open() -> Result<Connection, CoreError> {
    let path = paths::db_path()?;
    open_at(&path)
}

/// 명시적 경로 지정용 — **테스트가 `~/.workspace-hub` 를 건드리지 않도록** 임시 디렉토리의
/// sqlite 파일을 직접 열 때 사용한다. 부모 디렉토리는 필요 시 자동 생성한다.
pub fn open_at(path: &Path) -> Result<Connection, CoreError> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(std::time::Duration::from_millis(5000))?;
    run_migrations(&mut conn)?;
    Ok(conn)
}

fn run_migrations(conn: &mut Connection) -> Result<(), CoreError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)",
        [],
    )?;
    let current: u32 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |r| r.get(0),
    )?;

    for (version, sql) in MIGRATIONS {
        if *version > current {
            // V005 적용 직전 자동 백업 — 복사 실패 시 마이그레이션 중단.
            if *version == 5 {
                if let Some(db_path_str) = conn.path() {
                    let db_path = std::path::Path::new(db_path_str);
                    let backup_path = db_path.with_extension("bak-pre-v005");
                    std::fs::copy(db_path, &backup_path)?;
                }
            }
            let tx = conn.transaction()?;
            tx.execute_batch(sql)?;
            tx.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                params![*version],
            )?;
            tx.commit()?;
        }
    }
    Ok(())
}
