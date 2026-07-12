use workspace_hub_core::models::schedule::{NewSchedule, Schedule, UpdateSchedule};
use workspace_hub_core::repo;

use super::{core_err, lock_err, nullable_string_patch, DeletedAck};
use crate::DbState;

#[tauri::command]
pub(crate) fn schedule_list_range(
    state: tauri::State<DbState>,
    from: String,
    to: String,
) -> Result<Vec<Schedule>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::list_in_range(&conn, &from, &to).map_err(core_err)
}

#[tauri::command]
pub(crate) fn schedule_get(state: tauri::State<DbState>, id: i64) -> Result<Schedule, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::get(&conn, id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn schedule_add(
    state: tauri::State<DbState>,
    input: serde_json::Value,
) -> Result<Schedule, String> {
    let title = input
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "title is required".to_string())?
        .to_string();
    let start_at = input
        .get("start")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "start is required".to_string())?
        .to_string();
    let end_at = input
        .get("end")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "end is required".to_string())?
        .to_string();
    let all_day = input
        .get("all_day")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let description = input
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from);
    let location = input
        .get("location")
        .and_then(|v| v.as_str())
        .map(String::from);
    let color = input
        .get("color")
        .and_then(|v| v.as_str())
        .map(String::from);

    let new = NewSchedule {
        title,
        description,
        location,
        start_at,
        end_at,
        all_day,
        color,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
pub(crate) fn schedule_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Schedule, String> {
    let title = patch
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from);
    let start_at = patch
        .get("start")
        .and_then(|v| v.as_str())
        .map(String::from);
    let end_at = patch.get("end").and_then(|v| v.as_str()).map(String::from);
    let all_day = patch.get("all_day").and_then(|v| v.as_bool());
    let description = nullable_string_patch(patch.get("description"));
    let location = nullable_string_patch(patch.get("location"));
    let color = nullable_string_patch(patch.get("color"));

    let up = UpdateSchedule {
        title,
        description,
        location,
        start_at,
        end_at,
        all_day,
        color,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
pub(crate) fn schedule_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}
