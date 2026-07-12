use workspace_hub_core::models::project::{
    NewProject, NewProjectApplication, NewProjectDirectory, Project, ProjectApplication,
    ProjectDirectory, UpdateProject, UpdateProjectApplication, UpdateProjectDirectory,
};
use workspace_hub_core::repo;

use super::{core_err, lock_err, nullable_string_patch, DeletedAck};
use crate::DbState;

#[tauri::command]
pub(crate) fn project_list(state: tauri::State<DbState>) -> Result<Vec<Project>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::list(&conn).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_get(state: tauri::State<DbState>, id: i64) -> Result<Project, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::get(&conn, id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_add(
    state: tauri::State<DbState>,
    input: serde_json::Value,
) -> Result<Project, String> {
    let title = input
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "title is required".to_string())?
        .to_string();
    let description = input
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from);
    let color = input
        .get("color")
        .and_then(|v| v.as_str())
        .map(String::from);
    let sort_order = input.get("sort_order").and_then(|v| v.as_i64());

    let new = NewProject {
        title,
        description,
        color,
        sort_order,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Project, String> {
    let title = patch
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from);
    let color = patch
        .get("color")
        .and_then(|v| v.as_str())
        .map(String::from);
    let sort_order = patch.get("sort_order").and_then(|v| v.as_i64());
    let description = nullable_string_patch(patch.get("description"));

    let up = UpdateProject {
        title,
        description,
        color,
        sort_order,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
pub(crate) fn project_dir_list(
    state: tauri::State<DbState>,
    project_id: i64,
) -> Result<Vec<ProjectDirectory>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_directory::list_by_project(&conn, project_id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_dir_add(
    state: tauri::State<DbState>,
    input: serde_json::Value,
) -> Result<ProjectDirectory, String> {
    let project_id = input
        .get("project_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "project_id is required".to_string())?;
    let path = input
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "path is required".to_string())?
        .to_string();
    let label = input
        .get("label")
        .and_then(|v| v.as_str())
        .map(String::from);

    let new = NewProjectDirectory {
        project_id,
        path,
        label,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_directory::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_dir_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<ProjectDirectory, String> {
    let path = patch.get("path").and_then(|v| v.as_str()).map(String::from);
    let label = nullable_string_patch(patch.get("label"));

    let up = UpdateProjectDirectory { path, label };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_directory::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_dir_delete(
    state: tauri::State<DbState>,
    id: i64,
) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_directory::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
pub(crate) fn project_app_list(
    state: tauri::State<DbState>,
    project_id: i64,
) -> Result<Vec<ProjectApplication>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_application::list_by_project(&conn, project_id).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_app_add(
    state: tauri::State<DbState>,
    input: serde_json::Value,
) -> Result<ProjectApplication, String> {
    let project_id = input
        .get("project_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "project_id is required".to_string())?;
    let path = input
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "path is required".to_string())?
        .to_string();
    let label = input
        .get("label")
        .and_then(|v| v.as_str())
        .map(String::from);

    let new = NewProjectApplication {
        project_id,
        path,
        label,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_application::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_app_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<ProjectApplication, String> {
    let path = patch.get("path").and_then(|v| v.as_str()).map(String::from);
    let label = nullable_string_patch(patch.get("label"));

    let up = UpdateProjectApplication { path, label };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_application::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
pub(crate) fn project_app_delete(
    state: tauri::State<DbState>,
    id: i64,
) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_application::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}
