//! Today dashboard repo 통합 테스트.
//!
//! 모든 데이터는 TempDir 안의 sqlite에만 기록한다.

use rusqlite::{params, Connection};
use tempfile::TempDir;
use workspace_hub_core::db;
use workspace_hub_core::models::memo::NewMemo;
use workspace_hub_core::models::todo::{NewTodo, Priority};
use workspace_hub_core::repo::{dashboard, file_explorer, memo, todo};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

fn create_todo(conn: &Connection, title: &str, due_date: Option<&str>) -> i64 {
    todo::create(
        conn,
        &NewTodo {
            title: title.into(),
            due_date: due_date.map(str::to_string),
            priority: Priority::Mid,
            ..Default::default()
        },
    )
    .unwrap()
    .id
}

#[test]
fn summary_limits_open_todos_and_counts_all_open_items() {
    let (_dir, conn) = fresh_conn();
    for day in 1..=8 {
        let id = create_todo(&conn, &format!("todo-{day}"), None);
        conn.execute(
            "UPDATE todo SET created_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![format!("2026-07-{day:02}T00:00:00Z"), id],
        )
        .unwrap();
    }

    let result = dashboard::summary(&conn, "2026-07-12").unwrap();

    assert_eq!(result.open_total, 8);
    assert_eq!(result.open_todos.len(), 7);
    assert_eq!(result.open_todos[0].title, "todo-1");
    assert_eq!(result.open_todos[6].title, "todo-7");
}

#[test]
fn summary_returns_only_open_due_todos_through_week_end() {
    let (_dir, conn) = fresh_conn();
    let before = create_todo(&conn, "before", Some("2026-07-10"));
    let boundary = create_todo(&conn, "boundary", Some("2026-07-12"));
    let after = create_todo(&conn, "after", Some("2026-07-13"));
    let done = create_todo(&conn, "done", Some("2026-07-11"));
    todo::complete(&conn, done).unwrap();

    let result = dashboard::summary(&conn, "2026-07-12").unwrap();
    let ids: Vec<i64> = result.due_todos.iter().map(|item| item.id).collect();

    assert_eq!(ids, vec![before, boundary]);
    assert!(!ids.contains(&after));
    assert!(!ids.contains(&done));
}

#[test]
fn summary_returns_five_most_recent_active_memos_ignoring_pinned() {
    let (_dir, conn) = fresh_conn();
    let mut memo_ids = Vec::new();
    for day in 1..=7 {
        let created = memo::create(
            &conn,
            &NewMemo {
                folder_id: None,
                title: format!("memo-{day}"),
                body: String::new(),
            },
        )
        .unwrap();
        conn.execute(
            "UPDATE memo SET updated_at = ?1 WHERE id = ?2",
            params![format!("2026-07-{day:02}T00:00:00Z"), created.id],
        )
        .unwrap();
        memo_ids.push(created.id);
    }
    conn.execute("UPDATE memo SET pinned = 1 WHERE id = ?1", [memo_ids[0]])
        .unwrap();
    conn.execute(
        "UPDATE memo SET deleted_at = '2026-07-08T00:00:00Z' WHERE id = ?1",
        [memo_ids[6]],
    )
    .unwrap();

    let result = dashboard::summary(&conn, "2026-07-12").unwrap();
    let titles: Vec<&str> = result
        .recent_memos
        .iter()
        .map(|item| item.title.as_str())
        .collect();

    assert_eq!(
        titles,
        vec!["memo-6", "memo-5", "memo-4", "memo-3", "memo-2"]
    );
}

#[test]
fn summary_returns_five_most_recent_folders() {
    let (_dir, conn) = fresh_conn();
    for day in 1..=6 {
        let folder = file_explorer::touch(&conn, &format!("/folder-{day}"))
            .unwrap()
            .unwrap();
        conn.execute(
            "UPDATE file_explorer_folder SET last_opened_at = ?1 WHERE id = ?2",
            params![format!("2026-07-{day:02}T00:00:00Z"), folder.id],
        )
        .unwrap();
    }

    let result = dashboard::summary(&conn, "2026-07-12").unwrap();
    let paths: Vec<&str> = result
        .recent_folders
        .iter()
        .map(|item| item.path.as_str())
        .collect();

    assert_eq!(
        paths,
        vec![
            "/folder-6",
            "/folder-5",
            "/folder-4",
            "/folder-3",
            "/folder-2"
        ]
    );
}
