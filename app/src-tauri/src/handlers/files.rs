use std::process::Command;

use workspace_hub_core::models::file_explorer::FileExplorerFolder;
use workspace_hub_core::repo;

use super::{core_err, lock_err, DeletedAck};
use crate::DbState;

#[tauri::command]
pub(crate) fn files_folder_list(
    state: tauri::State<DbState>,
) -> Result<Vec<FileExplorerFolder>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::list(&conn).map_err(core_err)
}

#[tauri::command]
pub(crate) fn files_folder_touch(
    state: tauri::State<DbState>,
    path: String,
) -> Result<Option<FileExplorerFolder>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::touch(&conn, &path).map_err(core_err)
}

#[tauri::command]
pub(crate) fn files_folder_set_favorite(
    state: tauri::State<DbState>,
    id: i64,
    favorite: bool,
) -> Result<FileExplorerFolder, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::set_favorite(&conn, id, favorite).map_err(core_err)
}

#[tauri::command]
pub(crate) fn files_folder_remove(
    state: tauri::State<DbState>,
    id: i64,
) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::remove(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
pub(crate) fn open_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to open `{path}`: {e}"))
}

/// macOS `open -R` 로 Finder 에서 해당 항목을 선택한 채 띄운다(reveal).
/// 파일이면 상위 폴더를 열어 그 파일을 하이라이트, 폴더면 상위에서 그 폴더를 선택한다.
#[tauri::command]
pub(crate) fn reveal_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to reveal `{path}`: {e}"))
}

/// macOS `open` 로 URL 을 기본 브라우저에서 연다.
#[tauri::command]
pub(crate) fn open_url(url: String) -> Result<(), String> {
    let url = url.trim();
    let lower = url.to_ascii_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        return Err(format!("unsupported url: {url}"));
    }
    Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to open url `{url}`: {e}"))
}
