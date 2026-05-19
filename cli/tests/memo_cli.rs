//! memo / memo-folder CLI 통합 테스트.
//! 데이터 격리: `WORKSPACE_HUB_DATA_DIR` 로 임시 디렉터리 주입.

use assert_cmd::Command;
use predicates::prelude::*;
use predicates::str::contains;
use tempfile::TempDir;

fn cli(data_dir: &std::path::Path) -> Command {
    let mut cmd = Command::cargo_bin("workspace-hub").expect("workspace-hub binary");
    cmd.env("WORKSPACE_HUB_DATA_DIR", data_dir);
    cmd
}

fn add_folder(dir: &std::path::Path, name: &str) -> i64 {
    let out = cli(dir)
        .args(["memo-folder", "add", "--name", name])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
    v["id"].as_i64().unwrap()
}

fn add_memo(dir: &std::path::Path, title: &str, body: &str, folder: Option<i64>) -> i64 {
    let mut args: Vec<String> = vec![
        "memo".into(),
        "add".into(),
        "--title".into(),
        title.into(),
        "--body".into(),
        body.into(),
    ];
    if let Some(f) = folder {
        args.push("--folder".into());
        args.push(f.to_string());
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = cli(dir).args(refs).assert().success().get_output().stdout.clone();
    let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
    v["id"].as_i64().unwrap()
}

#[test]
fn memo_add_emits_json() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args(["memo", "add", "--title", "hello", "--body", "world"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"hello\""))
        .stdout(contains("\"body\": \"world\""))
        .stdout(contains("\"pinned\": false"));
}

#[test]
fn memo_add_into_missing_folder_exits_1() {
    let dir = TempDir::new().unwrap();
    cli(dir.path())
        .args([
            "memo", "add", "--title", "x", "--body", "y", "--folder", "9999",
        ])
        .assert()
        .code(1)
        .stderr(contains("not found"));
}

#[test]
fn memo_list_root_vs_folder_filters_correctly() {
    let dir = TempDir::new().unwrap();
    let folder = add_folder(dir.path(), "Work");
    let _root_memo = add_memo(dir.path(), "root_memo", "", None);
    let _folder_memo = add_memo(dir.path(), "folder_memo", "", Some(folder));

    cli(dir.path())
        .args(["memo", "list", "--root"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"root_memo\""))
        .stdout(predicates::str::contains("\"title\": \"folder_memo\"").not());

    cli(dir.path())
        .args(["memo", "list", "--folder", &folder.to_string()])
        .assert()
        .success()
        .stdout(contains("\"title\": \"folder_memo\""))
        .stdout(predicates::str::contains("\"title\": \"root_memo\"").not());
}

#[test]
fn memo_delete_then_restore_round_trip() {
    let dir = TempDir::new().unwrap();
    let id = add_memo(dir.path(), "a", "", None);

    cli(dir.path())
        .args(["memo", "delete", &id.to_string()])
        .assert()
        .success()
        .stdout(contains("\"deleted_at\":"));

    // active 리스트에서 사라짐.
    cli(dir.path())
        .args(["memo", "list"])
        .assert()
        .success()
        .stdout(predicates::str::contains("\"title\": \"a\"").not());

    // 휴지통에 있음.
    cli(dir.path())
        .args(["memo", "list", "--trash"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"a\""));

    // 복원.
    cli(dir.path())
        .args(["memo", "restore", &id.to_string()])
        .assert()
        .success()
        .stdout(contains("\"deleted_at\": null"));
}

#[test]
fn memo_purge_requires_trash_state() {
    let dir = TempDir::new().unwrap();
    let id = add_memo(dir.path(), "a", "", None);

    // active 상태에서 purge → exit 1
    cli(dir.path())
        .args(["memo", "purge", &id.to_string()])
        .assert()
        .code(1)
        .stderr(contains("trash"));

    cli(dir.path())
        .args(["memo", "delete", &id.to_string()])
        .assert()
        .success();

    cli(dir.path())
        .args(["memo", "purge", &id.to_string()])
        .assert()
        .success()
        .stdout(contains("\"purged\":"));
}

#[test]
fn memo_empty_trash_clears_only_trashed() {
    let dir = TempDir::new().unwrap();
    let a = add_memo(dir.path(), "a", "", None);
    let _b = add_memo(dir.path(), "b", "", None);
    cli(dir.path()).args(["memo", "delete", &a.to_string()]).assert().success();

    cli(dir.path())
        .args(["memo", "empty-trash"])
        .assert()
        .success()
        .stdout(contains("\"purged_count\": 1"));

    // b 는 살아있음.
    cli(dir.path())
        .args(["memo", "list"])
        .assert()
        .success()
        .stdout(contains("\"title\": \"b\""));
}

#[test]
fn memo_folder_delete_moves_contained_memos_to_trash() {
    let dir = TempDir::new().unwrap();
    let folder = add_folder(dir.path(), "Personal");
    let memo_id = add_memo(dir.path(), "in_folder", "", Some(folder));

    cli(dir.path())
        .args(["memo-folder", "delete", &folder.to_string()])
        .assert()
        .success();

    cli(dir.path())
        .args(["memo", "list", "--trash"])
        .assert()
        .success()
        .stdout(contains(&format!("\"id\": {memo_id}")))
        .stdout(contains("\"folder_id\": null"));
}

#[test]
fn memo_folder_move_under_descendant_exits_1() {
    let dir = TempDir::new().unwrap();
    let a = add_folder(dir.path(), "A");
    // B under A
    cli(dir.path())
        .args([
            "memo-folder", "add", "--name", "B", "--parent", &a.to_string(),
        ])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let b_out = cli(dir.path())
        .args(["memo-folder", "list"])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let folders: Vec<serde_json::Value> = serde_json::from_slice(&b_out).unwrap();
    let b_id = folders
        .iter()
        .find(|f| f["name"] == "B")
        .unwrap()["id"]
        .as_i64()
        .unwrap();

    // A 를 B 아래로 이동 → 사이클.
    cli(dir.path())
        .args([
            "memo-folder",
            "move",
            &a.to_string(),
            "--parent",
            &b_id.to_string(),
        ])
        .assert()
        .code(1)
        .stderr(contains("descendant"));
}

#[test]
fn memo_update_can_pin_and_move_to_folder() {
    let dir = TempDir::new().unwrap();
    let folder = add_folder(dir.path(), "F");
    let id = add_memo(dir.path(), "a", "", None);

    cli(dir.path())
        .args([
            "memo",
            "update",
            &id.to_string(),
            "--pinned",
            "true",
            "--folder",
            &folder.to_string(),
        ])
        .assert()
        .success()
        .stdout(contains("\"pinned\": true"))
        .stdout(contains(&format!("\"folder_id\": {folder}")));
}
