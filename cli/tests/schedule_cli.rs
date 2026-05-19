//! schedule CLI 통합 테스트.
//!
//! 데이터 격리: 각 테스트가 `WORKSPACE_HUB_DATA_DIR` 로 임시 디렉터리를 주입한다.

use assert_cmd::Command;
use predicates::prelude::*;
use predicates::str::contains;
use tempfile::TempDir;

fn cli(data_dir: &std::path::Path) -> Command {
    let mut cmd = Command::cargo_bin("workspace-hub").expect("workspace-hub binary");
    cmd.env("WORKSPACE_HUB_DATA_DIR", data_dir);
    cmd
}

#[test]
fn schedule_add_emits_json() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args([
            "schedule",
            "add",
            "--title",
            "standup",
            "--start",
            "2026-05-20T09:00:00Z",
            "--end",
            "2026-05-20T09:30:00Z",
        ])
        .assert()
        .success()
        .stdout(contains("\"title\": \"standup\""))
        .stdout(contains("\"start_at\": \"2026-05-20T09:00:00Z\""))
        .stdout(contains("\"end_at\": \"2026-05-20T09:30:00Z\""))
        .stdout(contains("\"all_day\": false"));
}

#[test]
fn schedule_add_invalid_dates_exit_1_user_error() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args([
            "schedule", "add", "--title", "x", "--start", "garbage", "--end", "2026-05-20",
        ])
        .assert()
        .code(1)
        .stderr(contains("parse error"));
}

#[test]
fn schedule_add_end_before_start_exit_1() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args([
            "schedule",
            "add",
            "--title",
            "x",
            "--start",
            "2026-05-20T10:00:00Z",
            "--end",
            "2026-05-20T09:00:00Z",
        ])
        .assert()
        .code(1)
        .stderr(contains("end_at"));
}

#[test]
fn schedule_list_range_filters_results() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args([
            "schedule",
            "add",
            "--title",
            "in",
            "--start",
            "2026-05-15T09:00:00Z",
            "--end",
            "2026-05-15T10:00:00Z",
        ])
        .assert()
        .success();
    cli(dir.path())
        .args([
            "schedule",
            "add",
            "--title",
            "out",
            "--start",
            "2026-06-15T09:00:00Z",
            "--end",
            "2026-06-15T10:00:00Z",
        ])
        .assert()
        .success();

    cli(dir.path())
        .args([
            "schedule", "list", "--from", "2026-05-01", "--to", "2026-06-01",
        ])
        .assert()
        .success()
        .stdout(contains("\"title\": \"in\""))
        .stdout(predicates::str::contains("\"title\": \"out\"").not());
}

#[test]
fn schedule_update_then_delete_round_trip() {
    let dir = TempDir::new().unwrap();
    let add = cli(dir.path())
        .args([
            "schedule",
            "add",
            "--title",
            "orig",
            "--start",
            "2026-05-20T09:00:00Z",
            "--end",
            "2026-05-20T10:00:00Z",
        ])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let v: serde_json::Value = serde_json::from_slice(&add).unwrap();
    let id = v["id"].as_i64().unwrap().to_string();

    cli(dir.path())
        .args(["schedule", "update", &id, "--title", "renamed"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"renamed\""));

    cli(dir.path())
        .args(["schedule", "delete", &id])
        .assert()
        .success();

    cli(dir.path())
        .args(["schedule", "get", &id])
        .assert()
        .code(1)
        .stderr(contains("not found"));
}
