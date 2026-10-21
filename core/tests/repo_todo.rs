//! core 도메인 단위 테스트.
//!
//! **데이터 격리**: 모든 테스트가 `tempfile::TempDir` 안의 sqlite 파일을 사용하므로
//! 사용자의 `~/.workspace-hub/` 데이터는 절대 건드리지 않는다.
//! `db::open_at()` 가 명시 경로를 받기 때문에 `WORKSPACE_HUB_DATA_DIR` env 도 손대지 않는다.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::todo::{NewTodo, Priority, TodoStatus};
use workspace_hub_core::repo::todo::TodoPatch;
use workspace_hub_core::repo::{normalize_iso_date, todo as repo};
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn mk(title: &str) -> NewTodo {
    NewTodo {
        workspace_id: None,
        title: title.into(),
        description: None,
        start_date: None,
        due_date: None,
        due_time: None,
        priority: Priority::Mid,
        summary: None,
        links: vec![],
    }
}

#[test]
fn create_then_get_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let created = repo::create(&conn, &mk("hello")).unwrap();
    assert!(created.id > 0);
    assert_eq!(created.title, "hello");
    assert_eq!(created.status, TodoStatus::Open);
    assert_eq!(created.start_date, &created.created_at[..10]);
    assert!(created.due_date.is_none());
    assert_eq!(created.due_time, 0);
    assert!(created.completed_at.is_none());

    let fetched = repo::get(&conn, created.id).unwrap();
    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.title, "hello");
}

#[test]
fn create_rejects_empty_title() {
    let (_dir, conn) = fresh_conn();
    let err = repo::create(&conn, &mk("   ")).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn create_validates_due_date() {
    let (_dir, conn) = fresh_conn();
    let mut bad = mk("bad-due");
    bad.due_date = Some("not-a-date".into());
    let err = repo::create(&conn, &bad).unwrap_err();
    assert!(matches!(err, CoreError::Parse(_)), "got {err:?}");
}

#[test]
fn create_stores_due_short_date_as_date_only() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("with-due");
    input.due_date = Some("2026-05-20".into());
    input.due_time = Some(90);
    let todo = repo::create(&conn, &input).unwrap();
    assert_eq!(todo.due_date.as_deref(), Some("2026-05-20"));
    assert_eq!(todo.due_time, 90);
}

#[test]
fn create_discards_rfc3339_due_time() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("rfc3339-due");
    input.due_date = Some("2026-05-20T13:30:00Z".into());
    let todo = repo::create(&conn, &input).unwrap();
    assert_eq!(todo.due_date.as_deref(), Some("2026-05-20"));
    assert_eq!(todo.due_time, 0);
}

#[test]
fn create_validates_due_time_range() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("bad-due-time");
    input.due_time = Some(1440);
    let err = repo::create(&conn, &input).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn complete_then_uncomplete_cycles_status() {
    let (_dir, conn) = fresh_conn();
    let t = repo::create(&conn, &mk("toggle")).unwrap();
    let done = repo::complete(&conn, t.id).unwrap();
    assert_eq!(done.status, TodoStatus::Done);
    assert!(done.completed_at.is_some());

    let reopened = repo::uncomplete(&conn, t.id).unwrap();
    assert_eq!(reopened.status, TodoStatus::Open);
    assert!(reopened.completed_at.is_none());
}

#[test]
fn todo_status_parses_hold() {
    assert_eq!(TodoStatus::parse("hold"), Some(TodoStatus::Hold));
    assert_eq!(TodoStatus::Hold.as_str(), "hold");
}

#[test]
fn update_to_hold_clears_completed_at() {
    let (_dir, conn) = fresh_conn();
    let todo = repo::create(&conn, &mk("hold me")).unwrap();
    let done = repo::complete(&conn, todo.id).unwrap();
    assert!(done.completed_at.is_some());

    let held = repo::update(
        &conn,
        todo.id,
        &TodoPatch {
            title: None,
            description: None,
            start_date: None,
            due_date: None,
            due_time: None,
            priority: None,
            status: Some(TodoStatus::Hold),
            summary: None,
            links: None,
        },
    )
    .unwrap();

    assert_eq!(held.status, TodoStatus::Hold);
    assert!(held.completed_at.is_none());
}

