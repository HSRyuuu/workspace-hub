//! memo_folder repo 단위 테스트.
//!
//! 격리: `tempfile::TempDir` + `db::open_at()`. `~/.workspace-hub` 를 절대 건드리지 않는다.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::models::memo::{NewMemoFolder, UpdateMemoFolder};
use workspace_hub_core::repo::memo_folder as repo;
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn mk(name: &str, parent: Option<i64>) -> NewMemoFolder {
    NewMemoFolder {
        parent_id: parent,
        name: name.into(),
    }
}

#[test]
fn create_root_folder_round_trip() {
    let (_dir, mut conn) = fresh_conn();
    let f = repo::create(&mut conn, &mk("Inbox", None)).unwrap();
    assert!(f.id > 0);
    assert_eq!(f.name, "Inbox");
    assert!(f.parent_id.is_none());
    assert_eq!(f.sort_order, 0);

    let got = repo::get(&conn, f.id).unwrap();
    assert_eq!(got.id, f.id);
    assert_eq!(got.name, "Inbox");
}

#[test]
fn create_assigns_incrementing_sort_order_per_parent() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", None)).unwrap();
    let a_child1 = repo::create(&mut conn, &mk("A1", Some(a.id))).unwrap();
    let a_child2 = repo::create(&mut conn, &mk("A2", Some(a.id))).unwrap();

    assert_eq!(a.sort_order, 0);
    assert_eq!(b.sort_order, 1);
    assert_eq!(a_child1.sort_order, 0); // 자식은 부모 안에서 0부터 다시.
    assert_eq!(a_child2.sort_order, 1);
}

