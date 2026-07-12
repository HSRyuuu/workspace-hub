//! project_application repo unit tests.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::project::{
    NewProject, NewProjectApplication, UpdateProjectApplication,
};
use workspace_hub_core::repo::{project as project_repo, project_application as repo};
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn create_project(conn: &Connection, title: &str) -> i64 {
    project_repo::create(
        conn,
        &NewProject {
            title: title.into(),
            ..Default::default()
        },
    )
    .unwrap()
    .id
}

#[test]
fn create_then_get_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "hub-app");
    let application = repo::create(
        &conn,
        &NewProjectApplication {
            project_id,
            path: "  /Applications/Visual Studio Code.app  ".into(),
            label: Some("Editor".into()),
        },
    )
    .unwrap();

    let got = repo::get(&conn, application.id).unwrap();
    assert_eq!(got.id, application.id);
    assert_eq!(got.project_id, project_id);
    assert_eq!(got.path, "/Applications/Visual Studio Code.app");
    assert_eq!(got.label.as_deref(), Some("Editor"));
}

#[test]
fn create_rejects_empty_path() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "hub-app");

    let err = repo::create(
        &conn,
        &NewProjectApplication {
            project_id,
            path: "   ".into(),
            label: None,
        },
    )
    .unwrap_err();

    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn create_rejects_unknown_project() {
    let (_dir, conn) = fresh_conn();

    let err = repo::create(
        &conn,
        &NewProjectApplication {
            project_id: 9999,
            path: "/Applications/Terminal.app".into(),
            label: None,
        },
    )
    .unwrap_err();

    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn create_normalizes_empty_label_to_none() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "hub-app");

    let application = repo::create(
        &conn,
        &NewProjectApplication {
            project_id,
            path: "/Applications/Terminal.app".into(),
            label: Some("   ".into()),
        },
    )
    .unwrap();

    assert!(application.label.is_none());
}

#[test]
fn get_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();

    let err = repo::get(&conn, 9999).unwrap_err();

    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn list_by_project_filters_and_orders_by_id() {
    let (_dir, conn) = fresh_conn();
    let first_project_id = create_project(&conn, "first");
    let second_project_id = create_project(&conn, "second");
    let first = repo::create(
        &conn,
        &NewProjectApplication {
            project_id: first_project_id,
            path: "/Applications/Terminal.app".into(),
            label: None,
        },
    )
    .unwrap();
    let _other = repo::create(
        &conn,
        &NewProjectApplication {
            project_id: second_project_id,
            path: "/Applications/Notes.app".into(),
            label: None,
        },
    )
    .unwrap();
    let second = repo::create(
        &conn,
        &NewProjectApplication {
            project_id: first_project_id,
            path: "/Applications/Calendar.app".into(),
            label: None,
        },
    )
    .unwrap();

    let ids: Vec<i64> = repo::list_by_project(&conn, first_project_id)
        .unwrap()
        .into_iter()
        .map(|application| application.id)
        .collect();

    assert_eq!(ids, vec![first.id, second.id]);
}

#[test]
fn update_changes_path_and_clears_label() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "hub-app");
    let application = repo::create(
        &conn,
        &NewProjectApplication {
            project_id,
            path: "/Applications/Terminal.app".into(),
            label: Some("Shell".into()),
        },
    )
    .unwrap();

    let updated = repo::update(
        &conn,
        application.id,
        &UpdateProjectApplication {
            path: Some("  /Applications/iTerm.app  ".into()),
            label: Some(Some("".into())),
        },
    )
    .unwrap();

    assert_eq!(updated.path, "/Applications/iTerm.app");
    assert!(updated.label.is_none());
}

#[test]
fn update_rejects_empty_path() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "hub-app");
    let application = repo::create(
        &conn,
        &NewProjectApplication {
            project_id,
            path: "/Applications/Terminal.app".into(),
            label: None,
        },
    )
    .unwrap();

    let empty_path_err = repo::update(
        &conn,
        application.id,
        &UpdateProjectApplication {
            path: Some("   ".into()),
            label: None,
        },
    )
    .unwrap_err();
    assert!(matches!(empty_path_err, CoreError::InvalidInput(_)));
}

#[test]
fn update_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();

    let unknown_id_err =
        repo::update(&conn, 9999, &UpdateProjectApplication::default()).unwrap_err();

    assert!(matches!(unknown_id_err, CoreError::NotFound(_)));
}

#[test]
fn delete_then_get_returns_not_found() {
    let (_dir, conn) = fresh_conn();
    let project_id = create_project(&conn, "hub-app");
    let application = repo::create(
        &conn,
        &NewProjectApplication {
            project_id,
            path: "/Applications/Terminal.app".into(),
            label: None,
        },
    )
    .unwrap();

    repo::delete(&conn, application.id).unwrap();

    assert!(matches!(
        repo::get(&conn, application.id).unwrap_err(),
        CoreError::NotFound(_)
    ));
}

#[test]
fn delete_nonexistent_returns_not_found() {
    let (_dir, conn) = fresh_conn();

    assert!(matches!(
        repo::delete(&conn, 9999).unwrap_err(),
        CoreError::NotFound(_)
    ));
}
