//! project CLI 통합 테스트.
//!
//! 데이터 격리: 각 테스트가 `WORKSPACE_HUB_DATA_DIR` 로 임시 디렉터리를 주입한다.

use predicates::str::contains;
use tempfile::TempDir;

mod common;
use common::cli;

fn add_project(dir: &std::path::Path, title: &str) -> i64 {
    let out = cli(dir)
        .args(["project", "add", "--title", title])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
    v["id"].as_i64().unwrap()
}

fn add_application(
    dir: &std::path::Path,
    project_id: i64,
    path: &str,
    label: Option<&str>,
) -> serde_json::Value {
    let project_id = project_id.to_string();
    let mut args = vec![
        "project",
        "app",
        "add",
        "--project",
        &project_id,
        "--path",
        path,
    ];
    if let Some(label) = label {
        args.extend(["--label", label]);
    }
    let out = cli(dir)
        .args(args)
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    serde_json::from_slice(&out).unwrap()
}

#[test]
fn project_add_emits_json() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["project", "add", "--title", "hub"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"hub\""))
        .stdout(contains("\"color\": \"#3F3393\""));
}

#[test]
fn project_add_rejects_empty_title_with_user_error() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["project", "add", "--title", "   "])
        .assert()
        .code(1)
        .stderr(contains("title"));
}

#[test]
fn project_list_returns_added_items() {
    let dir = TempDir::new().unwrap();
    add_project(dir.path(), "alpha");
    add_project(dir.path(), "beta");
    cli(dir.path())
        .args(["project", "list"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"alpha\""))
        .stdout(contains("\"title\": \"beta\""));
}

#[test]
fn project_update_then_delete_round_trip() {
    let dir = TempDir::new().unwrap();
    let id = add_project(dir.path(), "orig");
    let id_str = id.to_string();
    cli(dir.path())
        .args(["project", "update", &id_str, "--title", "renamed"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"renamed\""));
    cli(dir.path())
        .args(["project", "delete", &id_str])
        .assert()
        .success();
    cli(dir.path())
        .args(["project", "get", &id_str])
        .assert()
        .code(1)
        .stderr(contains("not found"));
}

#[test]
fn project_dir_add_list_delete_round_trip() {
    let dir = TempDir::new().unwrap();
    let pid = add_project(dir.path(), "with-dirs");
    let pid_str = pid.to_string();

    let add = cli(dir.path())
        .args([
            "project",
            "dir",
            "add",
            "--project",
            &pid_str,
            "--path",
            "/Users/me/projects/with-dirs",
            "--label",
            "main",
        ])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let v: serde_json::Value = serde_json::from_slice(&add).unwrap();
    let did = v["id"].as_i64().unwrap().to_string();

    cli(dir.path())
        .args(["project", "dir", "list", "--project", &pid_str])
        .assert()
        .success()
        .stdout(contains("\"label\": \"main\""))
        .stdout(contains("\"path\": \"/Users/me/projects/with-dirs\""));

    cli(dir.path())
        .args(["project", "dir", "delete", &did])
        .assert()
        .success();
}

#[test]
fn project_dir_add_unknown_project_exit_1() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args([
            "project",
            "dir",
            "add",
            "--project",
            "9999",
            "--path",
            "/tmp/x",
        ])
        .assert()
        .code(1)
        .stderr(contains("not found"));
}

#[test]
fn project_delete_cascades_directories_via_cli() {
    let dir = TempDir::new().unwrap();
    let pid = add_project(dir.path(), "doomed");
    let pid_str = pid.to_string();

    cli(dir.path())
        .args([
            "project",
            "dir",
            "add",
            "--project",
            &pid_str,
            "--path",
            "/tmp/a",
        ])
        .assert()
        .success();
    cli(dir.path())
        .args([
            "project",
            "dir",
            "add",
            "--project",
            &pid_str,
            "--path",
            "/tmp/b",
        ])
        .assert()
        .success();

    cli(dir.path())
        .args(["project", "delete", &pid_str])
        .assert()
        .success();

    cli(dir.path())
        .args(["project", "dir", "list", "--project", &pid_str])
        .assert()
        .success()
        .stdout(contains("[]"));
}

