use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::memo::{Memo, NewMemo, UpdateMemo};
use crate::repo::{memo_folder, now_iso};

const SELECT_COLUMNS: &str =
    "id, folder_id, title, body, pinned, deleted_at, created_at, updated_at";

fn map_row(row: &Row<'_>) -> rusqlite::Result<Memo> {
    let pinned: i64 = row.get("pinned")?;
    Ok(Memo {
        id: row.get("id")?,
        folder_id: row.get("folder_id")?,
        title: row.get("title")?,
        body: row.get("body")?,
        pinned: pinned != 0,
        deleted_at: row.get("deleted_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

/// 조회 범위 — CLI/UI 가 명시적으로 지정.
#[derive(Debug, Clone, Copy)]
pub enum ListScope {
    /// 휴지통을 제외한 모든 활성 메모.
    AllActive,
    /// 특정 폴더의 활성 메모. `None` = 루트(folder_id IS NULL).
    Folder(Option<i64>),
    /// 휴지통(deleted_at 이 채워진 모든 메모).
    Trash,
}

pub fn create(conn: &Connection, input: &NewMemo) -> Result<Memo, CoreError> {
    if let Some(fid) = input.folder_id {
        // 존재 검증 — NotFound 시 CLI 에서 exit 1 매핑.
        memo_folder::get(conn, fid)?;
    }
    let now = now_iso();
    conn.execute(
        "INSERT INTO memo (folder_id, title, body, pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?4)",
        params![input.folder_id, input.title, input.body, now],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Memo, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM memo WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => CoreError::NotFound(format!("memo id={id}")),
            other => CoreError::Sqlite(other),
        })
}

pub fn list(conn: &Connection, scope: ListScope) -> Result<Vec<Memo>, CoreError> {
    let (where_clause, bind): (&str, Vec<Box<dyn rusqlite::ToSql>>) = match scope {
        ListScope::AllActive => ("WHERE deleted_at IS NULL", vec![]),
        ListScope::Folder(None) => ("WHERE folder_id IS NULL AND deleted_at IS NULL", vec![]),
        ListScope::Folder(Some(fid)) => (
            "WHERE folder_id = ?1 AND deleted_at IS NULL",
            vec![Box::new(fid)],
        ),
        ListScope::Trash => ("WHERE deleted_at IS NOT NULL", vec![]),
    };

    // 휴지통: 최근 삭제순. 활성: pinned 우선 + 최신 updated_at.
    let order = match scope {
        ListScope::Trash => "ORDER BY deleted_at DESC, id DESC",
        _ => "ORDER BY pinned DESC, updated_at DESC, id DESC",
    };

    let sql = format!("SELECT {SELECT_COLUMNS} FROM memo {where_clause} {order}");
    let mut stmt = conn.prepare(&sql)?;
    let refs: Vec<&dyn rusqlite::ToSql> = bind.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(refs.as_slice(), map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: i64, patch: &UpdateMemo) -> Result<Memo, CoreError> {
    let current = get(conn, id)?;

    let folder_id = match patch.folder_id {
        Some(next) => {
            if let Some(fid) = next {
                memo_folder::get(conn, fid)?;
            }
            next
        }
        None => current.folder_id,
    };
    let title = patch.title.clone().unwrap_or(current.title.clone());
    let body = patch.body.clone().unwrap_or(current.body.clone());
    let pinned = patch.pinned.unwrap_or(current.pinned);

    let now = now_iso();
    let affected = conn.execute(
        "UPDATE memo SET folder_id = ?1, title = ?2, body = ?3, pinned = ?4, updated_at = ?5
         WHERE id = ?6",
        params![
            folder_id,
            title,
            body,
            if pinned { 1_i64 } else { 0_i64 },
            now,
            id,
        ],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("memo id={id}")));
    }
    get(conn, id)
}

/// 휴지통으로 이동(soft-delete). 이미 휴지통이면 InvalidInput.
pub fn soft_delete(conn: &Connection, id: i64) -> Result<Memo, CoreError> {
    let current = get(conn, id)?;
    if current.deleted_at.is_some() {
        return Err(CoreError::InvalidInput(format!(
            "memo id={id} is already in trash"
        )));
    }
    let now = now_iso();
    conn.execute(
        "UPDATE memo SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    get(conn, id)
}

/// 휴지통에서 복원. folder_id 가 NULL(원래 폴더가 그동안 삭제됨) 이면 그대로 루트로 복원.
pub fn restore(conn: &Connection, id: i64) -> Result<Memo, CoreError> {
    let current = get(conn, id)?;
    if current.deleted_at.is_none() {
        return Err(CoreError::InvalidInput(format!(
            "memo id={id} is not in trash"
        )));
    }
    let now = now_iso();
    conn.execute(
        "UPDATE memo SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    get(conn, id)
}

/// 영구 삭제. 휴지통에 있을 때만 허용 — active 메모는 먼저 `soft_delete` 거치도록 강제.
pub fn purge(conn: &Connection, id: i64) -> Result<(), CoreError> {
    let current = get(conn, id)?;
    if current.deleted_at.is_none() {
        return Err(CoreError::InvalidInput(format!(
            "memo id={id} is not in trash; soft-delete first"
        )));
    }
    let affected = conn.execute("DELETE FROM memo WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("memo id={id}")));
    }
    Ok(())
}

/// 휴지통의 모든 메모를 영구 삭제. 삭제된 행 수 반환.
pub fn empty_trash(conn: &Connection) -> Result<usize, CoreError> {
    let affected = conn.execute("DELETE FROM memo WHERE deleted_at IS NOT NULL", [])?;
    Ok(affected)
}
