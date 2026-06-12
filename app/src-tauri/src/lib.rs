use std::process::Command;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use workspace_hub_core::models::file_explorer::FileExplorerFolder;
use workspace_hub_core::models::memo::{
    Memo, MemoFolder, NewMemo, NewMemoFolder, UpdateMemo, UpdateMemoFolder,
};
use workspace_hub_core::models::project::{
    NewProject, NewProjectApplication, NewProjectDirectory, Project, ProjectApplication,
    ProjectDirectory, UpdateProject, UpdateProjectApplication, UpdateProjectDirectory,
};
use workspace_hub_core::models::schedule::{NewSchedule, Schedule, UpdateSchedule};
use workspace_hub_core::models::todo::{NewTodo, Priority, Todo, TodoStatus};
use workspace_hub_core::repo::memo::ListScope;
use workspace_hub_core::repo::todo::TodoPatch;
use workspace_hub_core::{db, repo, CoreError};

/// Tauri State 로 공유하는 단일 DB 커넥션.
/// 앱 시작 시 한 번 열고 모든 invoke 핸들러가 같은 락을 두고 직렬화한다.
/// — sidecar 시절의 process-per-call 오버헤드와 인자 이스케이프 버그를 제거하기 위한 핵심.
pub struct DbState(Mutex<Connection>);

fn core_err(e: CoreError) -> String {
    match e {
        CoreError::InvalidInput(m) => m,
        CoreError::NotFound(m) => format!("not found: {m}"),
        CoreError::Parse(m) => format!("parse error: {m}"),
        other => other.to_string(),
    }
}

fn lock_err<T>(_: std::sync::PoisonError<T>) -> String {
    "db lock poisoned".into()
}

fn parse_priority(s: &str) -> Result<Priority, String> {
    Priority::parse(s).ok_or_else(|| format!("unknown priority: {s}"))
}

fn parse_status(s: &str) -> Result<TodoStatus, String> {
    TodoStatus::parse(s).ok_or_else(|| format!("unknown status: {s}"))
}

/// PATCH 의미: 키 없음 = `None`(변경 없음), `null`/`""` = `Some(None)`(클리어), 그 외 = `Some(Some(v))`.
fn nullable_string_patch(v: Option<&serde_json::Value>) -> Option<Option<String>> {
    match v {
        None => None,
        Some(x) if x.is_null() => Some(None),
        Some(x) => match x.as_str() {
            Some("") => Some(None),
            Some(s) => Some(Some(s.to_string())),
            None => None,
        },
    }
}

#[derive(Serialize)]
struct DeletedAck {
    deleted: i64,
}

#[derive(Serialize)]
struct PurgedCountAck {
    purged_count: usize,
}

// =========================================================================
// todo
// =========================================================================

#[tauri::command]
fn todo_list(state: tauri::State<DbState>, status: Option<String>) -> Result<Vec<Todo>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    let filter = match status.as_deref().unwrap_or("all") {
        "all" => None,
        s => Some(parse_status(s)?),
    };
    repo::todo::list(&conn, filter).map_err(core_err)
}

#[tauri::command]
fn todo_add(state: tauri::State<DbState>, input: serde_json::Value) -> Result<Todo, String> {
    let title = input
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "title is required".to_string())?
        .to_string();
    let description = input.get("description").and_then(|v| v.as_str()).map(String::from);
    let due_at = input.get("due").and_then(|v| v.as_str()).map(String::from);
    let priority = parse_priority(
        input.get("priority").and_then(|v| v.as_str()).unwrap_or("mid"),
    )?;
    let workspace_id = input.get("workspace_id").and_then(|v| v.as_i64());

    let new = NewTodo { workspace_id, title, description, due_at, priority };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
