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
