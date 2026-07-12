use assert_cmd::Command;

pub fn cli(data_dir: &std::path::Path) -> Command {
    let mut cmd = Command::cargo_bin("workspace-hub").expect("workspace-hub binary");
    cmd.env("WORKSPACE_HUB_DATA_DIR", data_dir);
    cmd
}