fn todo_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Todo, String> {
    let title = patch.get("title").and_then(|v| v.as_str()).map(String::from);
    let description = nullable_string_patch(patch.get("description"));
    let due_at = nullable_string_patch(patch.get("due"));
    let priority = match patch.get("priority").and_then(|v| v.as_str()) {
        Some(s) => Some(parse_priority(s)?),
        None => None,
    };
    let status = match patch.get("status").and_then(|v| v.as_str()) {
        Some(s) => Some(parse_status(s)?),
        None => None,
    };

    let tp = TodoPatch { title, description, due_at, priority, status };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::update(&conn, id, &tp).map_err(core_err)
}

#[tauri::command]
fn todo_complete(state: tauri::State<DbState>, id: i64) -> Result<Todo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::complete(&conn, id).map_err(core_err)
}

#[tauri::command]
fn todo_uncomplete(state: tauri::State<DbState>, id: i64) -> Result<Todo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::uncomplete(&conn, id).map_err(core_err)
}

#[tauri::command]
fn todo_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::todo::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

// =========================================================================
// schedule
// =========================================================================

#[tauri::command]
fn schedule_list_range(
    state: tauri::State<DbState>,
    from: String,
    to: String,
) -> Result<Vec<Schedule>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::list_in_range(&conn, &from, &to).map_err(core_err)
}

#[tauri::command]
fn schedule_get(state: tauri::State<DbState>, id: i64) -> Result<Schedule, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::get(&conn, id).map_err(core_err)
}