#[test]
fn create_rejects_empty_name() {
    let (_dir, mut conn) = fresh_conn();
    let err = repo::create(&mut conn, &mk("   ", None)).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn create_rejects_nonexistent_parent() {
    let (_dir, mut conn) = fresh_conn();
    let err = repo::create(&mut conn, &mk("orphan", Some(9999))).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn list_all_returns_full_tree() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let _b = repo::create(&mut conn, &mk("B", None)).unwrap();
    let _a_child = repo::create(&mut conn, &mk("A-child", Some(a.id))).unwrap();

    let all = repo::list_all(&conn).unwrap();
    assert_eq!(all.len(), 3);
    let names: Vec<&str> = all.iter().map(|f| f.name.as_str()).collect();
    assert!(names.contains(&"A"));
    assert!(names.contains(&"B"));
    assert!(names.contains(&"A-child"));
}

#[test]
fn update_can_rename() {
    let (_dir, mut conn) = fresh_conn();
    let f = repo::create(&mut conn, &mk("old", None)).unwrap();
    let renamed = repo::update(
        &mut conn,
        f.id,
        &UpdateMemoFolder {
            name: Some("new".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(renamed.name, "new");
}

#[test]
fn update_can_move_under_other_folder() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", None)).unwrap();
    let moved = repo::update(
        &mut conn,
        b.id,
        &UpdateMemoFolder {
            parent_id: Some(Some(a.id)),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(moved.parent_id, Some(a.id));
}

#[test]
fn update_rejects_moving_under_self() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let err = repo::update(
        &mut conn,
        a.id,
        &UpdateMemoFolder {
            parent_id: Some(Some(a.id)),
            ..Default::default()
        },
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn update_rejects_moving_under_descendant() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", Some(a.id))).unwrap();
    let c = repo::create(&mut conn, &mk("C", Some(b.id))).unwrap();
    // A 를 C 아래로 → 사이클.
    let err = repo::update(
        &mut conn,
        a.id,
        &UpdateMemoFolder {
            parent_id: Some(Some(c.id)),
            ..Default::default()
        },
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn delete_cascades_to_descendant_folders() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", Some(a.id))).unwrap();
    let c = repo::create(&mut conn, &mk("C", Some(b.id))).unwrap();

    repo::delete(&mut conn, a.id).unwrap();

    assert!(matches!(
        repo::get(&conn, a.id).unwrap_err(),
        CoreError::NotFound(_)
    ));
    assert!(matches!(
        repo::get(&conn, b.id).unwrap_err(),
        CoreError::NotFound(_)
    ));
    assert!(matches!(
        repo::get(&conn, c.id).unwrap_err(),
        CoreError::NotFound(_)
    ));
}

#[test]
fn delete_moves_contained_memos_to_trash_and_clears_folder_id() {
    let (_dir, mut conn) = fresh_conn();
    use workspace_hub_core::models::memo::NewMemo;
    use workspace_hub_core::repo::memo as memo_repo;

    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", Some(a.id))).unwrap();
    let m_a = memo_repo::create(
        &conn,
        &NewMemo {
            folder_id: Some(a.id),
            title: "in A".into(),
            body: "hello".into(),
        },
    )
    .unwrap();
    let m_b = memo_repo::create(
        &conn,
        &NewMemo {
            folder_id: Some(b.id),
            title: "in B".into(),
            body: "world".into(),
        },
    )
    .unwrap();

    repo::delete(&mut conn, a.id).unwrap();

    // 메모 행 자체는 살아있고 휴지통(deleted_at NOT NULL), FK SET NULL 로 folder_id 가 NULL.
    let trashed_a = memo_repo::get(&conn, m_a.id).unwrap();
    let trashed_b = memo_repo::get(&conn, m_b.id).unwrap();
    assert!(trashed_a.deleted_at.is_some());
    assert!(trashed_b.deleted_at.is_some());
    assert!(trashed_a.folder_id.is_none());
    assert!(trashed_b.folder_id.is_none());
}

#[test]
fn delete_nonexistent_returns_not_found() {
    let (_dir, mut conn) = fresh_conn();
    let err = repo::delete(&mut conn, 9999).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)), "got {err:?}");
}

#[test]
fn reorder_reassigns_sort_order_0_to_n() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", None)).unwrap();
    let c = repo::create(&mut conn, &mk("C", None)).unwrap();
    // 초기: A=0, B=1, C=2 → 역순으로 reorder.
    repo::reorder(&mut conn, None, &[c.id, b.id, a.id]).unwrap();

    let after = repo::list_all(&conn).unwrap();
    let by_id = |id: i64| after.iter().find(|f| f.id == id).unwrap();
    assert_eq!(by_id(c.id).sort_order, 0);
    assert_eq!(by_id(b.id).sort_order, 1);
    assert_eq!(by_id(a.id).sort_order, 2);
}

#[test]
fn reorder_scopes_to_given_parent() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let a1 = repo::create(&mut conn, &mk("A1", Some(a.id))).unwrap();
    let a2 = repo::create(&mut conn, &mk("A2", Some(a.id))).unwrap();
    let a3 = repo::create(&mut conn, &mk("A3", Some(a.id))).unwrap();

    repo::reorder(&mut conn, Some(a.id), &[a3.id, a1.id, a2.id]).unwrap();

    let after = repo::list_all(&conn).unwrap();
    let by_id = |id: i64| after.iter().find(|f| f.id == id).unwrap();
    assert_eq!(by_id(a3.id).sort_order, 0);
    assert_eq!(by_id(a1.id).sort_order, 1);
    assert_eq!(by_id(a2.id).sort_order, 2);
    // 루트 A 의 sort_order 는 영향 없음.
    assert_eq!(by_id(a.id).sort_order, 0);
}

#[test]
fn reorder_rejects_partial_sibling_set() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", None)).unwrap();
    let _c = repo::create(&mut conn, &mk("C", None)).unwrap();
    let err = repo::reorder(&mut conn, None, &[a.id, b.id]).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn reorder_rejects_foreign_id() {
    let (_dir, mut conn) = fresh_conn();
    let root_a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let root_b = repo::create(&mut conn, &mk("B", None)).unwrap();
    let child = repo::create(&mut conn, &mk("child", Some(root_a.id))).unwrap();
    // root 형제 reorder 인데 자식 ID 가 섞임.
    let err =
        repo::reorder(&mut conn, None, &[root_a.id, root_b.id, child.id]).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn reorder_rejects_duplicate_ids() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", None)).unwrap();
    let err = repo::reorder(&mut conn, None, &[a.id, b.id, a.id]).unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)), "got {err:?}");
}

#[test]
fn update_move_reassigns_sort_order_to_last_in_new_parent() {
    let (_dir, mut conn) = fresh_conn();
    let a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let _a1 = repo::create(&mut conn, &mk("A1", Some(a.id))).unwrap();
    let _a2 = repo::create(&mut conn, &mk("A2", Some(a.id))).unwrap();
    let b = repo::create(&mut conn, &mk("B", None)).unwrap();
    // B 를 A 의 자식으로 이동 → A1(0), A2(1) 다음 = sort_order 2.
    let moved = repo::update(
        &mut conn,
        b.id,
        &UpdateMemoFolder {
            parent_id: Some(Some(a.id)),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(moved.parent_id, Some(a.id));
    assert_eq!(moved.sort_order, 2);
}

#[test]
fn update_rename_only_preserves_sort_order() {
    let (_dir, mut conn) = fresh_conn();
    let _a = repo::create(&mut conn, &mk("A", None)).unwrap();
    let b = repo::create(&mut conn, &mk("B", None)).unwrap();
    assert_eq!(b.sort_order, 1);
    let renamed = repo::update(
        &mut conn,
        b.id,
        &UpdateMemoFolder {
            name: Some("Bee".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(renamed.name, "Bee");
    assert_eq!(renamed.sort_order, 1); // 부모 변경 없음 → 유지.
}