#[test]
fn list_orders_open_before_hold_before_done() {
    let (_dir, conn) = fresh_conn();
    let open = repo::create(&conn, &mk("open")).unwrap();
    let hold = repo::create(&conn, &mk("hold")).unwrap();
    let done = repo::create(&conn, &mk("done")).unwrap();
    repo::update(
        &conn,
        hold.id,
        &TodoPatch {
            title: None,
            description: None,
            start_date: None,
            due_date: None,
            due_time: None,
            priority: None,
            status: Some(TodoStatus::Hold),
            summary: None,
            links: None,
        },
    )
    .unwrap();
    repo::complete(&conn, done.id).unwrap();

    let todos = repo::list(&conn, None).unwrap();
    let ids: Vec<i64> = todos.iter().map(|todo| todo.id).collect();

    assert_eq!(ids, vec![open.id, hold.id, done.id]);
}

#[test]
fn v013_drops_project_tables_and_todo_project_id() {
    let (_dir, conn) = fresh_conn();
    let project_tables: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'
             AND name IN ('project', 'project_directory', 'project_application', 'memo_project')",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let project_id_columns: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('todo') WHERE name = 'project_id'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(db::LATEST_SCHEMA_VERSION, 14);
    assert_eq!(project_tables, 0);
    assert_eq!(project_id_columns, 0);
}

#[test]
fn v013_preserves_v012_todos_and_creates_backup() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("v012.sqlite");
    {
        let conn = db::open_at(&path).unwrap();
        repo::create(&conn, &mk("keep me")).unwrap();
        conn.execute_batch(
            "DELETE FROM schema_version WHERE version >= 13;
             ALTER TABLE todo DROP COLUMN summary;
             ALTER TABLE todo DROP COLUMN links;
             CREATE TABLE project (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL);
             INSERT INTO project (id, title) VALUES (1, 'old');
             ALTER TABLE todo ADD COLUMN project_id INTEGER REFERENCES project(id) ON DELETE SET NULL;
             UPDATE todo SET project_id = 1;",
        )
        .unwrap();
    }

    let conn = db::open_at(&path).unwrap();
    let todos = repo::list(&conn, None).unwrap();
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].title, "keep me");
    let has_project: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'project'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(has_project, 0);
    assert!(path.with_extension("bak-pre-v013").exists());
}

#[test]
fn v011_preserves_v010_todos_and_creates_backup() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("v010.sqlite");
    let seed_conn = Connection::open(&path).unwrap();
    seed_conn
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA wal_autocheckpoint = 0;
            CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
            INSERT INTO schema_version (version) VALUES (10);
            CREATE TABLE workspace (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#3F3393',
                icon TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE todo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER REFERENCES workspace(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                description TEXT,
                start_date TEXT NOT NULL,
                due_date TEXT,
                due_time INTEGER NOT NULL DEFAULT 0 CHECK (due_time BETWEEN 0 AND 1439),
                priority TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('low','mid','high')),
                status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO todo (
                id, workspace_id, title, description, start_date, due_date, due_time,
                priority, status, completed_at, created_at, updated_at
            ) VALUES
                (1, NULL, 'keep open', NULL, '2026-07-01', NULL, 0, 'mid', 'open', NULL, '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z'),
                (2, NULL, 'keep done', NULL, '2026-07-02', '2026-07-03', 600, 'high', 'done', '2026-07-03T10:00:00Z', '2026-07-02T00:00:00Z', '2026-07-03T10:00:00Z');
            ",
        )
        .unwrap();

    let conn = db::open_at(&path).unwrap();
    let version: u32 = conn
        .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
            row.get(0)
        })
        .unwrap();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM todo", [], |row| row.get(0))
        .unwrap();

    assert_eq!(db::LATEST_SCHEMA_VERSION, 14);
    assert_eq!(version, 14);
    assert_eq!(count, 2);
    assert_eq!(repo::get(&conn, 1).unwrap().status, TodoStatus::Open);
    assert_eq!(repo::get(&conn, 2).unwrap().status, TodoStatus::Done);
    let backup_path = path.with_extension("bak-pre-v011");
    let backup = Connection::open(&backup_path).unwrap();
    let backup_version: u32 = backup
        .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
            row.get(0)
        })
        .unwrap();
    let backup_count: i64 = backup
        .query_row("SELECT COUNT(*) FROM todo", [], |row| row.get(0))
        .unwrap();
    assert_eq!(backup_version, 10);
    assert_eq!(backup_count, 2);

    drop(backup);
    drop(conn);
    drop(seed_conn);
    std::fs::copy(&backup_path, &path).unwrap();
    let _ = std::fs::remove_file(path.with_extension("sqlite-wal"));
    let _ = std::fs::remove_file(path.with_extension("sqlite-shm"));

    let retried = db::open_at(&path).unwrap();
    let retried_version: u32 = retried
        .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(retried_version, 14);
    assert_eq!(repo::list(&retried, None).unwrap().len(), 2);
}

