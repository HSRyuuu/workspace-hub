use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::todo::{NewTodo, Priority, Todo, TodoStatus};
use crate::repo::{normalize_iso_date, now_iso};

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
        due_at: row.get("due_at")?,
        priority: row.get("priority")?,
        status,
        completed_at: row.get("completed_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str =
    "id, workspace_id, title, description, due_at, priority, status, completed_at, created_at, updated_at";

/// `None` = 미지정(보존), `Some(None)` = NULL 클리어, `Some(Some(v))` = 값 설정.
/// CLI 레이어가 빈 문자열을 `Some(None)` 으로 변환한다 (schedule_update 와 동일 패턴).
pub struct TodoPatch {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub due_at: Option<Option<String>>,
    pub priority: Option<Priority>,
    pub status: Option<TodoStatus>,
}

pub fn create(conn: &Connection, input: &NewTodo) -> Result<Todo, CoreError> {
    if input.title.trim().is_empty() {
        return Err(CoreError::InvalidInput("title is required".into()));
    }
    // due_at 은 core 레이어에서 한 번 더 검증한다 — 호출자가 CLI 든 (향후) Tauri 직접 호출이든
    // 동일한 보장을 갖도록.
    let due_at = normalize_iso_date(input.due_at.as_deref())?;

    let now = now_iso();
    conn.execute(
        "INSERT INTO todo
            (workspace_id, title, description, due_at, priority, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'open', ?6, ?6)",
        params![
            input.workspace_id,
            input.title.trim(),
            input.description,
            due_at,
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
            rusqlite::Error::QueryReturnedNoRows => {
                CoreError::NotFound(format!("todo id={id}"))
            }
            other => CoreError::Sqlite(other),
        })
}

pub fn list(conn: &Connection, status_filter: Option<TodoStatus>) -> Result<Vec<Todo>, CoreError> {
    let order = "ORDER BY (status = 'open') DESC, \
                          CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, \
                          CASE priority WHEN 'high' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END ASC, \
                          id DESC";
    let (sql, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match status_filter {
        Some(s) => (
            format!("SELECT {SELECT_COLUMNS} FROM todo WHERE status = ?1 {order}"),
            vec![Box::new(s.as_str().to_string())],
        ),
        None => (
            format!("SELECT {SELECT_COLUMNS} FROM todo {order}"),
            vec![],
        ),
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

    if let Some(raw) = &patch.due_at {
        let normalized = normalize_iso_date(raw.as_deref())?;
        push!("due_at", normalized);
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
