use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize)]
struct QuickCaptureNavigation {
    kind: String,
    id: i64,
}

#[tauri::command]
pub(crate) fn quick_capture_open_main(
    app: tauri::AppHandle,
    kind: String,
    id: i64,
) -> Result<(), String> {
    if !matches!(kind.as_str(), "memo" | "todo") {
        return Err(format!("unknown quick capture kind: {kind}"));
    }

    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not configured".to_string())?;
    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;
    main.emit(
        "quick-capture:navigate",
        QuickCaptureNavigation { kind, id },
    )
    .map_err(|error| error.to_string())?;

    let capture = app
        .get_webview_window("capture")
        .ok_or_else(|| "quick capture window is not configured".to_string())?;
    capture.hide().map_err(|error| error.to_string())
}