#[test]
fn list_filters_by_status() {
    let (_dir, conn) = fresh_conn();
    let a = repo::create(&conn, &mk("a")).unwrap();
    let _b = repo::create(&conn, &mk("b")).unwrap();
    repo::complete(&conn, a.id).unwrap();

    let all = repo::list(&conn, None).unwrap();
    assert_eq!(all.len(), 2);

    let opens = repo::list(&conn, Some(TodoStatus::Open)).unwrap();
    assert_eq!(opens.len(), 1);
    assert_eq!(opens[0].title, "b");

    let dones = repo::list(&conn, Some(TodoStatus::Done)).unwrap();
    assert_eq!(dones.len(), 1);
    assert_eq!(dones[0].title, "a");
}

#[test]
fn list_calendar_range_returns_month_candidates_once() {
    let (_dir, conn) = fresh_conn();

    let mut start_only = mk("start-only");
    start_only.start_date = Some("2026-05-03".into());
    let start_only = repo::create(&conn, &start_only).unwrap();

    let mut due_only = mk("due-only");
    due_only.start_date = Some("2026-04-01".into());
    due_only.due_date = Some("2026-05-20".into());
    let due_only = repo::create(&conn, &due_only).unwrap();

    let mut completed_only = mk("completed-only");
    completed_only.start_date = Some("2026-04-01".into());
    completed_only.due_date = Some("2026-06-01".into());
    let completed_only = repo::create(&conn, &completed_only).unwrap();
    conn.execute(
        "UPDATE todo
         SET status = 'done', completed_at = '2026-05-10T12:00:00Z'
         WHERE id = ?1",
        [completed_only.id],
    )
    .unwrap();

    let mut duplicate_candidate = mk("duplicate-candidate");
    duplicate_candidate.start_date = Some("2026-05-01".into());
    duplicate_candidate.due_date = Some("2026-05-02".into());
    let duplicate_candidate = repo::create(&conn, &duplicate_candidate).unwrap();

    let mut outside = mk("outside");
    outside.start_date = Some("2026-04-01".into());
    outside.due_date = Some("2026-06-01".into());
    let _outside = repo::create(&conn, &outside).unwrap();

    let todos = repo::list_calendar_range(
        &conn,
        "2026-05-01",
        "2026-06-01",
        "2026-05-01T00:00:00Z",
        "2026-06-01T00:00:00Z",
    )
    .unwrap();
    let ids: Vec<i64> = todos.iter().map(|t| t.id).collect();

    assert!(ids.contains(&start_only.id));
    assert!(ids.contains(&due_only.id));
    assert!(ids.contains(&completed_only.id));
    assert!(ids.contains(&duplicate_candidate.id));
    assert_eq!(
        ids.iter()
            .filter(|id| **id == duplicate_candidate.id)
            .count(),
        1
    );
    assert_eq!(ids.len(), 4);
}

#[test]
fn delete_then_get_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let t = repo::create(&conn, &mk("doomed")).unwrap();
    repo::delete(&conn, t.id).unwrap();

    let err = repo::get(&conn, t.id).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn delete_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::delete(&conn, 9999).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn complete_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::complete(&conn, 9999).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn db_open_at_is_idempotent_for_migrations() {
    // 같은 경로를 두 번 열어도 마이그레이션이 두 번 적용되지 않고 schema_version 최종값 유지
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("twice.sqlite");
    let _c1 = db::open_at(&path).unwrap();
    let c2 = db::open_at(&path).unwrap();
    let v: u32 = c2
        .query_row("SELECT MAX(version) FROM schema_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(v, db::LATEST_SCHEMA_VERSION);
}

#[test]
fn normalize_iso_date_accepts_short_form() {
    let v = normalize_iso_date(Some("2026-12-31")).unwrap();
    assert_eq!(v.as_deref(), Some("2026-12-31T00:00:00Z"));
}

#[test]
fn normalize_iso_date_accepts_rfc3339() {
    let v = normalize_iso_date(Some("2026-01-02T03:04:05Z")).unwrap();
    assert_eq!(v.as_deref(), Some("2026-01-02T03:04:05Z"));
}

#[test]
fn normalize_iso_date_empty_and_none() {
    assert_eq!(normalize_iso_date(None).unwrap(), None);
    assert_eq!(normalize_iso_date(Some("")).unwrap(), None);
    assert_eq!(normalize_iso_date(Some("   ")).unwrap(), None);
}

#[test]
fn normalize_iso_date_rejects_garbage() {
    assert!(matches!(
        normalize_iso_date(Some("garbage")).unwrap_err(),
        CoreError::Parse(_)
    ));
    assert!(matches!(
        normalize_iso_date(Some("2026-13-40")).unwrap_err(),
        CoreError::Parse(_)
    ));
}

// ── update() 단위 테스트 4건 ─────────────────────────────────────────────────

#[test]
fn update_single_field_patch() {
    let (_dir, conn) = fresh_conn();
    let t = repo::create(&conn, &mk("original")).unwrap();
    assert_eq!(t.priority, Priority::Mid);

    let patched = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: None,
            description: None,
            start_date: None,
            due_date: None,
            due_time: None,
            priority: Some(Priority::High),
            status: None,
            summary: None,
            links: None,
        },
    )
    .unwrap();

    assert_eq!(patched.priority, Priority::High);
    assert_eq!(patched.title, "original"); // 미지정 필드 보존
}

