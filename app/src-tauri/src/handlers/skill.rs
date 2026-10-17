use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

/// 설치 대상 하위 폴더 이름. `~/.claude/skills/<이름>`, `~/.codex/skills/<이름>`.
const SKILL_NAME: &str = "workspace-hub";
/// 스킬 본문 템플릿. `{{CLI}}` 를 번들 CLI 절대경로로 치환해 설치한다.
const SKILL_TEMPLATE: &str = include_str!("../../../../skill/SKILL.md");
/// tauri.conf.json `externalBin` 이 실행 파일 옆에 놓는 CLI 이름.
const CLI_BIN: &str = "workspace-hub-cli";

#[derive(Serialize)]
pub(crate) struct SkillTarget {
    id: &'static str,
    label: &'static str,
    dir: String,
    installed: bool,
    /// 설치본이 현재 앱의 SKILL.md·CLI 명세와 다르면 true.
    outdated: bool,
}

const TARGETS: [(&str, &str, &str); 2] = [
    ("claude", "Claude Code", ".claude"),
    ("codex", "Codex", ".codex"),
];

fn home() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME env var is missing".to_string())
}

fn skill_dir(target: &str) -> Result<PathBuf, String> {
    let (_, _, root) = TARGETS
        .iter()
        .find(|(id, _, _)| *id == target)
        .ok_or_else(|| format!("unknown skill target: {target}"))?;
    Ok(home()?.join(root).join("skills").join(SKILL_NAME))
}

fn cli_path() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    let cli = exe.with_file_name(CLI_BIN);
    if !cli.exists() {
        return Err(format!("bundled CLI not found: {}", cli.display()));
    }
    Ok(cli)
}

/// 번들 CLI 의 `spec` 을 실행해 최신 명세를 얻는다.
fn generate_spec(cli: &Path) -> Result<String, String> {
    let out = Command::new(cli)
        .arg("spec")
        .output()
        .map_err(|e| format!("failed to run `{} spec`: {e}", cli.display()))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    String::from_utf8(out.stdout).map_err(|e| e.to_string())
}

/// (SKILL.md, references/cli-spec.md) 내용.
fn render(cli: &Path, spec: String) -> (String, String) {
    (
        SKILL_TEMPLATE.replace("{{CLI}}", &cli.display().to_string()),
        spec,
    )
}

fn is_outdated(dir: &Path, (skill, spec): &(String, String)) -> bool {
    fs::read_to_string(dir.join("SKILL.md")).ok().as_ref() != Some(skill)
        || fs::read_to_string(dir.join("references/cli-spec.md")).ok().as_ref() != Some(spec)
}

fn write_skill(dir: &Path, (skill, spec): &(String, String)) -> Result<(), String> {
    let io = |e: std::io::Error| format!("failed to write skill to {}: {e}", dir.display());
    fs::create_dir_all(dir.join("references")).map_err(io)?;
    fs::write(dir.join("SKILL.md"), skill).map_err(io)?;
    fs::write(dir.join("references/cli-spec.md"), spec).map_err(io)
}

/// 설치 대상별 설치·최신 여부.
#[tauri::command]
pub(crate) fn skill_targets() -> Result<Vec<SkillTarget>, String> {
    let cli = cli_path()?;
    let files = render(&cli, generate_spec(&cli)?);
    TARGETS
        .iter()
        .map(|(id, label, _)| {
            let dir = skill_dir(id)?;
            let installed = dir.join("SKILL.md").exists();
            Ok(SkillTarget {
                id,
                label,
                installed,
                outdated: installed && is_outdated(&dir, &files),
                dir: dir.display().to_string(),
            })
        })
        .collect()
}

/// 설치와 CLI 명세 업데이트를 겸한다 — SKILL.md·references/cli-spec.md 를 현재 앱 기준으로 덮어쓴다.
#[tauri::command]
pub(crate) fn skill_install(target: String) -> Result<(), String> {
    let cli = cli_path()?;
    write_skill(&skill_dir(&target)?, &render(&cli, generate_spec(&cli)?))
}

#[tauri::command]
pub(crate) fn skill_uninstall(target: String) -> Result<(), String> {
    let dir = skill_dir(&target)?;
    fs::remove_dir_all(&dir).map_err(|e| format!("failed to remove {}: {e}", dir.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_skill_then_not_outdated_until_spec_changes() {
        let dir = std::env::temp_dir().join(format!("wh-skill-test-{}", std::process::id()));
        let files = render(Path::new("/x/workspace-hub-cli"), "spec v1".into());
        write_skill(&dir, &files).unwrap();

        let skill = fs::read_to_string(dir.join("SKILL.md")).unwrap();
        assert!(skill.contains("CLI=/x/workspace-hub-cli"));
        assert!(!skill.contains("{{CLI}}"));
        assert!(!is_outdated(&dir, &files));
        assert!(is_outdated(&dir, &render(Path::new("/x/workspace-hub-cli"), "spec v2".into())));

        fs::remove_dir_all(&dir).unwrap();
    }
}
