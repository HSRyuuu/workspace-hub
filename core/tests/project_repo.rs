//! project + project_directory repo 단위 테스트.
//!
//! schedule_repo.rs 와 동일한 격리 패턴 — `tempfile::TempDir` + `db::open_at()`.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::project::{
    NewProject, NewProjectDirectory, UpdateProject, UpdateProjectDirectory,
};
use workspace_hub_core::repo::{project as repo, project_directory as dir_repo};
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn mk(title: &str) -> NewProject {
    NewProject {
        title: title.into(),
        description: None,
        color: None,
        sort_order: None,
    }
}

#[test]
fn create_then_get_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(&conn, &mk("hub-app")).unwrap();
    assert!(p.id > 0);
    assert_eq!(p.title, "hub-app");
    assert_eq!(p.color, "#3F3393"); // 기본값
    assert_eq!(p.sort_order, 0);
    let got = repo::get(&conn, p.id).unwrap();
    assert_eq!(got.id, p.id);
}

#[test]
fn create_uses_supplied_color_and_sort_order() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(
        &conn,
        &NewProject {
            title: "x".into(),
            description: Some("memo".into()),
            color: Some("#ABCDEF".into()),
            sort_order: Some(5),
        },
    )
    .unwrap();
    assert_eq!(p.color, "#ABCDEF");
    assert_eq!(p.sort_order, 5);
    assert_eq!(p.description.as_deref(), Some("memo"));
}

#[test]
fn create_rejects_empty_title() {
    let (_dir, conn) = fresh_conn();
    let err = repo::create(&conn, &mk("   ")).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn create_blank_color_falls_back_to_default() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(
        &conn,
        &NewProject {
            title: "x".into(),
            color: Some("   ".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(p.color, "#3F3393");
}

#[test]
fn list_orders_by_sort_order_then_id() {
    let (_dir, conn) = fresh_conn();
    let a = repo::create(
        &conn,
        &NewProject {
            title: "a".into(),
            sort_order: Some(10),
            ..Default::default()
        },
    )
    .unwrap();
    let b = repo::create(
        &conn,
        &NewProject {
            title: "b".into(),
            sort_order: Some(5),
            ..Default::default()
        },
    )
    .unwrap();
    let c = repo::create(
        &conn,
        &NewProject {
            title: "c".into(),
            sort_order: Some(5),
            ..Default::default()
        },
    )
    .unwrap();
    let items = repo::list(&conn).unwrap();
    let ids: Vec<i64> = items.iter().map(|p| p.id).collect();
    assert_eq!(ids, vec![b.id, c.id, a.id]);
}

#[test]
fn update_patch_only_changes_supplied_fields() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(&conn, &mk("orig")).unwrap();
    let patched = repo::update(
        &conn,
        p.id,
        &UpdateProject {
            title: Some("renamed".into()),
            description: Some(Some("note".into())),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(patched.title, "renamed");
    assert_eq!(patched.description.as_deref(), Some("note"));
    assert_eq!(patched.color, p.color); // 손대지 않음
}

#[test]
fn update_can_clear_description_via_empty_string() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(
        &conn,
        &NewProject {
            title: "x".into(),
            description: Some("초기 설명".into()),
            ..Default::default()
        },
    )
    .unwrap();
    let cleared = repo::update(
        &conn,
        p.id,
        &UpdateProject {
            description: Some(Some("".into())),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(cleared.description.is_none());
}

#[test]
fn delete_cascades_directories() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(&conn, &mk("x")).unwrap();
    let d1 = dir_repo::create(
        &conn,
        &NewProjectDirectory {
            project_id: p.id,
            path: "/Users/me/projects/x".into(),
            label: Some("repo".into()),
        },
    )
    .unwrap();
    let d2 = dir_repo::create(
        &conn,
        &NewProjectDirectory {
            project_id: p.id,
            path: "/Users/me/docs/x".into(),
            label: None,
        },
    )
    .unwrap();

    repo::delete(&conn, p.id).unwrap();

    // CASCADE 로 두 디렉터리 모두 사라져야 한다.
    let err1 = dir_repo::get(&conn, d1.id).unwrap_err();
    let err2 = dir_repo::get(&conn, d2.id).unwrap_err();
    assert!(matches!(err1, CoreError::NotFound(_)));
    assert!(matches!(err2, CoreError::NotFound(_)));
}

#[test]
fn delete_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::delete(&conn, 9999).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)));
}

#[test]
fn dir_create_then_list_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(&conn, &mk("x")).unwrap();
    let d = dir_repo::create(
        &conn,
        &NewProjectDirectory {
            project_id: p.id,
            path: "/Users/me/projects/x".into(),
            label: Some("main repo".into()),
        },
    )
    .unwrap();
    assert_eq!(d.path, "/Users/me/projects/x");
    assert_eq!(d.label.as_deref(), Some("main repo"));

    let items = dir_repo::list_by_project(&conn, p.id).unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, d.id);
}

#[test]
fn dir_create_rejects_empty_path() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(&conn, &mk("x")).unwrap();
    let err = dir_repo::create(
        &conn,
        &NewProjectDirectory {
            project_id: p.id,
            path: "   ".into(),
            label: None,
        },
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)));
}

#[test]
fn dir_create_rejects_unknown_project() {
    let (_dir, conn) = fresh_conn();
    let err = dir_repo::create(
        &conn,
        &NewProjectDirectory {
            project_id: 9999,
            path: "/tmp/x".into(),
            label: None,
        },
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)));
}

#[test]
fn dir_update_patch_and_clear() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(&conn, &mk("x")).unwrap();
    let d = dir_repo::create(
        &conn,
        &NewProjectDirectory {
            project_id: p.id,
            path: "/old".into(),
            label: Some("old label".into()),
        },
    )
    .unwrap();
    let patched = dir_repo::update(
        &conn,
        d.id,
        &UpdateProjectDirectory {
            path: Some("/new".into()),
            label: Some(Some("".into())),
        },
    )
    .unwrap();
    assert_eq!(patched.path, "/new");
    assert!(patched.label.is_none());
}

#[test]
fn dir_delete_then_get_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let p = repo::create(&conn, &mk("x")).unwrap();
    let d = dir_repo::create(
        &conn,
        &NewProjectDirectory {
            project_id: p.id,
            path: "/x".into(),
            label: None,
        },
    )
    .unwrap();
    dir_repo::delete(&conn, d.id).unwrap();
    let err = dir_repo::get(&conn, d.id).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)));
}
