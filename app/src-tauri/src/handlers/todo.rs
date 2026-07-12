use workspace_hub_core::models::todo::{NewTodo, Todo};
use workspace_hub_core::repo;
use workspace_hub_core::repo::todo::TodoPatch;

use super::{
    core_err, lock_err, nullable_i64_patch, nullable_string_patch, parse_priority, parse_status,
    DeletedAck,
};
use crate::DbState;

#[tauri::command]
pub(crate) fn todo_list(
    state: tauri::State<DbState>,
    status: Option<String>,
) -> Result<Vec<Todo>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    let filter = match status.as_deref().unwrap_or("all") {
        "all" => None,
        s => Some(parse_status(s)?),
    };
    repo::todo::list(&conn, filter).map_err(core_err)
}

#[tauri::command]
pub(crate) fn todo_list_calendar_range(
    state: tauri::State<DbState>,
    from: String,
    to: String,
    completed_from: String,
    completed_to: String,
) -> Result<Vec<Todo>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::list_calendar_range(&conn, &from, &to, &completed_from, &completed_to)
        .map_err(core_err)
}

#[tauri::command]
pub(crate) fn todo_list_by_project(
    state: tauri::State<DbState>,
    project_id: i64,
) -> Result<Vec<Todo>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::list_by_project(&conn, project_id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn todo_add(
    state: tauri::State<DbState>,
    input: serde_json::Value,
) -> Result<Todo, String> {
    let title = input
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "title is required".to_string())?
        .to_string();
    let description = input
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from);
    let start_date = input
        .get("start_date")
        .and_then(|v| v.as_str())
        .map(String::from);
    let due_date = input
        .get("due_date")
        .or_else(|| input.get("due"))
        .and_then(|v| v.as_str())
        .map(String::from);
    let due_time = input.get("due_time").and_then(|v| v.as_i64());
    let priority = parse_priority(
        input
            .get("priority")
            .and_then(|v| v.as_str())
            .unwrap_or("mid"),
    )?;
    let workspace_id = input.get("workspace_id").and_then(|v| v.as_i64());
    let project_id = input.get("project_id").and_then(|v| v.as_i64());

    let new = NewTodo {
        workspace_id,
        project_id,
        title,
        description,
        start_date,
        due_date,
        due_time,
        priority,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
pub(crate) fn todo_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Todo, String> {
    let title = patch
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from);
    let description = nullable_string_patch(patch.get("description"));
    let start_date = patch
        .get("start_date")
        .and_then(|v| v.as_str())
        .map(String::from);
    let due_date = nullable_string_patch(patch.get("due_date").or_else(|| patch.get("due")));
    let due_time = patch.get("due_time").and_then(|v| v.as_i64());
    let priority = match patch.get("priority").and_then(|v| v.as_str()) {
        Some(s) => Some(parse_priority(s)?),
        None => None,
    };
    let status = match patch.get("status").and_then(|v| v.as_str()) {
        Some(s) => Some(parse_status(s)?),
        None => None,
    };
    let project_id = nullable_i64_patch(patch.get("project_id"));

    let tp = TodoPatch {
        title,
        description,
        start_date,
        due_date,
        due_time,
        priority,
        status,
        project_id,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::update(&conn, id, &tp).map_err(core_err)
}

#[tauri::command]
pub(crate) fn todo_complete(state: tauri::State<DbState>, id: i64) -> Result<Todo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::complete(&conn, id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn todo_uncomplete(state: tauri::State<DbState>, id: i64) -> Result<Todo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::uncomplete(&conn, id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn todo_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}
