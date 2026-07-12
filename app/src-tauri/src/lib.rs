use std::sync::Mutex;

use rusqlite::Connection;
use workspace_hub_core::db;

mod handlers;

/// Tauri State 로 공유하는 단일 DB 커넥션.
/// 앱 시작 시 한 번 열고 모든 invoke 핸들러가 같은 락을 두고 직렬화한다.
/// — sidecar 시절의 process-per-call 오버헤드와 인자 이스케이프 버그를 제거하기 위한 핵심.
pub struct DbState(pub(crate) Mutex<Connection>);

pub fn run() {
    let conn = db::open().expect("failed to open workspace-hub database");
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            handlers::todo::todo_list,
            handlers::todo::todo_list_calendar_range,
            handlers::todo::todo_add,
            handlers::todo::todo_update,
            handlers::todo::todo_complete,
            handlers::todo::todo_uncomplete,
            handlers::todo::todo_delete,
            handlers::schedule::schedule_list_range,
            handlers::schedule::schedule_get,
            handlers::schedule::schedule_add,
            handlers::schedule::schedule_update,
            handlers::schedule::schedule_delete,
            handlers::memo::memo_list,
            handlers::memo::memo_get,
            handlers::memo::memo_add,
            handlers::memo::memo_update,
            handlers::memo::memo_delete,
            handlers::memo::memo_restore,
            handlers::memo::memo_purge,
            handlers::memo::memo_empty_trash,
            handlers::memo::memo_folder_list,
            handlers::memo::memo_folder_add,
            handlers::memo::memo_folder_rename,
            handlers::memo::memo_folder_move,
            handlers::memo::memo_folder_reorder,
            handlers::memo::memo_folder_delete,
            handlers::project::project_list,
            handlers::project::project_get,
            handlers::project::project_add,
            handlers::project::project_update,
            handlers::project::project_delete,
            handlers::project::project_dir_list,
            handlers::project::project_dir_add,
            handlers::project::project_dir_update,
            handlers::project::project_dir_delete,
            handlers::project::project_app_list,
            handlers::project::project_app_add,
            handlers::project::project_app_update,
            handlers::project::project_app_delete,
            handlers::memo::memo_project_list_projects,
            handlers::memo::memo_project_list_memos,
            handlers::memo::memo_project_link,
            handlers::memo::memo_project_unlink,
            handlers::files::files_folder_list,
            handlers::files::files_folder_touch,
            handlers::files::files_folder_set_favorite,
            handlers::files::files_folder_remove,
            handlers::files::open_in_finder,
            handlers::files::reveal_in_finder,
            handlers::files::open_application,
            handlers::files::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod handler_structure_tests {
    use super::handlers::{files, memo, project, schedule, todo};

    #[test]
    fn domain_handler_modules_expose_representative_commands() {
        let _ = todo::todo_list;
        let _ = schedule::schedule_get;
        let _ = memo::memo_get;
        let _ = project::project_get;
        let _ = files::files_folder_list;
    }
}