#[test]
fn update_null_clear() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("with-desc");
    input.description = Some("some description".into());
    let t = repo::create(&conn, &input).unwrap();
    assert!(t.description.is_some());

    let patched = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: None,
            description: Some(None), // NULL 클리어
            start_date: None,
            due_date: None,
            due_time: None,
            priority: None,
            status: None,
            summary: None,
            links: None,
        },
    )
    .unwrap();

    assert!(patched.description.is_none());
}

#[test]
fn update_unspecified_fields_preserved() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("keep-me");
    input.description = Some("keep".into());
    input.due_date = Some("2026-06-01".into());
    input.due_time = Some(600);
    input.priority = Priority::High;
    let t = repo::create(&conn, &input).unwrap();

    // title만 변경
    let patched = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: Some("renamed".into()),
            description: None,
            start_date: None,
            due_date: None,
            due_time: None,
            priority: None,
            status: None,
            summary: None,
            links: None,
        },
    )
    .unwrap();

    assert_eq!(patched.title, "renamed");
    assert_eq!(patched.description.as_deref(), Some("keep"));
    assert_eq!(patched.due_date.as_deref(), Some("2026-06-01"));
    assert_eq!(patched.due_time, 600);
    assert_eq!(patched.priority, Priority::High);
}

#[test]
fn update_due_date_clear_resets_due_time() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("clear-due");
    input.due_date = Some("2026-06-01".into());
    input.due_time = Some(600);
    let t = repo::create(&conn, &input).unwrap();

    let patched = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: None,
            description: None,
            start_date: None,
            due_date: Some(None),
            due_time: None,
            priority: None,
            status: None,
            summary: None,
            links: None,
        },
    )
    .unwrap();

    assert!(patched.due_date.is_none());
    assert_eq!(patched.due_time, 0);
}

#[test]
fn update_status_syncs_completed_at() {
    let (_dir, conn) = fresh_conn();
    let t = repo::create(&conn, &mk("status-test")).unwrap();
    assert!(t.completed_at.is_none());

    // open → done: completed_at 설정됨
    let done = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: None,
            description: None,
            start_date: None,
            due_date: None,
            due_time: None,
            priority: None,
            status: Some(TodoStatus::Done),
            summary: None,
            links: None,
        },
    )
    .unwrap();
    assert_eq!(done.status, TodoStatus::Done);
    assert!(done.completed_at.is_some());

    // done → open: completed_at NULL 로 클리어
    let reopened = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: None,
            description: None,
            start_date: None,
            due_date: None,
            due_time: None,
            priority: None,
            status: Some(TodoStatus::Open),
            summary: None,
            links: None,
        },
    )
    .unwrap();
    assert_eq!(reopened.status, TodoStatus::Open);
    assert!(reopened.completed_at.is_none());
}

