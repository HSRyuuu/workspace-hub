//! memo ↔ project N:N 매핑 repo.
//!
//! 모든 함수는 같은 (memo, project) 쌍이 중복 INSERT 되어도 멱등하도록 동작한다
//! (INSERT OR IGNORE). PRIMARY KEY 제약이 중복을 막아주지만 호출자가 매번 if-not-exists
//! 패턴을 짜지 않도록 INSERT OR IGNORE 로 흡수한다.

use rusqlite::{params, Connection};

use crate::error::CoreError;
use crate::models::memo::Memo;
use crate::models::project::Project;
use crate::repo::{memo as memo_repo, now_iso, project as project_repo};

/// 메모에 프로젝트 매핑을 추가한다. 이미 존재하면 no-op.
pub fn link(conn: &Connection, memo_id: i64, project_id: i64) -> Result<(), CoreError> {
    // FK 가 알려주는 것보다 명확한 에러 메시지를 위해 존재 여부 선검증.
    memo_repo::get(conn, memo_id)?;
    project_repo::get(conn, project_id)?;

    let now = now_iso();
    conn.execute(
        "INSERT OR IGNORE INTO memo_project (memo_id, project_id, created_at)
         VALUES (?1, ?2, ?3)",
        params![memo_id, project_id, now],
    )?;
    Ok(())
}

/// 매핑을 끊는다. 없으면 no-op.
pub fn unlink(conn: &Connection, memo_id: i64, project_id: i64) -> Result<(), CoreError> {
    conn.execute(
        "DELETE FROM memo_project WHERE memo_id = ?1 AND project_id = ?2",
        params![memo_id, project_id],
    )?;
    Ok(())
}

/// 메모에 매핑된 프로젝트 목록 (sort_order ASC, id ASC).
pub fn list_projects_for_memo(
    conn: &Connection,
    memo_id: i64,
) -> Result<Vec<Project>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.title, p.description, p.color, p.sort_order, p.created_at, p.updated_at
         FROM project p
         INNER JOIN memo_project mp ON mp.project_id = p.id
         WHERE mp.memo_id = ?1
         ORDER BY p.sort_order ASC, p.id ASC",
    )?;
    let rows = stmt.query_map(params![memo_id], |row| {
        Ok(Project {
            id: row.get("id")?,
            title: row.get("title")?,
            description: row.get("description")?,
            color: row.get("color")?,
            sort_order: row.get("sort_order")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 프로젝트에 매핑된 메모 목록. 활성 메모(`deleted_at IS NULL`)만 노출하며
/// `pinned DESC, updated_at DESC` 로 정렬해 메모 목록 화면과 동일한 감각을 준다.
pub fn list_memos_for_project(
    conn: &Connection,
    project_id: i64,
) -> Result<Vec<Memo>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT m.id, m.folder_id, m.title, m.body, m.pinned, m.deleted_at,
                m.created_at, m.updated_at
         FROM memo m
         INNER JOIN memo_project mp ON mp.memo_id = m.id
         WHERE mp.project_id = ?1 AND m.deleted_at IS NULL
         ORDER BY m.pinned DESC, m.updated_at DESC",
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok(Memo {
            id: row.get("id")?,
            folder_id: row.get("folder_id")?,
            title: row.get("title")?,
            body: row.get("body")?,
            pinned: row.get("pinned")?,
            deleted_at: row.get("deleted_at")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}
