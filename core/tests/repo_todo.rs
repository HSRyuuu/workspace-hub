//! core 도메인 단위 테스트.
//!
//! **데이터 격리**: 모든 테스트가 `tempfile::TempDir` 안의 sqlite 파일을 사용하므로
//! 사용자의 `~/.workspace-hub/` 데이터는 절대 건드리지 않는다.
//! `db::open_at()` 가 명시 경로를 받기 때문에 `WORKSPACE_HUB_DATA_DIR` env 도 손대지 않는다.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::todo::{NewTodo, Priority, TodoStatus};
use workspace_hub_core::repo::{normalize_iso_date, todo as repo};
use workspace_hub_core::repo::todo::TodoPatch;
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
        due_at: None,
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
fn create_validates_due_at() {
    let (_dir, conn) = fresh_conn();
    let mut bad = mk("bad-due");
    bad.due_at = Some("not-a-date".into());
    let err = repo::create(&conn, &bad).unwrap_err();
    assert!(matches!(err, CoreError::Parse(_)), "got {err:?}");
}

#[test]
fn create_normalizes_due_short_date_to_iso() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("with-due");
    input.due_at = Some("2026-05-20".into());
    let todo = repo::create(&conn, &input).unwrap();
    assert_eq!(todo.due_at.as_deref(), Some("2026-05-20T00:00:00Z"));
}

#[test]
fn create_accepts_rfc3339_due_unchanged() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("rfc3339-due");
    input.due_at = Some("2026-05-20T13:30:00Z".into());
    let todo = repo::create(&conn, &input).unwrap();
    assert_eq!(todo.due_at.as_deref(), Some("2026-05-20T13:30:00Z"));
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
            due_at: None,
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
            due_at: None,
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
    input.due_at = Some("2026-06-01".into());
    input.priority = Priority::High;
    let t = repo::create(&conn, &input).unwrap();

    // title만 변경
    let patched = repo::update(
        &conn,
        t.id,
        &TodoPatch {
            title: Some("renamed".into()),
            description: None,
            due_at: None,
            priority: None,
            status: None,
        },
    )
    .unwrap();

    assert_eq!(patched.title, "renamed");
    assert_eq!(patched.description.as_deref(), Some("keep"));
    assert_eq!(patched.due_at.as_deref(), Some("2026-06-01T00:00:00Z"));
    assert_eq!(patched.priority, Priority::High);
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
            due_at: None,
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
            due_at: None,
            priority: None,
            status: Some(TodoStatus::Open),
        },
    )
    .unwrap();
    assert_eq!(reopened.status, TodoStatus::Open);
    assert!(reopened.completed_at.is_none());
}