#[tauri::command]
fn schedule_add(
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
    let all_day = input.get("all_day").and_then(|v| v.as_bool()).unwrap_or(false);
    let description = input.get("description").and_then(|v| v.as_str()).map(String::from);
    let location = input.get("location").and_then(|v| v.as_str()).map(String::from);
    let color = input.get("color").and_then(|v| v.as_str()).map(String::from);

    let new = NewSchedule { title, description, location, start_at, end_at, all_day, color };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
fn schedule_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Schedule, String> {
    let title = patch.get("title").and_then(|v| v.as_str()).map(String::from);
    let start_at = patch.get("start").and_then(|v| v.as_str()).map(String::from);
    let end_at = patch.get("end").and_then(|v| v.as_str()).map(String::from);
    let all_day = patch.get("all_day").and_then(|v| v.as_bool());
    let description = nullable_string_patch(patch.get("description"));
    let location = nullable_string_patch(patch.get("location"));
    let color = nullable_string_patch(patch.get("color"));

    let up = UpdateSchedule {
        title, description, location, start_at, end_at, all_day, color,
    };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
fn schedule_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::schedule::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

// =========================================================================
// memo
// =========================================================================

#[tauri::command]
fn memo_list(
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
fn memo_get(state: tauri::State<DbState>, id: i64) -> Result<Memo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::get(&conn, id).map_err(core_err)
}

#[tauri::command]
fn memo_add(state: tauri::State<DbState>, input: serde_json::Value) -> Result<Memo, String> {
    let title = input.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let body = input.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let folder_id = input.get("folder_id").and_then(|v| v.as_i64());

    let new = NewMemo { folder_id, title, body };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
fn memo_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Memo, String> {
    let title = patch.get("title").and_then(|v| v.as_str()).map(String::from);
    let body = patch.get("body").and_then(|v| v.as_str()).map(String::from);
    let pinned = patch.get("pinned").and_then(|v| v.as_bool());
    // folder_id: 키 없음=None(변경없음), null=Some(None)(루트로), 숫자=Some(Some(n))(폴더로).
    let folder_id = match patch.get("folder_id") {
        None => None,
        Some(v) if v.is_null() => Some(None),
        Some(v) => match v.as_i64() {
            Some(n) => Some(Some(n)),
            None => None,
        },
    };

    let up = UpdateMemo { folder_id, title, body, pinned };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
fn memo_delete(state: tauri::State<DbState>, id: i64) -> Result<Memo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::soft_delete(&conn, id).map_err(core_err)
}

#[tauri::command]
fn memo_restore(state: tauri::State<DbState>, id: i64) -> Result<Memo, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::restore(&conn, id).map_err(core_err)
}

#[tauri::command]
fn memo_purge(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo::purge(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
fn memo_empty_trash(state: tauri::State<DbState>) -> Result<PurgedCountAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    let count = repo::memo::empty_trash(&conn).map_err(core_err)?;
    Ok(PurgedCountAck { purged_count: count })
}

// =========================================================================
// memo folder
// =========================================================================

#[tauri::command]
fn memo_folder_list(state: tauri::State<DbState>) -> Result<Vec<MemoFolder>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::list_all(&conn).map_err(core_err)
}

#[tauri::command]
fn memo_folder_add(
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
fn memo_folder_rename(
    state: tauri::State<DbState>,
    id: i64,
    name: String,
) -> Result<MemoFolder, String> {
    let patch = UpdateMemoFolder { name: Some(name), parent_id: None };
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::update(&mut conn, id, &patch).map_err(core_err)
}

#[tauri::command]
fn memo_folder_move(
    state: tauri::State<DbState>,
    id: i64,
    parent_id: Option<i64>,
) -> Result<MemoFolder, String> {
    // Tauri 시그니처상 `parent_id` 가 Option<i64>. None 이면 루트로 이동(Some(None)).
    let patch = UpdateMemoFolder { name: None, parent_id: Some(parent_id) };
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::update(&mut conn, id, &patch).map_err(core_err)
}

#[tauri::command]
fn memo_folder_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    // memo_folder::delete 는 트랜잭션 시작을 위해 &mut Connection 필요.
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::delete(&mut conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
fn memo_folder_reorder(
    state: tauri::State<DbState>,
    parent_id: Option<i64>,
    ordered_ids: Vec<i64>,
) -> Result<(), String> {
    // reorder 는 트랜잭션을 시작하므로 &mut Connection 필요.
    let mut conn = state.0.lock().map_err(lock_err)?;
    repo::memo_folder::reorder(&mut conn, parent_id, &ordered_ids).map_err(core_err)
}

// =========================================================================
// project
// =========================================================================

#[tauri::command]
fn project_list(state: tauri::State<DbState>) -> Result<Vec<Project>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::list(&conn).map_err(core_err)
}

#[tauri::command]
fn project_get(state: tauri::State<DbState>, id: i64) -> Result<Project, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::get(&conn, id).map_err(core_err)
}

#[tauri::command]
fn project_add(state: tauri::State<DbState>, input: serde_json::Value) -> Result<Project, String> {
    let title = input
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "title is required".to_string())?
        .to_string();
    let description = input.get("description").and_then(|v| v.as_str()).map(String::from);
    let color = input.get("color").and_then(|v| v.as_str()).map(String::from);
    let sort_order = input.get("sort_order").and_then(|v| v.as_i64());

    let new = NewProject { title, description, color, sort_order };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
fn project_update(
    state: tauri::State<DbState>,
    id: i64,
    patch: serde_json::Value,
) -> Result<Project, String> {
    let title = patch.get("title").and_then(|v| v.as_str()).map(String::from);
    let color = patch.get("color").and_then(|v| v.as_str()).map(String::from);
    let sort_order = patch.get("sort_order").and_then(|v| v.as_i64());
    let description = nullable_string_patch(patch.get("description"));

    let up = UpdateProject { title, description, color, sort_order };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::update(&conn, id, &up).map_err(core_err)
}

#[tauri::command]
fn project_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
fn project_dir_list(
    state: tauri::State<DbState>,
    project_id: i64,
) -> Result<Vec<ProjectDirectory>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_directory::list_by_project(&conn, project_id).map_err(core_err)
}

#[tauri::command]
fn project_dir_add(
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
    let label = input.get("label").and_then(|v| v.as_str()).map(String::from);

    let new = NewProjectDirectory { project_id, path, label };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_directory::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
fn project_dir_update(
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
fn project_dir_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_directory::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

#[tauri::command]
fn project_app_list(
    state: tauri::State<DbState>,
    project_id: i64,
) -> Result<Vec<ProjectApplication>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_application::list_by_project(&conn, project_id).map_err(core_err)
}

#[tauri::command]
fn project_app_add(
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
    let label = input.get("label").and_then(|v| v.as_str()).map(String::from);

    let new = NewProjectApplication { project_id, path, label };
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_application::create(&conn, &new).map_err(core_err)
}

#[tauri::command]
fn project_app_update(
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
fn project_app_delete(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::project_application::delete(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

// =========================================================================
// memo ↔ project N:N 매핑
// =========================================================================

#[tauri::command]
fn memo_project_list_projects(
    state: tauri::State<DbState>,
    memo_id: i64,
) -> Result<Vec<Project>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::list_projects_for_memo(&conn, memo_id).map_err(core_err)
}

#[tauri::command]
fn memo_project_list_memos(
    state: tauri::State<DbState>,
    project_id: i64,
) -> Result<Vec<Memo>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::list_memos_for_project(&conn, project_id).map_err(core_err)
}

#[tauri::command]
fn memo_project_link(
    state: tauri::State<DbState>,
    memo_id: i64,
    project_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::link(&conn, memo_id, project_id).map_err(core_err)
}

#[tauri::command]
fn memo_project_unlink(
    state: tauri::State<DbState>,
    memo_id: i64,
    project_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::memo_project::unlink(&conn, memo_id, project_id).map_err(core_err)
}

// =========================================================================
// files (file explorer)
// =========================================================================

#[tauri::command]
fn files_folder_list(state: tauri::State<DbState>) -> Result<Vec<FileExplorerFolder>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::list(&conn).map_err(core_err)
}

#[tauri::command]
fn files_folder_touch(
    state: tauri::State<DbState>,
    path: String,
) -> Result<FileExplorerFolder, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::touch(&conn, &path).map_err(core_err)
}

#[tauri::command]
fn files_folder_set_favorite(
    state: tauri::State<DbState>,
    id: i64,
    favorite: bool,
) -> Result<FileExplorerFolder, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::set_favorite(&conn, id, favorite).map_err(core_err)
}

