use workspace_hub_core::models::memo::{
    Memo, MemoFolder, NewMemo, NewMemoFolder, UpdateMemo, UpdateMemoFolder,
};
use workspace_hub_core::models::project::Project;
use workspace_hub_core::repo;
use workspace_hub_core::repo::memo::ListScope;

use super::{core_err, lock_err, DeletedAck, PurgedCountAck};
use crate::DbState;

#[tauri::command]
pub(crate) fn memo_list(
    state: tauri::State<DbState>,
    scope: Option<String>,
    folder_id: Option<i64>,
) -> Result<Vec<Memo>, String> {
    let scope_str = scope.unwrap_or_else(|| "active".into());
    let scope_val = match scope_str.as_str() {
        "active" => ListScope::AllActive,
        "trash" => ListScope::Trash,
        "root" => ListScope::Folder(None),
        "folder" => {
            let fid = folder_id.ok_or_else(|| "folder scope requires folder_id".to_string())?;
            ListScope::Folder(Some(fid))
        }
        other => return Err(format!("unknown scope: {other}")),
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::list(&conn, scope_val).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_get(state: tauri::State<DbState>, id: i64) -> Result<Memo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::get(&conn, id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_add(
    state: tauri::State<DbState>,
    input: serde_json::Value,
) -> Result<Memo, String> {
    let title = input
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let body = input
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let folder_id = input.get("folder_id").and_then(|v| v.as_i64());

    let new = NewMemo {
        folder_id,
        title,
        body,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Memo, String> {
    let title = patch
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from);
    let body = patch.get("body").and_then(|v| v.as_str()).map(String::from);
    let pinned = patch.get("pinned").and_then(|v| v.as_bool());
    let folder_id = match patch.get("folder_id") {
        None => None,
        Some(v) if v.is_null() => Some(None),
        Some(v) => match v.as_i64() {
            Some(n) => Some(Some(n)),
            None => None,
        },
    };

    let up = UpdateMemo {
        folder_id,
        title,
        body,
        pinned,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_delete(state: tauri::State<DbState>, id: i64) -> Result<Memo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::soft_delete(&conn, id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_restore(state: tauri::State<DbState>, id: i64) -> Result<Memo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::restore(&conn, id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_purge(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::purge(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
pub(crate) fn memo_empty_trash(state: tauri::State<DbState>) -> Result<PurgedCountAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    let count = repo::memo::empty_trash(&conn).map_err(core_err)?;
    Ok(PurgedCountAck {
        purged_count: count,
    })
}

#[tauri::command]
pub(crate) fn memo_folder_list(state: tauri::State<DbState>) -> Result<Vec<MemoFolder>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::list_all(&conn).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_folder_add(
    state: tauri::State<DbState>,
    input: serde_json::Value,
) -> Result<MemoFolder, String> {
    let name = input
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "name is required".to_string())?
        .to_string();
    let parent_id = input.get("parent_id").and_then(|v| v.as_i64());

    let new = NewMemoFolder { parent_id, name };
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::create(&mut conn, &new).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_folder_rename(
    state: tauri::State<DbState>,
    id: i64,
    name: String,
) -> Result<MemoFolder, String> {
    let patch = UpdateMemoFolder {
        name: Some(name),
        parent_id: None,
    };
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::update(&mut conn, id, &patch).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_folder_move(
    state: tauri::State<DbState>,
    id: i64,
    parent_id: Option<i64>,
) -> Result<MemoFolder, String> {
    let patch = UpdateMemoFolder {
        name: None,
        parent_id: Some(parent_id),
    };
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::update(&mut conn, id, &patch).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_folder_delete(
    state: tauri::State<DbState>,
    id: i64,
) -> Result<DeletedAck, String> {
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::delete(&mut conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
pub(crate) fn memo_folder_reorder(
    state: tauri::State<DbState>,
    parent_id: Option<i64>,
    ordered_ids: Vec<i64>,
) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::reorder(&mut conn, parent_id, &ordered_ids).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_project_list_projects(
    state: tauri::State<DbState>,
    memo_id: i64,
) -> Result<Vec<Project>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::list_projects_for_memo(&conn, memo_id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_project_list_memos(
    state: tauri::State<DbState>,
    project_id: i64,
) -> Result<Vec<Memo>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::list_memos_for_project(&conn, project_id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_project_link(
    state: tauri::State<DbState>,
    memo_id: i64,
    project_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::link(&conn, memo_id, project_id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn memo_project_unlink(
    state: tauri::State<DbState>,
    memo_id: i64,
    project_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::unlink(&conn, memo_id, project_id).map_err(core_err)
}
