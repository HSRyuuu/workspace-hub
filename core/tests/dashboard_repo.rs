//! Today dashboard repo 통합 테스트.
//!
//! 모든 데이터는 TempDir 안의 sqlite에만 기록한다.

use rusqlite::{params, Connection};
use tempfile::TempDir;
use workspace_hub_core::db;
use workspace_hub_core::models::todo::{NewTodo, Priority};
use workspace_hub_core::repo::{dashboard, todo};

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