#[test]
fn project_app_add_then_list_orders_by_id() {
    let dir = TempDir::new().unwrap();
    let project_id = add_project(dir.path(), "apps");
    let first = add_application(
        dir.path(),
        project_id,
        "/Applications/Terminal.app",
        Some("terminal"),
    );
    let second = add_application(
        dir.path(),
        project_id,
        "/Applications/Notes.app",
        Some("notes"),
    );
    assert_eq!(first["project_id"], project_id);
    assert_eq!(first["path"], "/Applications/Terminal.app");
    assert_eq!(first["label"], "terminal");
    assert_eq!(second["project_id"], project_id);
    assert_eq!(second["path"], "/Applications/Notes.app");
    assert_eq!(second["label"], "notes");

    let list = cli(dir.path())
        .args([
            "project",
            "app",
            "list",
            "--project",
            &project_id.to_string(),
        ])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let applications: Vec<serde_json::Value> = serde_json::from_slice(&list).unwrap();
    let ids: Vec<i64> = applications
        .iter()
        .map(|application| application["id"].as_i64().unwrap())
        .collect();
    assert_eq!(
        ids,
        vec![
            first["id"].as_i64().unwrap(),
            second["id"].as_i64().unwrap()
        ]
    );
    assert_eq!(applications[0]["project_id"], project_id);
    assert_eq!(applications[0]["path"], "/Applications/Terminal.app");
    assert_eq!(applications[0]["label"], "terminal");
    assert_eq!(applications[1]["project_id"], project_id);
    assert_eq!(applications[1]["path"], "/Applications/Notes.app");
    assert_eq!(applications[1]["label"], "notes");
}

#[test]
fn project_app_update_patches_only_requested_fields() {
    let dir = TempDir::new().unwrap();
    let project_id = add_project(dir.path(), "apps");
    let application = add_application(
        dir.path(),
        project_id,
        "/Applications/Terminal.app",
        Some("shell"),
    );

    cli(dir.path())
        .args([
            "project",
            "app",
            "update",
            &application["id"].as_i64().unwrap().to_string(),
            "--path",
            "/Applications/iTerm.app",
        ])
        .assert()
        .success()
        .stdout(contains("\"path\": \"/Applications/iTerm.app\""))
        .stdout(contains("\"label\": \"shell\""));
}

#[test]
fn project_app_delete_removes_item_from_list() {
    let dir = TempDir::new().unwrap();
    let project_id = add_project(dir.path(), "apps");
    let application = add_application(dir.path(), project_id, "/Applications/Terminal.app", None);

    cli(dir.path())
        .args([
            "project",
            "app",
            "delete",
            &application["id"].as_i64().unwrap().to_string(),
        ])
        .assert()
        .success();

    cli(dir.path())
        .args([
            "project",
            "app",
            "list",
            "--project",
            &project_id.to_string(),
        ])
        .assert()
        .success()
        .stdout(contains("[]"));
}

#[test]
fn project_app_add_rejects_empty_path() {
    let dir = TempDir::new().unwrap();
    let project_id = add_project(dir.path(), "apps");

    cli(dir.path())
        .args([
            "project",
            "app",
            "add",
            "--project",
            &project_id.to_string(),
            "--path",
            "   ",
        ])
        .assert()
        .code(1)
        .stderr(contains("path"));
}

#[test]
fn project_app_update_unknown_id_exits_1() {
    let dir = TempDir::new().unwrap();

    cli(dir.path())
        .args([
            "project",
            "app",
            "update",
            "9999",
            "--path",
            "/Applications/Terminal.app",
        ])
        .assert()
        .code(1)
        .stderr(contains("not found"));
}

#[test]
fn project_app_delete_unknown_id_exits_1() {
    let dir = TempDir::new().unwrap();

    cli(dir.path())
        .args(["project", "app", "delete", "9999"])
        .assert()
        .code(1)
        .stderr(contains("not found"));
}
