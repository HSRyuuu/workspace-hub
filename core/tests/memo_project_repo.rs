//! memo_project repo unit tests.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::memo::{NewMemo, UpdateMemo};
use workspace_hub_core::models::project::NewProject;
use workspace_hub_core::repo::{memo as memo_repo, memo_project as repo, project as project_repo};
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn create_memo(conn: &Connection, title: &str) -> i64 {
    memo_repo::create(
        conn,
        &NewMemo {
            folder_id: None,
            title: title.into(),
            body: String::new(),
        },
    )
    .unwrap()
    .id
}

fn create_project(conn: &Connection, title: &str, sort_order: i64) -> i64 {
    project_repo::create(
        conn,
        &NewProject {
            title: title.into(),
            sort_order: Some(sort_order),
            ..Default::default()
        },
    )
    .unwrap()
    .id
}

#[test]
fn link_is_visible_from_both_sides() {
    let (_dir, conn) = fresh_conn();
    let memo_id = create_memo(&conn, "memo");
    let project_id = create_project(&conn, "project", 0);

    repo::link(&conn, memo_id, project_id).unwrap();

    let projects = repo::list_projects_for_memo(&conn, memo_id).unwrap();
    let memos = repo::list_memos_for_project(&conn, project_id).unwrap();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].id, project_id);
    assert_eq!(memos.len(), 1);
    assert_eq!(memos[0].id, memo_id);
}

#[test]
fn duplicate_link_is_idempotent() {
    let (_dir, conn) = fresh_conn();
    let memo_id = create_memo(&conn, "memo");
    let project_id = create_project(&conn, "project", 0);

    repo::link(&conn, memo_id, project_id).unwrap();
    repo::link(&conn, memo_id, project_id).unwrap();

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM memo_project WHERE memo_id = ?1 AND project_id = ?2",
            (memo_id, project_id),
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn link_rejects_unknown_memo() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "project", 0);

    let err = repo::link(&conn, 9999, project_id).unwrap_err();

    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn link_rejects_unknown_project() {
    let (_dir, conn) = fresh_conn();
    let memo_id = create_memo(&conn, "memo");

    let err = repo::link(&conn, memo_id, 9999).unwrap_err();

    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn unlink_removes_link_and_missing_link_is_noop() {
    let (_dir, conn) = fresh_conn();
    let memo_id = create_memo(&conn, "memo");
    let project_id = create_project(&conn, "project", 0);
    repo::link(&conn, memo_id, project_id).unwrap();

    repo::unlink(&conn, memo_id, project_id).unwrap();
    repo::unlink(&conn, memo_id, project_id).unwrap();

    assert!(repo::list_projects_for_memo(&conn, memo_id)
        .unwrap()
        .is_empty());
}

#[test]
fn list_projects_for_memo_orders_by_sort_order_then_id() {
    let (_dir, conn) = fresh_conn();
    let memo_id = create_memo(&conn, "memo");
    let last_id = create_project(&conn, "last", 10);
    let first_id = create_project(&conn, "first", 5);
    let second_id = create_project(&conn, "second", 5);
    repo::link(&conn, memo_id, last_id).unwrap();
    repo::link(&conn, memo_id, second_id).unwrap();
    repo::link(&conn, memo_id, first_id).unwrap();

    let ids: Vec<i64> = repo::list_projects_for_memo(&conn, memo_id)
        .unwrap()
        .into_iter()
        .map(|project| project.id)
        .collect();

    assert_eq!(ids, vec![first_id, second_id, last_id]);
}

#[test]
fn list_memos_for_project_excludes_deleted_and_orders_pinned_first() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "project", 0);
    let unpinned_id = create_memo(&conn, "unpinned");
    let pinned_id = create_memo(&conn, "pinned");
    let deleted_id = create_memo(&conn, "deleted");
    memo_repo::update(
        &conn,
        pinned_id,
        &UpdateMemo {
            pinned: Some(true),
            ..Default::default()
        },
    )
    .unwrap();
    memo_repo::soft_delete(&conn, deleted_id).unwrap();
    repo::link(&conn, unpinned_id, project_id).unwrap();
    repo::link(&conn, pinned_id, project_id).unwrap();
    repo::link(&conn, deleted_id, project_id).unwrap();

    let ids: Vec<i64> = repo::list_memos_for_project(&conn, project_id)
        .unwrap()
        .into_iter()
        .map(|memo| memo.id)
        .collect();

    assert_eq!(ids, vec![pinned_id, unpinned_id]);
}

#[test]
fn list_memos_for_project_orders_same_pinned_by_updated_at_desc() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "project", 0);
    let recently_updated_id = create_memo(&conn, "older");
    let other_id = create_memo(&conn, "other");
    repo::link(&conn, recently_updated_id, project_id).unwrap();
    repo::link(&conn, other_id, project_id).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(1100));
    memo_repo::update(
        &conn,
        recently_updated_id,
        &UpdateMemo {
            title: Some("recently updated".into()),
            ..Default::default()
        },
    )
    .unwrap();

    let ids: Vec<i64> = repo::list_memos_for_project(&conn, project_id)
        .unwrap()
        .into_iter()
        .map(|memo| memo.id)
        .collect();

    assert_eq!(ids, vec![recently_updated_id, other_id]);
}
