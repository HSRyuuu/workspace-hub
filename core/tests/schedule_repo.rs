//! schedule repo 단위 테스트.
//!
//! repo_todo.rs 와 같은 격리 패턴을 따른다. `tempfile::TempDir` + `db::open_at()`.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::schedule::{NewSchedule, UpdateSchedule};
use workspace_hub_core::repo::schedule as repo;
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn mk(title: &str, start: &str, end: &str) -> NewSchedule {
    NewSchedule {
        title: title.into(),
        description: None,
        location: None,
        start_at: start.into(),
        end_at: end.into(),
        all_day: false,
        color: None,
    }
}

#[test]
fn create_then_get_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let s = repo::create(
        &conn,
        &mk("lunch", "2026-05-20T12:00:00Z", "2026-05-20T13:00:00Z"),
    )
    .unwrap();
    assert!(s.id > 0);
    assert_eq!(s.title, "lunch");
    assert!(!s.all_day);

    let got = repo::get(&conn, s.id).unwrap();
    assert_eq!(got.id, s.id);
    assert_eq!(got.start_at, "2026-05-20T12:00:00Z");
    assert_eq!(got.end_at, "2026-05-20T13:00:00Z");
}

#[test]
fn create_normalizes_short_dates() {
    let (_dir, conn) = fresh_conn();
    let s = repo::create(&conn, &mk("day-block", "2026-05-20", "2026-05-21")).unwrap();
    assert_eq!(s.start_at, "2026-05-20T00:00:00Z");
    assert_eq!(s.end_at, "2026-05-21T00:00:00Z");
}

#[test]
fn create_rejects_empty_title() {
    let (_dir, conn) = fresh_conn();
    let err = repo::create(
        &conn,
        &mk("   ", "2026-05-20T09:00:00Z", "2026-05-20T10:00:00Z"),
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn create_rejects_end_before_start() {
    let (_dir, conn) = fresh_conn();
    let err = repo::create(
        &conn,
        &mk("bad", "2026-05-20T10:00:00Z", "2026-05-20T09:00:00Z"),
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn create_rejects_garbage_dates() {
    let (_dir, conn) = fresh_conn();
    let err = repo::create(&conn, &mk("bad", "not-a-date", "2026-05-20")).unwrap_err();
    assert!(matches!(err, CoreError::Parse(_)), "got {err:?}");
}

#[test]
fn list_in_range_filters_correctly() {
    let (_dir, conn) = fresh_conn();
    // 4월 28일 — out of range
    repo::create(
        &conn,
        &mk("apr", "2026-04-28T09:00:00Z", "2026-04-28T10:00:00Z"),
    )
    .unwrap();
    // 5월 1일 — in range
    repo::create(
        &conn,
        &mk("may1", "2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z"),
    )
    .unwrap();
    // 5월 31일 — in range (end_at 가 6/1 자정 직전)
    repo::create(
        &conn,
        &mk("may31", "2026-05-31T20:00:00Z", "2026-05-31T22:00:00Z"),
    )
    .unwrap();
    // 6월 1일 — out of range (start_at == to 이므로 < to 조건 미충족)
    repo::create(
        &conn,
        &mk("jun", "2026-06-01T00:00:00Z", "2026-06-01T01:00:00Z"),
    )
    .unwrap();
    // 4/30 ~ 5/2 걸침 — in range (end_at >= from)
    repo::create(
        &conn,
        &mk("span", "2026-04-30T22:00:00Z", "2026-05-02T01:00:00Z"),
    )
    .unwrap();

    let items = repo::list_in_range(&conn, "2026-05-01", "2026-06-01").unwrap();
    let titles: Vec<&str> = items.iter().map(|s| s.title.as_str()).collect();
    assert_eq!(titles, vec!["span", "may1", "may31"]);
}

#[test]
fn update_patch_only_changes_supplied_fields() {
    let (_dir, conn) = fresh_conn();
    let s = repo::create(
        &conn,
        &mk("orig", "2026-05-20T09:00:00Z", "2026-05-20T10:00:00Z"),
    )
    .unwrap();

    let patched = repo::update(
        &conn,
        s.id,
        &UpdateSchedule {
            title: Some("renamed".into()),
            location: Some(Some("회의실 B".into())),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(patched.title, "renamed");
    assert_eq!(patched.location.as_deref(), Some("회의실 B"));
    assert_eq!(patched.start_at, s.start_at);
    assert_eq!(patched.end_at, s.end_at);
}

#[test]
fn update_can_clear_nullable_via_empty_string() {
    let (_dir, conn) = fresh_conn();
    let mut input = mk("orig", "2026-05-20T09:00:00Z", "2026-05-20T10:00:00Z");
    input.location = Some("초기 장소".into());
    let s = repo::create(&conn, &input).unwrap();

    let cleared = repo::update(
        &conn,
        s.id,
        &UpdateSchedule {
            location: Some(Some("".into())),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(cleared.location.is_none());
}

#[test]
fn update_rejects_inverted_range() {
    let (_dir, conn) = fresh_conn();
    let s = repo::create(
        &conn,
        &mk("ok", "2026-05-20T09:00:00Z", "2026-05-20T10:00:00Z"),
    )
    .unwrap();
    let err = repo::update(
        &conn,
        s.id,
        &UpdateSchedule {
            start_at: Some("2026-05-20T11:00:00Z".into()),
            ..Default::default()
        },
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn delete_then_get_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let s = repo::create(
        &conn,
        &mk("doomed", "2026-05-20T09:00:00Z", "2026-05-20T10:00:00Z"),
    )
    .unwrap();
    repo::delete(&conn, s.id).unwrap();
    let err = repo::get(&conn, s.id).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn delete_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::delete(&conn, 9999).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn update_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::update(&conn, 9999, &UpdateSchedule::default()).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}
