use rusqlite::Connection;
use serde::Serialize;

use crate::error::CoreError;
use crate::models::file_explorer::FileExplorerFolder;
use crate::models::memo::Memo;
use crate::models::todo::Todo;
use crate::repo::{file_explorer, memo, todo};

pub const TODO_LIMIT: i64 = 7;
pub const MEMO_LIMIT: i64 = 5;
pub const FOLDER_LIMIT: i64 = 5;

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub due_todos: Vec<Todo>,
    pub open_todos: Vec<Todo>,
    pub open_total: i64,
    pub recent_memos: Vec<Memo>,
    pub recent_folders: Vec<FileExplorerFolder>,
}

pub fn summary(conn: &Connection, week_end: &str) -> Result<DashboardSummary, CoreError> {
    let mut recent_folders = file_explorer::list(conn)?;
    recent_folders.truncate(FOLDER_LIMIT as usize);

    Ok(DashboardSummary {
        due_todos: todo::list_open_due_until(conn, week_end)?,
        open_todos: todo::list_open_oldest(conn, TODO_LIMIT)?,
        open_total: todo::count_open(conn)?,
        recent_memos: memo::list_recent(conn, MEMO_LIMIT)?,
        recent_folders,
    })
}