#[test]
fn migrates_existing_due_at_to_due_date_and_due_time() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("legacy.sqlite");
    {
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "
            CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
            INSERT INTO schema_version (version) VALUES (8);
            CREATE TABLE workspace (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#3F3393',
                icon TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE todo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER REFERENCES workspace(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                description TEXT,
                due_at TEXT,
                priority TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('low','mid','high')),
                status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO todo (id, workspace_id, title, description, due_at, priority, status, completed_at, created_at, updated_at)
            VALUES
                (1, NULL, 'with datetime', NULL, '2026-05-20T13:30:00Z', 'mid', 'open', NULL, '2026-05-01T09:10:00Z', '2026-05-01T09:10:00Z'),
                (2, NULL, 'without due', NULL, NULL, 'high', 'done', '2026-05-03T01:02:03Z', '2026-05-02T11:12:00Z', '2026-05-03T01:02:03Z');
            ",
        )
        .unwrap();
    }

    let conn = db::open_at(&path).unwrap();
    let one = repo::get(&conn, 1).unwrap();
    assert_eq!(one.start_date, "2026-05-01");
    assert_eq!(one.due_date.as_deref(), Some("2026-05-20"));
    assert_eq!(one.due_time, 0);

    let two = repo::get(&conn, 2).unwrap();
    assert_eq!(two.start_date, "2026-05-02");
    assert!(two.due_date.is_none());
    assert_eq!(two.due_time, 0);
    assert_eq!(two.completed_at.as_deref(), Some("2026-05-03T01:02:03Z"));
}

fn empty_patch() -> TodoPatch {
    TodoPatch {
        title: None,
        description: None,
        start_date: None,
        due_date: None,
        due_time: None,
        priority: None,
        status: None,
        summary: None,
        links: None,
    }
}

#[test]
fn summary_and_links_roundtrip_on_create() {
    let (_dir, conn) = fresh_conn();
    let created = repo::create(
        &conn,
        &NewTodo {
            summary: Some("요청자 · 맥락".into()),
            links: vec!["https://a.example/1".into(), "  https://b.example/2  ".into()],
            ..mk("with links")
        },
    )
    .unwrap();
    assert_eq!(created.summary.as_deref(), Some("요청자 · 맥락"));
    assert_eq!(created.links, vec!["https://a.example/1", "https://b.example/2"]);

    let fetched = repo::get(&conn, created.id).unwrap();
    assert_eq!(fetched.links, created.links);
    let listed = repo::list(&conn, None).unwrap();
    assert_eq!(listed[0].links, created.links);
}

#[test]
fn update_replaces_and_clears_summary_and_links() {
    let (_dir, conn) = fresh_conn();
    let t = repo::create(
        &conn,
        &NewTodo {
            summary: Some("s".into()),
            links: vec!["https://a".into(), "https://b".into()],
            ..mk("t")
        },
    )
    .unwrap();

    let replaced = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            links: Some(vec!["https://c".into()]),
            ..empty_patch()
        },
    )
    .unwrap();
    assert_eq!(replaced.links, vec!["https://c"]);
    assert_eq!(replaced.summary.as_deref(), Some("s"), "미지정 summary 는 보존");

    let preserved = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: Some("renamed".into()),
            ..empty_patch()
        },
    )
    .unwrap();
    assert_eq!(preserved.links, vec!["https://c"], "미지정 links 는 보존");

    let cleared = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            summary: Some(None),
            links: Some(vec![]),
            ..empty_patch()
        },
    )
    .unwrap();
    assert_eq!(cleared.summary, None);
    assert!(cleared.links.is_empty());
}

#[test]
fn links_reject_non_http_and_blank() {
    let (_dir, conn) = fresh_conn();
    for bad in ["ftp://x", "javascript:alert(1)", "   ", "slack://channel"] {
        let err = repo::create(
            &conn,
            &NewTodo {
                links: vec![bad.into()],
                ..mk("bad")
            },
        )
        .unwrap_err();
        assert!(matches!(err, CoreError::InvalidInput(_)), "create {bad:?}");
    }

    let t = repo::create(&conn, &mk("ok")).unwrap();
    let err = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            links: Some(vec!["https://ok".into(), "ftp://x".into()]),
            ..empty_patch()
        },
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)));
    assert!(
        repo::get(&conn, t.id).unwrap().links.is_empty(),
        "거부된 update 는 아무것도 바꾸지 않는다"
    );
}

#[test]
fn migration_v014_keeps_existing_rows_with_empty_links() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("old.sqlite");
    {
        let conn = db::open_at(&path).unwrap();
        repo::create(&conn, &mk("before")).unwrap();
        conn.execute_batch(
            "ALTER TABLE todo DROP COLUMN summary;
             ALTER TABLE todo DROP COLUMN links;
             DELETE FROM schema_version WHERE version = 14;",
        )
        .unwrap();
    }
    let conn = db::open_at(&path).unwrap();
    let todos = repo::list(&conn, None).unwrap();
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].title, "before");
    assert_eq!(todos[0].summary, None);
    assert!(todos[0].links.is_empty());
}
