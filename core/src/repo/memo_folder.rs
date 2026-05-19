use rusqlite::{params, Connection, Row, Transaction};

use crate::error::CoreError;
use crate::models::memo::{MemoFolder, NewMemoFolder, UpdateMemoFolder};
use crate::repo::now_iso;

const SELECT_COLUMNS: &str = "id, parent_id, name, sort_order, created_at, updated_at";

fn map_row(row: &Row<'_>) -> rusqlite::Result<MemoFolder> {
    Ok(MemoFolder {
        id: row.get("id")?,
        parent_id: row.get("parent_id")?,
        name: row.get("name")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn ensure_parent_exists(conn: &Connection, parent_id: i64) -> Result<(), CoreError> {
    get(conn, parent_id)?;
    Ok(())
}

pub fn create(conn: &mut Connection, input: &NewMemoFolder) -> Result<MemoFolder, CoreError> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(CoreError::InvalidInput("name is required".into()));
    }
    if let Some(pid) = input.parent_id {
        ensure_parent_exists(conn, pid)?;
    }
    let now = now_iso();
    let tx = conn.transaction()?;
    // 같은 부모 안에서 가장 큰 sort_order + 1 을 부여 — UI 에서 뒤에 추가되는 직관.
    // SELECT MAX + INSERT 사이의 race 를 막기 위해 트랜잭션 내에서 묶는다.
    let next_order: i64 = match input.parent_id {
        Some(pid) => tx.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM memo_folder WHERE parent_id = ?1",
            params![pid],
            |r| r.get(0),
        )?,
        None => tx.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM memo_folder WHERE parent_id IS NULL",
            [],
            |r| r.get(0),
        )?,
    };
    tx.execute(
        "INSERT INTO memo_folder (parent_id, name, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![input.parent_id, name, next_order, now],
    )?;
    let id = tx.last_insert_rowid();
    let sql = format!("SELECT {SELECT_COLUMNS} FROM memo_folder WHERE id = ?1");
    let folder = tx.query_row(&sql, params![id], map_row)?;
    tx.commit()?;
    Ok(folder)
}

pub fn get(conn: &Connection, id: i64) -> Result<MemoFolder, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM memo_folder WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                CoreError::NotFound(format!("memo_folder id={id}"))
            }
            other => CoreError::Sqlite(other),
        })
}

/// 전체 폴더 목록 (트리 조립은 호출자 책임). 정렬: parent_id NULLS FIRST, sort_order, id.
pub fn list_all(conn: &Connection) -> Result<Vec<MemoFolder>, CoreError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM memo_folder \
         ORDER BY (parent_id IS NOT NULL), parent_id ASC, sort_order ASC, id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(
    conn: &mut Connection,
    id: i64,
    patch: &UpdateMemoFolder,
) -> Result<MemoFolder, CoreError> {
    let current = get(conn, id)?;

    let name = match &patch.name {
        Some(n) => {
            let t = n.trim();
            if t.is_empty() {
                return Err(CoreError::InvalidInput("name cannot be empty".into()));
            }
            t.to_string()
        }
        None => current.name.clone(),
    };

    let parent_id = match patch.parent_id {
        Some(new_parent) => {
            if let Some(target) = new_parent {
                if target == id {
                    return Err(CoreError::InvalidInput(
                        "folder cannot be its own parent".into(),
                    ));
                }
                ensure_parent_exists(conn, target)?;
                // target 이 id 의 자손이면 사이클 — 금지.
                let descendants = collect_subtree_ids(conn, id)?;
                if descendants.contains(&target) {
                    return Err(CoreError::InvalidInput(
                        "cannot move folder under its own descendant".into(),
                    ));
                }
            }
            new_parent
        }
        None => current.parent_id,
    };

    let now = now_iso();
    let tx = conn.transaction()?;
    // 부모가 실제로 바뀌었으면 새 부모의 마지막 자식으로 — sort_order = MAX(새 부모)+1.
    // 같은 부모면 sort_order 유지(reorder 는 별도 API 가 처리).
    // SELECT MAX + UPDATE 를 같은 트랜잭션에 두어 동시 이동 시 sort_order 충돌 차단.
    let parent_changed = parent_id != current.parent_id;
    let sort_order = if parent_changed {
        match parent_id {
            Some(pid) => tx.query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM memo_folder \
                 WHERE parent_id = ?1 AND id <> ?2",
                params![pid, id],
                |r| r.get::<_, i64>(0),
            )?,
            None => tx.query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM memo_folder \
                 WHERE parent_id IS NULL AND id <> ?1",
                params![id],
                |r| r.get::<_, i64>(0),
            )?,
        }
    } else {
        current.sort_order
    };

    let affected = tx.execute(
        "UPDATE memo_folder SET name = ?1, parent_id = ?2, sort_order = ?3, updated_at = ?4 \
         WHERE id = ?5",
        params![name, parent_id, sort_order, now, id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("memo_folder id={id}")));
    }
    let sql = format!("SELECT {SELECT_COLUMNS} FROM memo_folder WHERE id = ?1");
    let folder = tx.query_row(&sql, params![id], map_row)?;
    tx.commit()?;
    Ok(folder)
}

