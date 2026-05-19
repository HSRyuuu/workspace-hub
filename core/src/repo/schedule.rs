use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::schedule::{NewSchedule, Schedule, UpdateSchedule};
use crate::repo::{empty_to_none, normalize_iso_date, now_iso};

const SELECT_COLUMNS: &str =
    "id, title, description, location, start_at, end_at, all_day, color, created_at, updated_at";

fn map_row(row: &Row<'_>) -> rusqlite::Result<Schedule> {
    let all_day: i64 = row.get("all_day")?;
    Ok(Schedule {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        location: row.get("location")?,
        start_at: row.get("start_at")?,
        end_at: row.get("end_at")?,
        all_day: all_day != 0,
        color: row.get("color")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn require_normalized(field: &str, value: &str) -> Result<String, CoreError> {
    match normalize_iso_date(Some(value))? {
        Some(v) => Ok(v),
        None => Err(CoreError::InvalidInput(format!("{field} is required"))),
    }
}

fn validate_range(start: &str, end: &str) -> Result<(), CoreError> {
    if end < start {
        return Err(CoreError::InvalidInput(
            "end_at must be greater than or equal to start_at".into(),
        ));
    }
    Ok(())
}

pub fn create(conn: &Connection, input: &NewSchedule) -> Result<Schedule, CoreError> {
    if input.title.trim().is_empty() {
        return Err(CoreError::InvalidInput("title is required".into()));
    }
    let start_at = require_normalized("start_at", &input.start_at)?;
    let end_at = require_normalized("end_at", &input.end_at)?;
    validate_range(&start_at, &end_at)?;

    let now = now_iso();
    conn.execute(
        "INSERT INTO schedule
            (title, description, location, start_at, end_at, all_day, color, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![
            input.title.trim(),
            empty_to_none(input.description.clone()),
            empty_to_none(input.location.clone()),
            start_at,
            end_at,
            if input.all_day { 1_i64 } else { 0_i64 },
            empty_to_none(input.color.clone()),
            now,
        ],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Schedule, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM schedule WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                CoreError::NotFound(format!("schedule id={id}"))
            }
            other => CoreError::Sqlite(other),
        })
}

/// 시작 시각 기준 오름차순.
pub fn list(conn: &Connection) -> Result<Vec<Schedule>, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM schedule ORDER BY start_at ASC, id ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// `[from, to)` 와 겹치는 일정. from/to 는 `YYYY-MM-DD` 또는 RFC3339 모두 허용.
/// 조건: `start_at < to AND end_at >= from`.
pub fn list_in_range(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<Schedule>, CoreError> {
    let from_norm = require_normalized("from", from)?;
    let to_norm = require_normalized("to", to)?;
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM schedule \
         WHERE start_at < ?1 AND end_at >= ?2 \
         ORDER BY start_at ASC, id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![to_norm, from_norm], map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: i64, patch: &UpdateSchedule) -> Result<Schedule, CoreError> {
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
    let location = match &patch.location {
        Some(opt) => empty_to_none(opt.clone()),
        None => current.location.clone(),
    };
    let start_at = match &patch.start_at {
        Some(s) => require_normalized("start_at", s)?,
        None => current.start_at.clone(),
    };
    let end_at = match &patch.end_at {
        Some(e) => require_normalized("end_at", e)?,
        None => current.end_at.clone(),
    };
    validate_range(&start_at, &end_at)?;
    let all_day = patch.all_day.unwrap_or(current.all_day);
    let color = match &patch.color {
        Some(opt) => empty_to_none(opt.clone()),
        None => current.color.clone(),
    };

    let now = now_iso();
    let affected = conn.execute(
        "UPDATE schedule SET
            title = ?1,
            description = ?2,
            location = ?3,
            start_at = ?4,
            end_at = ?5,
            all_day = ?6,
            color = ?7,
            updated_at = ?8
         WHERE id = ?9",
        params![
            title,
            description,
            location,
            start_at,
            end_at,
            if all_day { 1_i64 } else { 0_i64 },
            color,
            now,
            id,
        ],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("schedule id={id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), CoreError> {
    let affected = conn.execute("DELETE FROM schedule WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("schedule id={id}")));
    }
    Ok(())
}
