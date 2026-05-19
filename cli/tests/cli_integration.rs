//! CLI 통합 테스트.
//!
//! **데이터 격리**: 각 테스트가 자체 `tempfile::TempDir` 를 만들어 `WORKSPACE_HUB_DATA_DIR`
//! env 로 주입한다. 따라서 사용자 머신의 `~/.workspace-hub/` 데이터에는 절대 영향을 주지 않는다.
//! `assert_cmd::Command` 가 부모 환경을 상속하므로, env override 만으로 충분히 격리된다.

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
fn version_outputs_json_with_core_and_cli_fields() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .arg("version")
        .assert()
        .success()
        .stdout(contains("\"core\""))
        .stdout(contains("\"cli\""));
}

#[test]
fn version_human_outputs_human_text() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["--human", "version"])
        .assert()
        .success()
        .stdout(contains("workspace-hub-core"));
}

#[test]
fn todo_add_emits_json_with_normalized_due() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args([
            "todo", "add", "--title", "intg test", "--priority", "high", "--due", "2026-05-20",
        ])
        .assert()
        .success()
        .stdout(contains("\"title\": \"intg test\""))
        .stdout(contains("\"priority\": \"high\""))
        .stdout(contains("\"due_at\": \"2026-05-20T00:00:00Z\""))
        .stdout(contains("\"status\": \"open\""));
}

#[test]
fn todo_list_after_add_returns_one_item() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["todo", "add", "--title", "x"])
        .assert()
        .success();
    cli(dir.path())
        .args(["todo", "list"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"x\""));
}

#[test]
fn todo_add_invalid_due_exits_with_user_error_code_1() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["todo", "add", "--title", "x", "--due", "not-a-date"])
        .assert()
        .code(1)
        .stderr(contains("parse error"));
}

#[test]
fn todo_add_priority_invalid_value_rejected_by_clap() {
    // priority 가 low/mid/high enum 으로 변경되어 clap 이 정적으로 검증한다 (V005).
    // clap 의 invalid-value 종료 코드는 2, stderr 에 "invalid value" + "priority" 가 포함된다.
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["todo", "add", "--title", "x", "--priority", "9"])
        .assert()
        .failure()
        .stderr(contains("invalid value"))
        .stderr(contains("priority"));
}

#[test]
fn todo_complete_then_uncomplete_round_trip() {
    let dir = TempDir::new().unwrap();
    let add = cli(dir.path())
        .args(["todo", "add", "--title", "cycle"])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let v: serde_json::Value = serde_json::from_slice(&add).unwrap();
    let id = v["id"].as_i64().unwrap().to_string();

    cli(dir.path())
        .args(["todo", "complete", &id])
        .assert()
        .success()
        .stdout(contains("\"status\": \"done\""));
    cli(dir.path())
        .args(["todo", "uncomplete", &id])
        .assert()
        .success()
        .stdout(contains("\"status\": \"open\""));
}

#[test]
fn todo_delete_then_get_via_list_excludes_it() {
    let dir = TempDir::new().unwrap();
    let add = cli(dir.path())
        .args(["todo", "add", "--title", "to-be-deleted"])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let v: serde_json::Value = serde_json::from_slice(&add).unwrap();
    let id = v["id"].as_i64().unwrap().to_string();

    cli(dir.path())
        .args(["todo", "delete", &id])
        .assert()
        .success();
    cli(dir.path())
        .args(["todo", "list"])
        .assert()
        .success()
        .stdout(predicates::str::contains("to-be-deleted").not());
}

#[test]
fn todo_complete_unknown_id_exits_with_user_error_code_1() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["todo", "complete", "9999"])
        .assert()
        .code(1)
        .stderr(contains("not found"));
}

#[test]
fn todo_list_filter_status_open_then_done() {
    let dir = TempDir::new().unwrap();

    // 두 개 추가 + 하나 완료
    let r1 = cli(dir.path())
        .args(["todo", "add", "--title", "alpha"])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let id1: i64 = serde_json::from_slice::<serde_json::Value>(&r1).unwrap()["id"]
        .as_i64()
        .unwrap();
    let _ = cli(dir.path())
        .args(["todo", "add", "--title", "beta"])
        .assert()
        .success();
    cli(dir.path())
        .args(["todo", "complete", &id1.to_string()])
        .assert()
        .success();

    cli(dir.path())
        .args(["todo", "list", "--status", "open"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"beta\""))
        .stdout(predicates::str::contains("alpha").not());

    cli(dir.path())
        .args(["todo", "list", "--status", "done"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"alpha\""))
        .stdout(predicates::str::contains("beta").not());
}

#[test]
fn data_dir_is_isolated_per_test() {
    // 다른 TempDir 두 개가 서로의 todo 를 보지 못해야 한다 — 격리 보증의 메타-테스트
    let a = TempDir::new().unwrap();
    let b = TempDir::new().unwrap();
    cli(a.path())
        .args(["todo", "add", "--title", "only-in-a"])
        .assert()
        .success();
    cli(b.path())
        .args(["todo", "list"])
        .assert()
        .success()
        .stdout(predicates::str::contains("only-in-a").not());
}
