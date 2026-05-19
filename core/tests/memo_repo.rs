//! memo repo 단위 테스트.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::memo::{NewMemo, NewMemoFolder, UpdateMemo};
use workspace_hub_core::repo::memo::{self as repo, ListScope};
use workspace_hub_core::repo::memo_folder as folder_repo;
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn mk(folder_id: Option<i64>, title: &str, body: &str) -> NewMemo {
    NewMemo {
        folder_id,
        title: title.into(),
        body: body.into(),
    }
}

#[test]
fn create_then_get_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let m = repo::create(&conn, &mk(None, "hello", "world")).unwrap();
    assert!(m.id > 0);
    assert_eq!(m.title, "hello");
    assert_eq!(m.body, "world");
    assert!(!m.pinned);
    assert!(m.deleted_at.is_none());
    assert!(m.folder_id.is_none());

    let got = repo::get(&conn, m.id).unwrap();
    assert_eq!(got.id, m.id);
}

#[test]
fn create_allows_empty_title_and_empty_body() {
    let (_dir, conn) = fresh_conn();
    let m = repo::create(&conn, &mk(None, "", "")).unwrap();
    assert_eq!(m.title, "");
    assert_eq!(m.body, "");
}

#[test]
fn create_rejects_nonexistent_folder() {
    let (_dir, conn) = fresh_conn();
    let err = repo::create(&conn, &mk(Some(9999), "x", "y")).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn list_active_excludes_trash() {
    let (_dir, conn) = fresh_conn();
    let a = repo::create(&conn, &mk(None, "a", "")).unwrap();
    let b = repo::create(&conn, &mk(None, "b", "")).unwrap();
    repo::soft_delete(&conn, a.id).unwrap();

    let active = repo::list(&conn, ListScope::AllActive).unwrap();
    let titles: Vec<&str> = active.iter().map(|m| m.title.as_str()).collect();
    assert_eq!(titles, vec!["b"]);
    let _ = b;
}

#[test]
fn list_folder_root_filters_to_null_folder_only() {
    let (_dir, mut conn) = fresh_conn();
    let folder = folder_repo::create(
        &mut conn,
        &NewMemoFolder {
            parent_id: None,
            name: "F".into(),
        },
    )
    .unwrap();

    let _root = repo::create(&conn, &mk(None, "root_memo", "")).unwrap();
    let _in_folder = repo::create(&conn, &mk(Some(folder.id), "in_folder", "")).unwrap();

    let root_list = repo::list(&conn, ListScope::Folder(None)).unwrap();
    let folder_list = repo::list(&conn, ListScope::Folder(Some(folder.id))).unwrap();

    assert_eq!(root_list.len(), 1);
    assert_eq!(root_list[0].title, "root_memo");
    assert_eq!(folder_list.len(), 1);
    assert_eq!(folder_list[0].title, "in_folder");
}

#[test]
fn list_trash_only_returns_deleted() {
    let (_dir, conn) = fresh_conn();
    let a = repo::create(&conn, &mk(None, "a", "")).unwrap();
    let _b = repo::create(&conn, &mk(None, "b", "")).unwrap();
    repo::soft_delete(&conn, a.id).unwrap();

    let trash = repo::list(&conn, ListScope::Trash).unwrap();
    assert_eq!(trash.len(), 1);
    assert_eq!(trash[0].title, "a");
    assert!(trash[0].deleted_at.is_some());
}

#[test]
fn list_active_sorts_pinned_first_then_updated_desc() {
    let (_dir, conn) = fresh_conn();
    let a = repo::create(&conn, &mk(None, "a", "")).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(1100));
    let b = repo::create(&conn, &mk(None, "b", "")).unwrap();
    // a 를 핀.
    repo::update(
        &conn,
        a.id,
        &UpdateMemo {
            pinned: Some(true),
            ..Default::default()
        },
    )
    .unwrap();

    let list = repo::list(&conn, ListScope::AllActive).unwrap();
    let titles: Vec<&str> = list.iter().map(|m| m.title.as_str()).collect();
    // pinned a 가 먼저, 그 다음 b.
    assert_eq!(titles, vec!["a", "b"]);
    let _ = b;
}

#[test]
fn update_changes_fields_individually() {
    let (_dir, conn) = fresh_conn();
    let m = repo::create(&conn, &mk(None, "orig title", "orig body")).unwrap();
    let updated = repo::update(
        &conn,
        m.id,
        &UpdateMemo {
            title: Some("renamed".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(updated.title, "renamed");
    assert_eq!(updated.body, "orig body");
}

#[test]
fn update_can_move_to_folder() {
    let (_dir, mut conn) = fresh_conn();
    let folder = folder_repo::create(
        &mut conn,
        &NewMemoFolder {
            parent_id: None,
            name: "F".into(),
        },
    )
    .unwrap();
    let m = repo::create(&conn, &mk(None, "x", "")).unwrap();

    let moved = repo::update(
        &conn,
        m.id,
        &UpdateMemo {
            folder_id: Some(Some(folder.id)),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(moved.folder_id, Some(folder.id));
}

#[test]
fn soft_delete_then_restore_round_trip() {
    let (_dir, conn) = fresh_conn();
    let m = repo::create(&conn, &mk(None, "x", "")).unwrap();

    let deleted = repo::soft_delete(&conn, m.id).unwrap();
    assert!(deleted.deleted_at.is_some());

    let restored = repo::restore(&conn, m.id).unwrap();
    assert!(restored.deleted_at.is_none());
}

#[test]
fn soft_delete_rejects_already_trashed() {
    let (_dir, conn) = fresh_conn();
    let m = repo::create(&conn, &mk(None, "x", "")).unwrap();
    repo::soft_delete(&conn, m.id).unwrap();
    let err = repo::soft_delete(&conn, m.id).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn restore_rejects_active_memo() {
    let (_dir, conn) = fresh_conn();
    let m = repo::create(&conn, &mk(None, "x", "")).unwrap();
    let err = repo::restore(&conn, m.id).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn purge_requires_trash_state() {
    let (_dir, conn) = fresh_conn();
    let m = repo::create(&conn, &mk(None, "x", "")).unwrap();
    let err = repo::purge(&conn, m.id).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");

    repo::soft_delete(&conn, m.id).unwrap();
    repo::purge(&conn, m.id).unwrap();
    assert!(matches!(
        repo::get(&conn, m.id).unwrap_err(),
        CoreError::NotFound(_)
    ));
}

#[test]
fn empty_trash_removes_all_deleted_only() {
    let (_dir, conn) = fresh_conn();
    let a = repo::create(&conn, &mk(None, "a", "")).unwrap();
    let b = repo::create(&conn, &mk(None, "b", "")).unwrap();
    repo::soft_delete(&conn, a.id).unwrap();

    let count = repo::empty_trash(&conn).unwrap();
    assert_eq!(count, 1);

    // 활성 b 는 살아있음.
    assert!(repo::get(&conn, b.id).is_ok());
    assert!(matches!(
        repo::get(&conn, a.id).unwrap_err(),
        CoreError::NotFound(_)
    ));
}

#[test]
fn get_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::get(&conn, 9999).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}
