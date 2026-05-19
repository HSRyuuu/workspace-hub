use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::project::{NewProjectDirectory, ProjectDirectory, UpdateProjectDirectory};
use crate::repo::{empty_to_none, now_iso, project as project_repo};

const SELECT_COLUMNS: &str = "id, project_id, path, label, created_at, updated_at";

fn map_row(row: &Row<'_>) -> rusqlite::Result<ProjectDirectory> {
    Ok(ProjectDirectory {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        path: row.get("path")?,
        label: row.get("label")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn create(
    conn: &Connection,
    input: &NewProjectDirectory,
) -> Result<ProjectDirectory, CoreError> {
    let path = input.path.trim();
    if path.is_empty() {
        return Err(CoreError::InvalidInput("path is required".into()));
    }
    // 부모 project 존재 검증 — FK 위반은 sqlite 에러로 떨어지지만, 사용자에게는
    // NotFound 가 더 명확하므로 한 번 더 가드한다.
    project_repo::get(conn, input.project_id)?;

    let now = now_iso();
    conn.execute(
        "INSERT INTO project_directory
            (project_id, path, label, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![
            input.project_id,
            path,
            empty_to_none(input.label.clone()),
            now,
        ],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<ProjectDirectory, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM project_directory WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                CoreError::NotFound(format!("project_directory id={id}"))
            }
            other => CoreError::Sqlite(other),
        })
}

/// 프로젝트별 디렉터리 목록 — id ASC 정렬.
pub fn list_by_project(
    conn: &Connection,
    project_id: i64,
) -> Result<Vec<ProjectDirectory>, CoreError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM project_directory \
         WHERE project_id = ?1 ORDER BY id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![project_id], map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(
    conn: &Connection,
    id: i64,
    patch: &UpdateProjectDirectory,
) -> Result<ProjectDirectory, CoreError> {
    let current = get(conn, id)?;

    let path = match &patch.path {
        Some(p) => {
            let trimmed = p.trim();
            if trimmed.is_empty() {
                return Err(CoreError::InvalidInput("path cannot be empty".into()));
            }
            trimmed.to_string()
        }
        None => current.path.clone(),
    };
    let label = match &patch.label {
        Some(opt) => empty_to_none(opt.clone()),
        None => current.label.clone(),
    };

    let now = now_iso();
    let affected = conn.execute(
        "UPDATE project_directory SET
            path = ?1,
            label = ?2,
            updated_at = ?3
         WHERE id = ?4",
        params![path, label, now, id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("project_directory id={id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), CoreError> {
    let affected = conn.execute(
        "DELETE FROM project_directory WHERE id = ?1",
        params![id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("project_directory id={id}")));
    }
    Ok(())
}