#[tauri::command]
fn files_folder_remove(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::remove(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}

// =========================================================================
// shell util
// =========================================================================

#[tauri::command]
fn open_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to open `{path}`: {e}"))
}

/// macOS `open` 로 .app 번들을 실행한다.
/// .app 디렉터리든 그 안의 실행 바이너리 경로든 `open` 이 모두 처리한다.
#[tauri::command]
fn open_application(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to open application `{path}`: {e}"))
}

pub fn run() {
    let conn = db::open().expect("failed to open workspace-hub database");
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            todo_list,
            todo_add,
            todo_update,
            todo_complete,
            todo_uncomplete,
            todo_delete,
            schedule_list_range,
            schedule_get,
            schedule_add,
            schedule_update,
            schedule_delete,
            memo_list,
            memo_get,
            memo_add,
            memo_update,
            memo_delete,
            memo_restore,
            memo_purge,
            memo_empty_trash,
            memo_folder_list,
            memo_folder_add,
            memo_folder_rename,
            memo_folder_move,
            memo_folder_reorder,
            memo_folder_delete,
            project_list,
            project_get,
            project_add,
            project_update,
            project_delete,
            project_dir_list,
            project_dir_add,
            project_dir_update,
            project_dir_delete,
            project_app_list,
            project_app_add,
            project_app_update,
            project_app_delete,
            memo_project_list_projects,
            memo_project_list_memos,
            memo_project_link,
            memo_project_unlink,
            files_folder_list,
            files_folder_touch,
            files_folder_set_favorite,
            files_folder_remove,
            open_in_finder,
            open_application,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
