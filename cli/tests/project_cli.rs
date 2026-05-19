//! project CLI 통합 테스트.
//!
//! 데이터 격리: 각 테스트가 `WORKSPACE_HUB_DATA_DIR` 로 임시 디렉터리를 주입한다.

use assert_cmd::Command;
use predicates::str::contains;
use tempfile::TempDir;

fn cli(data_dir: &std::path::Path) -> Command {
    let mut cmd = Command::cargo_bin("workspace-hub").expect("workspace-hub binary");
    cmd.env("WORKSPACE_HUB_DATA_DIR", data_dir);
    cmd
}

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