/// 같은 부모(`parent_id`) 아래 형제 폴더들의 순서를 `ordered_ids` 배열대로 0..N 으로 재할당한다.
/// 호출자는 그 부모의 **모든 자식 폴더 id 를 빠짐없이** 보내야 한다 — 누락/추가/타 부모 혼입은 InvalidInput.
pub fn reorder(
    conn: &mut Connection,
    parent_id: Option<i64>,
    ordered_ids: &[i64],
) -> Result<(), CoreError> {
    if let Some(pid) = parent_id {
        ensure_parent_exists(conn, pid)?;
    }

    // 1. 입력 id 들의 중복 검사.
    let mut seen = std::collections::HashSet::new();
    for id in ordered_ids {
        if !seen.insert(*id) {
            return Err(CoreError::InvalidInput(format!(
                "duplicate id in ordered_ids: {id}"
            )));
        }
    }

    // 2. DB 의 현재 형제 집합과 정확히 일치하는지 확인.
    let mut stmt = match parent_id {
        Some(_) => conn.prepare("SELECT id FROM memo_folder WHERE parent_id = ?1")?,
        None => conn.prepare("SELECT id FROM memo_folder WHERE parent_id IS NULL")?,
    };
    let current: std::collections::HashSet<i64> = match parent_id {
        Some(pid) => stmt
            .query_map(params![pid], |r| r.get::<_, i64>(0))?
            .collect::<Result<_, _>>()?,
        None => stmt
            .query_map([], |r| r.get::<_, i64>(0))?
            .collect::<Result<_, _>>()?,
    };
    drop(stmt);
    if current != seen {
        return Err(CoreError::InvalidInput(
            "ordered_ids must contain exactly the children of the given parent".into(),
        ));
    }

    // 3. 트랜잭션 내에서 0..N 으로 재할당.
    let now = now_iso();
    let tx = conn.transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE memo_folder SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![idx as i64, now, id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// 폴더 삭제: 자기 자신 + 모든 자손 폴더를 hard delete. 그 폴더들에 속한 active 메모는
/// 휴지통으로(`deleted_at = now`). FK `ON DELETE SET NULL` 이 폴더 행이 사라진 직후
/// 메모의 `folder_id` 를 NULL 로 만든다(루트 폴더 = 휴지통 표시).
pub fn delete(conn: &mut Connection, id: i64) -> Result<(), CoreError> {
    get(conn, id)?; // 존재 확인 → NotFound 우선
    let tx = conn.transaction()?;
    let folder_ids = collect_subtree_ids_tx(&tx, id)?;
    let now = now_iso();
    // 폴더가 사라지기 전에 메모를 휴지통으로. (자기 + 자손 폴더 모두)
    for fid in &folder_ids {
        tx.execute(
            "UPDATE memo SET deleted_at = ?1, updated_at = ?1 \
             WHERE folder_id = ?2 AND deleted_at IS NULL",
            params![now, fid],
        )?;
    }
    // 루트만 DELETE — CASCADE 가 자손 폴더를 자동 정리.
    tx.execute("DELETE FROM memo_folder WHERE id = ?1", params![id])?;
    tx.commit()?;
    Ok(())
}

/// `root` 를 포함한 자기·자손 폴더 ID 모음. BFS.
fn collect_subtree_ids(conn: &Connection, root: i64) -> Result<Vec<i64>, CoreError> {
    let mut visited = vec![root];
    let mut frontier = vec![root];
    while let Some(p) = frontier.pop() {
        let mut stmt = conn.prepare("SELECT id FROM memo_folder WHERE parent_id = ?1")?;
        let children: Vec<i64> = stmt
            .query_map(params![p], |r| r.get::<_, i64>(0))?
            .collect::<Result<_, _>>()?;
        for c in children {
            visited.push(c);
            frontier.push(c);
        }
    }
    Ok(visited)
}

/// `collect_subtree_ids` 의 트랜잭션 버전 — 같은 transaction 안에서 일관된 스냅샷을 본다.
fn collect_subtree_ids_tx(tx: &Transaction<'_>, root: i64) -> Result<Vec<i64>, CoreError> {
    let mut visited = vec![root];
    let mut frontier = vec![root];
    while let Some(p) = frontier.pop() {
        let mut stmt = tx.prepare("SELECT id FROM memo_folder WHERE parent_id = ?1")?;
        let children: Vec<i64> = stmt
            .query_map(params![p], |r| r.get::<_, i64>(0))?
            .collect::<Result<_, _>>()?;
        for c in children {
            visited.push(c);
            frontier.push(c);
        }
    }
    Ok(visited)
}
