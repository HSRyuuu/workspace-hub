use rusqlite::Connection;
use serde::Serialize;

use crate::error::CoreError;
use crate::models::todo::Todo;
use crate::repo::todo;

pub const TODO_LIMIT: i64 = 7;

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub due_todos: Vec<Todo>,
    pub open_todos: Vec<Todo>,
    pub open_total: i64,
}

pub fn summary(conn: &Connection, week_end: &str) -> Result<DashboardSummary, CoreError> {
    Ok(DashboardSummary {
        due_todos: todo::list_open_due_until(conn, week_end)?,
        open_todos: todo::list_open_oldest(conn, TODO_LIMIT)?,
        open_total: todo::count_open(conn)?,
    })
}
