//! file_explorer repo 단위 테스트 — project_repo.rs 와 동일한 격리 패턴.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::repo::file_explorer as repo;
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

#[test]
fn touch_creates_then_updates_same_row() {
    let (_dir, conn) = fresh_conn();
    let a = repo::touch(&conn, "/Users/me/notes").unwrap();
    let b = repo::touch(&conn, "/Users/me/notes").unwrap();
    assert_eq!(a.id, b.id);
    assert_eq!(repo::list(&conn).unwrap().len(), 1);
}

#[test]
fn touch_rejects_empty_path() {
    let (_dir, conn) = fresh_conn();
    let err = repo::touch(&conn, "   ").unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)));
}

#[test]
fn list_orders_most_recent_first() {
    let (_dir, conn) = fresh_conn();
    repo::touch(&conn, "/a").unwrap();
    repo::touch(&conn, "/b").unwrap();
    let list = repo::list(&conn).unwrap();
    // 같은 초에 들어가도 id DESC 타이브레이크로 /b 가 먼저
    assert_eq!(list[0].path, "/b");
    assert_eq!(list[1].path, "/a");
}

#[test]
fn prune_keeps_only_20_non_favorites() {
    let (_dir, conn) = fresh_conn();
    for i in 0..21 {
        repo::touch(&conn, &format!("/folder-{i}")).unwrap();
    }
    let list = repo::list(&conn).unwrap();
    assert_eq!(list.len(), 20);
    // 가장 오래된(가장 먼저 touch 된) /folder-0 이 잘린다
    assert!(!list.iter().any(|f| f.path == "/folder-0"));
}

#[test]
fn favorites_survive_prune() {
    let (_dir, conn) = fresh_conn();
    let fav = repo::touch(&conn, "/keep-me").unwrap();
    repo::set_favorite(&conn, fav.id, true).unwrap();
    for i in 0..25 {
        repo::touch(&conn, &format!("/folder-{i}")).unwrap();
    }
    let list = repo::list(&conn).unwrap();
    assert!(list.iter().any(|f| f.path == "/keep-me" && f.is_favorite));
    let non_fav = list.iter().filter(|f| !f.is_favorite).count();
    assert_eq!(non_fav, 20);
}

#[test]
fn set_favorite_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let f = repo::touch(&conn, "/x").unwrap();
    assert!(!f.is_favorite);
    let f = repo::set_favorite(&conn, f.id, true).unwrap();
    assert!(f.is_favorite);
    let f = repo::set_favorite(&conn, f.id, false).unwrap();
    assert!(!f.is_favorite);
}

#[test]
fn set_favorite_unknown_id_is_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::set_favorite(&conn, 999, true).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)));
}

#[test]
fn remove_deletes_row() {
    let (_dir, conn) = fresh_conn();
    let f = repo::touch(&conn, "/gone").unwrap();
    repo::remove(&conn, f.id).unwrap();
    assert!(repo::list(&conn).unwrap().is_empty());
    let err = repo::remove(&conn, f.id).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)));
}
