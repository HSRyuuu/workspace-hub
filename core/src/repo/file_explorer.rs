use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::file_explorer::FileExplorerFolder;
use crate::repo::now_iso;

/// 즐겨찾기가 아닌 히스토리의 최대 보관 개수. 초과분은 touch 시 오래된 것부터 잘린다.
pub const MAX_HISTORY: usize = 20;

const SELECT_COLUMNS: &str = "id, path, is_favorite, last_opened_at";

fn map_row(row: &Row<'_>) -> rusqlite::Result<FileExplorerFolder> {
    Ok(FileExplorerFolder {
        id: row.get("id")?,
        path: row.get("path")?,
        is_favorite: row.get::<_, i64>("is_favorite")? != 0,
        last_opened_at: row.get("last_opened_at")?,
    })
}

/// 전체 목록 — 최근 연 순. 즐겨찾기/최근 분리는 프론트가 한다.
/// now_iso() 는 초 단위라 같은 초 내 touch 는 id DESC 로 타이브레이크.
pub fn list(conn: &Connection) -> Result<Vec<FileExplorerFolder>, CoreError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM file_explorer_folder \
         ORDER BY last_opened_at DESC, id DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get(conn: &Connection, id: i64) -> Result<FileExplorerFolder, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM file_explorer_folder WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            CoreError::NotFound(format!("file_explorer_folder id={id}"))
        }
        other => CoreError::Sqlite(other),
    })
}

/// 폴더를 열 때 호출 — upsert + last_opened_at 갱신 + 비즐겨찾기 초과분 prune.
pub fn touch(conn: &Connection, path: &str) -> Result<FileExplorerFolder, CoreError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(CoreError::InvalidInput("path is required".into()));
    }
    let now = now_iso();
    conn.execute(
        "INSERT INTO file_explorer_folder (path, is_favorite, last_opened_at)
         VALUES (?1, 0, ?2)
         ON CONFLICT(path) DO UPDATE SET last_opened_at = ?2",
        params![trimmed, now],
    )?;
    prune(conn)?;
    let sql = format!("SELECT {SELECT_COLUMNS} FROM file_explorer_folder WHERE path = ?1");
    conn.query_row(&sql, params![trimmed], map_row)
        .map_err(CoreError::Sqlite)
}

/// 비즐겨찾기 행이 MAX_HISTORY 를 넘으면 오래된 것부터 삭제. 즐겨찾기는 건드리지 않는다.
fn prune(conn: &Connection) -> Result<(), CoreError> {
    conn.execute(
        "DELETE FROM file_explorer_folder
         WHERE is_favorite = 0
           AND id NOT IN (
             SELECT id FROM file_explorer_folder
             WHERE is_favorite = 0
             ORDER BY last_opened_at DESC, id DESC
             LIMIT ?1
           )",
        params![MAX_HISTORY as i64],
    )?;
    Ok(())
}

pub fn set_favorite(
    conn: &Connection,
    id: i64,
    favorite: bool,
) -> Result<FileExplorerFolder, CoreError> {
    let affected = conn.execute(
        "UPDATE file_explorer_folder SET is_favorite = ?1 WHERE id = ?2",
        params![favorite as i64, id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("file_explorer_folder id={id}")));
    }
    get(conn, id)
}

pub fn remove(conn: &Connection, id: i64) -> Result<(), CoreError> {
    let affected = conn.execute(
        "DELETE FROM file_explorer_folder WHERE id = ?1",
        params![id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("file_explorer_folder id={id}")));
    }
    Ok(())
}
