use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;
use workspace_hub_core::db;

mod handlers;

/// Tauri State 로 공유하는 단일 DB 커넥션.
/// 앱 시작 시 한 번 열고 모든 invoke 핸들러가 같은 락을 두고 직렬화한다.
/// — sidecar 시절의 process-per-call 오버헤드와 인자 이스케이프 버그를 제거하기 위한 핵심.
pub struct DbState(pub(crate) Mutex<Connection>);

const QUICK_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+Space";

fn capture_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("capture") {
        return Ok(window);
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "capture")
        .ok_or_else(|| "quick capture window is not configured".to_string())?;
    tauri::WebviewWindowBuilder::from_config(app, config)
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())
}

fn toggle_capture_window(app: &tauri::AppHandle) {
    let window = match capture_window(app) {
        Ok(window) => window,
        Err(error) => {
            eprintln!("failed to get or create quick capture window: {error}");
            return;
        }
    };

    match window.is_visible() {
        Ok(true) => {
            if let Err(error) = window.hide() {
                eprintln!("failed to hide quick capture window: {error}");
            }
        }
        Ok(false) => {
            if let Err(error) = window.show() {
                eprintln!("failed to show quick capture window: {error}");
                return;
            }
            if let Err(error) = window.set_focus() {
                eprintln!("failed to focus quick capture window: {error}");
            }
        }
        Err(error) => eprintln!("failed to read quick capture visibility: {error}"),
    }
}

pub fn run() {
    let conn = db::open().expect("failed to open workspace-hub database");
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let plugin = tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(QUICK_CAPTURE_SHORTCUT)
                .map(|builder| {
                    builder
                        .with_handler(|app, _, event| {
                            if event.state == ShortcutState::Pressed {
                                toggle_capture_window(app);
                            }
                        })
                        .build()
                });

            match plugin {
                Ok(plugin) => {
                    if let Err(error) = app.handle().plugin(plugin) {
                        eprintln!("failed to register quick capture shortcut: {error}");
                    }
                }
                Err(error) => eprintln!("invalid quick capture shortcut: {error}"),
            }

            let labels = app.webview_windows().into_keys().collect::<Vec<_>>();
            eprintln!("Tauri webview windows at startup: {}", labels.join(", "));

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(window.label(), "main" | "capture") {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Err(error) = window.hide() {
                        eprintln!("failed to hide {} window: {error}", window.label());
                    }
                }
            }
        })
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            handlers::capture::quick_capture_open_main,
            handlers::dashboard::dashboard_summary,
            handlers::todo::todo_list,
            handlers::todo::todo_list_calendar_range,
            handlers::todo::todo_list_by_project,
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
            handlers::skill::skill_targets,
            handlers::skill::skill_install,
            handlers::skill::skill_uninstall,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = event {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = window.show() {
                    eprintln!("failed to show main window: {error}");
                    return;
                }
                if let Err(error) = window.set_focus() {
                    eprintln!("failed to focus main window: {error}");
                }
            }
        }
    });
}

#[cfg(test)]
mod handler_structure_tests {
    use super::handlers::{dashboard, files, memo, project, schedule, todo};

    #[test]
    fn domain_handler_modules_expose_representative_commands() {
        let _ = dashboard::dashboard_summary;
        let _ = todo::todo_list;
        let _ = schedule::schedule_get;
        let _ = memo::memo_get;
        let _ = project::project_get;
        let _ = files::files_folder_list;
    }
}
