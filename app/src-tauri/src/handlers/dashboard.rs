use workspace_hub_core::repo;
use workspace_hub_core::repo::dashboard::DashboardSummary;

use super::{core_err, lock_err};
use crate::DbState;

#[tauri::command]
pub(crate) fn dashboard_summary(
    state: tauri::State<DbState>,
    week_end: String,
) -> Result<DashboardSummary, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::dashboard::summary(&conn, &week_end).map_err(core_err)
}
