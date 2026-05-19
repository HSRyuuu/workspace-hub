use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::project::{NewProject, Project, UpdateProject};
use crate::repo::{empty_to_none, now_iso};

const SELECT_COLUMNS: &str =
    "id, title, description, color, sort_order, created_at, updated_at";

const DEFAULT_COLOR: &str = "#3F3393";

fn map_row(row: &Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        color: row.get("color")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn create(conn: &Connection, input: &NewProject) -> Result<Project, CoreError> {
    if input.title.trim().is_empty() {
        return Err(CoreError::InvalidInput("title is required".into()));
    }
    let color = input
        .color
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_COLOR)
        .to_string();
    let sort_order = input.sort_order.unwrap_or(0);

    let now = now_iso();
    conn.execute(
        "INSERT INTO project
            (title, description, color, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![
            input.title.trim(),
            empty_to_none(input.description.clone()),
            color,
            sort_order,
            now,
        ],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Project, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM project WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                CoreError::NotFound(format!("project id={id}"))
            }
            other => CoreError::Sqlite(other),
        })
}

/// sort_order ASC, id ASC.
pub fn list(conn: &Connection) -> Result<Vec<Project>, CoreError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM project ORDER BY sort_order ASC, id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: i64, patch: &UpdateProject) -> Result<Project, CoreError> {
    let current = get(conn, id)?;

    let title = match &patch.title {
        Some(t) => {
            if t.trim().is_empty() {
                return Err(CoreError::InvalidInput("title cannot be empty".into()));
            }
            t.trim().to_string()
        }
        None => current.title.clone(),
    };
    let description = match &patch.description {
        Some(opt) => empty_to_none(opt.clone()),
        None => current.description.clone(),
    };
    let color = match &patch.color {
        Some(c) => {
            let trimmed = c.trim();
            if trimmed.is_empty() {
                DEFAULT_COLOR.to_string()
            } else {
                trimmed.to_string()
            }
        }
        None => current.color.clone(),
    };
    let sort_order = patch.sort_order.unwrap_or(current.sort_order);

    let now = now_iso();
    let affected = conn.execute(
        "UPDATE project SET
            title = ?1,
            description = ?2,
            color = ?3,
            sort_order = ?4,
            updated_at = ?5
         WHERE id = ?6",
        params![title, description, color, sort_order, now, id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("project id={id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), CoreError> {
    let affected = conn.execute("DELETE FROM project WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("project id={id}")));
    }
    Ok(())
}
