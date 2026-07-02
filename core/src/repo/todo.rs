use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::todo::{NewTodo, Priority, Todo, TodoStatus};
use crate::repo::{normalize_iso_date_only, now_iso, validate_due_time_minutes};

fn map_row(row: &Row<'_>) -> rusqlite::Result<Todo> {
    let status_str: String = row.get("status")?;
    // 알 수 없는 status 가 들어오면 조용히 Open 으로 fallback 하지 않고 명시적으로 실패한다.
    // schema 의 CHECK 제약이 한 겹 막아주지만, 향후 backfill 마이그레이션이나 외부 도구가
    // 직접 INSERT 한 경우에도 안전하게 한 번 더 차단한다.
    let status = TodoStatus::parse(&status_str).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            0,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("unknown todo.status value: {status_str}"),
            )),
        )
    })?;
    Ok(Todo {
        id: row.get("id")?,
        workspace_id: row.get("workspace_id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        start_date: row.get("start_date")?,
        due_date: row.get("due_date")?,
        due_time: row.get("due_time")?,
        priority: row.get("priority")?,
        status,
        completed_at: row.get("completed_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str =
    "id, workspace_id, title, description, start_date, due_date, due_time, priority, status, completed_at, created_at, updated_at";

/// `None` = 미지정(보존), `Some(None)` = NULL 클리어, `Some(Some(v))` = 값 설정.
/// CLI 레이어가 빈 문자열을 `Some(None)` 으로 변환한다 (schedule_update 와 동일 패턴).
pub struct TodoPatch {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub start_date: Option<String>,
    pub due_date: Option<Option<String>>,
    pub due_time: Option<i64>,
    pub priority: Option<Priority>,
    pub status: Option<TodoStatus>,
}

pub fn create(conn: &Connection, input: &NewTodo) -> Result<Todo, CoreError> {
    if input.title.trim().is_empty() {
        return Err(CoreError::InvalidInput("title is required".into()));
    }
    let now = now_iso();
    let start_date = normalize_iso_date_only(input.start_date.as_deref())?
        .unwrap_or_else(|| now[..10].to_string());
    let due_date = normalize_iso_date_only(input.due_date.as_deref())?;
    let input_due_time = validate_due_time_minutes(input.due_time.unwrap_or(0))?;
    let due_time = if due_date.is_some() {
        input_due_time
    } else {
        0
    };

    conn.execute(
        "INSERT INTO todo
            (workspace_id, title, description, start_date, due_date, due_time, priority, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8, ?8)",
        params![
            input.workspace_id,
            input.title.trim(),
            input.description,
            start_date,
            due_date,
            due_time,
            input.priority,
            now,
        ],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Todo, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM todo WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => CoreError::NotFound(format!("todo id={id}")),
            other => CoreError::Sqlite(other),
        })
}

pub fn list(conn: &Connection, status_filter: Option<TodoStatus>) -> Result<Vec<Todo>, CoreError> {
    let order = "ORDER BY (status = 'open') DESC, \
                          CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, due_time ASC, \
                          CASE priority WHEN 'high' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END ASC, \
                          id DESC";
    let (sql, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match status_filter {
        Some(s) => (
            format!("SELECT {SELECT_COLUMNS} FROM todo WHERE status = ?1 {order}"),
            vec![Box::new(s.as_str().to_string())],
        ),
        None => (format!("SELECT {SELECT_COLUMNS} FROM todo {order}"), vec![]),
    };

    let mut stmt = conn.prepare(&sql)?;
    let refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(refs.as_slice(), map_row)?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

pub fn list_calendar_range(
    conn: &Connection,
    from: &str,
    to: &str,
    completed_from: &str,
    completed_to: &str,
) -> Result<Vec<Todo>, CoreError> {
    let from = normalize_iso_date_only(Some(from))?
        .ok_or_else(|| CoreError::InvalidInput("from is required".into()))?;
    let to = normalize_iso_date_only(Some(to))?
        .ok_or_else(|| CoreError::InvalidInput("to is required".into()))?;
    if from >= to {
        return Err(CoreError::InvalidInput("from must be before to".into()));
    }
    if chrono::DateTime::parse_from_rfc3339(completed_from).is_err() {
        return Err(CoreError::Parse(format!(
            "expected RFC3339 completed_from, got: {completed_from}"
        )));
    }
    if chrono::DateTime::parse_from_rfc3339(completed_to).is_err() {
        return Err(CoreError::Parse(format!(
            "expected RFC3339 completed_to, got: {completed_to}"
        )));
    }
    if completed_from >= completed_to {
        return Err(CoreError::InvalidInput(
            "completed_from must be before completed_to".into(),
        ));
    }

    let sql = format!(
        "SELECT {SELECT_COLUMNS}
         FROM todo
         WHERE id IN (
             SELECT id FROM todo WHERE start_date >= ?1 AND start_date < ?2
             UNION
             SELECT id FROM todo WHERE due_date >= ?1 AND due_date < ?2
             UNION
             SELECT id FROM todo WHERE completed_at >= ?3 AND completed_at < ?4
         )
         ORDER BY
             CASE
                 WHEN status = 'done' AND completed_at IS NOT NULL THEN completed_at
                 WHEN due_date IS NOT NULL THEN due_date
                 ELSE start_date
             END ASC,
             due_time ASC,
             CASE priority WHEN 'high' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END ASC,
             id DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![from, to, completed_from, completed_to], map_row)?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

pub fn update(conn: &Connection, id: i64, patch: &TodoPatch) -> Result<Todo, CoreError> {
    let now = now_iso();

    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    macro_rules! push {
        ($col:expr, $val:expr) => {{
            values.push(Box::new($val));
            sets.push(format!("{} = ?{}", $col, values.len()));
        }};
    }

    if let Some(title) = &patch.title {
        if title.trim().is_empty() {
            return Err(CoreError::InvalidInput("title is required".into()));
        }
        push!("title", title.trim().to_string());
    }

    match &patch.description {
        Some(Some(desc)) => push!("description", Some(desc.clone())),
        Some(None) => push!("description", Option::<String>::None),
        None => {}
    }

    if let Some(raw) = &patch.start_date {
        let normalized = normalize_iso_date_only(Some(raw.as_str()))?
            .ok_or_else(|| CoreError::InvalidInput("start_date is required".into()))?;
        push!("start_date", normalized);
    }

    if let Some(raw) = &patch.due_date {
        let normalized = normalize_iso_date_only(raw.as_deref())?;
        if normalized.is_none() {
            push!("due_date", Option::<String>::None);
            push!("due_time", 0_i64);
        } else {
            push!("due_date", normalized);
        }
    }

    if let Some(due_time) = patch.due_time {
        push!("due_time", validate_due_time_minutes(due_time)?);
    }

    if let Some(priority) = patch.priority {
        push!("priority", priority);
    }

    if let Some(status) = patch.status {
        push!("status", status.as_str().to_string());
        match status {
            TodoStatus::Done => push!("completed_at", now.clone()),
            TodoStatus::Open => push!("completed_at", Option::<String>::None),
        }
    }

    if sets.is_empty() {
        return get(conn, id);
    }

    push!("updated_at", now);
    values.push(Box::new(id));
    let id_idx = values.len();

    let sql = format!("UPDATE todo SET {} WHERE id = ?{}", sets.join(", "), id_idx);
    let refs: Vec<&dyn rusqlite::ToSql> = values.iter().map(|b| b.as_ref()).collect();
    let affected = conn.execute(&sql, refs.as_slice())?;

    if affected == 0 {
        return Err(CoreError::NotFound(format!("todo id={id}")));
    }
    get(conn, id)
}

pub fn complete(conn: &Connection, id: i64) -> Result<Todo, CoreError> {
    let now = now_iso();
    let affected = conn.execute(
        "UPDATE todo SET status = 'done', completed_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("todo id={id}")));
    }
    get(conn, id)
}

pub fn uncomplete(conn: &Connection, id: i64) -> Result<Todo, CoreError> {
    let now = now_iso();
    let affected = conn.execute(
        "UPDATE todo SET status = 'open', completed_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("todo id={id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), CoreError> {
    let affected = conn.execute("DELETE FROM todo WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("todo id={id}")));
    }
    Ok(())
}
