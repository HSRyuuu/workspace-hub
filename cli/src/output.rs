use serde::Serialize;
use workspace_hub_core::models::memo::{Memo, MemoFolder};
use workspace_hub_core::models::project::{Project, ProjectApplication, ProjectDirectory};
use workspace_hub_core::models::schedule::Schedule;
use workspace_hub_core::models::todo::Todo;
use workspace_hub_core::CoreError;

pub fn print_json<T: Serialize>(value: &T) -> Result<(), CoreError> {
    let s = serde_json::to_string_pretty(value)?;
    println!("{s}");
    Ok(())
}

/// 모든 명령이 공유하는 "JSON 기본 / `--human` 시 사람 친화 출력" 분기.
/// 도메인이 늘어날수록 명령 × verb 마다 if-else 가 누적되는 걸 한 곳으로 묶는다.
pub fn emit<T, F>(value: &T, human: bool, human_fn: F) -> Result<(), CoreError>
where
    T: Serialize,
    F: FnOnce(&T),
{
    if human {
        human_fn(value);
    } else {
        print_json(value)?;
    }
    Ok(())
}

pub fn print_todo_human(todo: &Todo) {
    use workspace_hub_core::models::todo::Priority;
    let status = todo.status.as_str();
    let prio = match todo.priority {
        Priority::Low => "낮음",
        Priority::Mid => "보통",
        Priority::High => "높음",
    };
    let due = todo.due_at.as_deref().unwrap_or("-");
    let ws = todo
        .workspace_id
        .map(|i| i.to_string())
        .unwrap_or_else(|| "-".into());
    println!(
        "#{id}  [{status}]  {prio}  due={due}  ws={ws}  {title}",
        id = todo.id,
        title = todo.title,
    );
    if let Some(desc) = &todo.description {
        if !desc.is_empty() {
            println!("       {desc}");
        }
    }
}

pub fn print_todos_human(todos: &[Todo]) {
    if todos.is_empty() {
        println!("(no todos)");
        return;
    }
    for t in todos {
        print_todo_human(t);
    }
    println!("\n{} item(s)", todos.len());
}

pub fn print_schedule_human(s: &Schedule) {
    let all_day = if s.all_day { "[all-day]" } else { "         " };
    let loc = s.location.as_deref().unwrap_or("-");
    let color = s.color.as_deref().unwrap_or("-");
    println!(
        "#{id}  {all_day}  {start} → {end}  loc={loc}  color={color}  {title}",
        id = s.id,
        start = s.start_at,
        end = s.end_at,
        title = s.title,
    );
    if let Some(desc) = &s.description {
        if !desc.is_empty() {
            println!("       {desc}");
        }
    }
}

pub fn print_schedules_human(items: &[Schedule]) {
    if items.is_empty() {
        println!("(no schedules)");
        return;
    }
    for s in items {
        print_schedule_human(s);
    }
    println!("\n{} item(s)", items.len());
}

fn memo_display_title(m: &Memo) -> String {
    if !m.title.is_empty() {
        return m.title.clone();
    }
    m.body
        .lines()
        .find(|l| !l.trim().is_empty())
        .map(|l| {
            l.trim_start_matches(|c: char| c == '#' || c.is_whitespace())
                .to_string()
        })
        .unwrap_or_else(|| "(untitled)".into())
}

pub fn print_memo_human(m: &Memo) {
    let folder = m
        .folder_id
        .map(|i| i.to_string())
        .unwrap_or_else(|| "-".into());
    let trash = if m.deleted_at.is_some() {
        "[trash]"
    } else {
        "       "
    };
    let pin = if m.pinned { "★" } else { " " };
    println!(
        "#{id}  {pin} {trash}  folder={folder}  {title}",
        id = m.id,
        title = memo_display_title(m),
    );
}

pub fn print_memos_human(items: &[Memo]) {
    if items.is_empty() {
        println!("(no memos)");
        return;
    }
    for m in items {
        print_memo_human(m);
    }
    println!("\n{} item(s)", items.len());
}

pub fn print_memo_folder_human(f: &MemoFolder) {
    let parent = f
        .parent_id
        .map(|i| i.to_string())
        .unwrap_or_else(|| "root".into());
    println!(
        "#{id}  parent={parent}  order={order}  {name}",
        id = f.id,
        order = f.sort_order,
        name = f.name,
    );
}

pub fn print_memo_folders_human(items: &[MemoFolder]) {
    if items.is_empty() {
        println!("(no folders)");
        return;
    }
    for f in items {
        print_memo_folder_human(f);
    }
    println!("\n{} folder(s)", items.len());
}

pub fn print_project_human(p: &Project) {
    let desc = p.description.as_deref().unwrap_or("-");
    println!(
        "#{id}  order={order}  color={color}  {title}",
        id = p.id,
        order = p.sort_order,
        color = p.color,
        title = p.title,
    );
    if desc != "-" {
        println!("       {desc}");
    }
}

pub fn print_projects_human(items: &[Project]) {
    if items.is_empty() {
        println!("(no projects)");
        return;
    }
    for p in items {
        print_project_human(p);
    }
    println!("\n{} project(s)", items.len());
}

pub fn print_project_dir_human(d: &ProjectDirectory) {
    let label = d.label.as_deref().unwrap_or("-");
    println!(
        "#{id}  project={pid}  label={label}  {path}",
        id = d.id,
        pid = d.project_id,
        path = d.path,
    );
}

pub fn print_project_dirs_human(items: &[ProjectDirectory]) {
    if items.is_empty() {
        println!("(no directories)");
        return;
    }
    for d in items {
        print_project_dir_human(d);
    }
    println!("\n{} directory(ies)", items.len());
}

pub fn print_project_app_human(a: &ProjectApplication) {
    let label = a.label.as_deref().unwrap_or("-");
    println!(
        "#{id}  project={pid}  label={label}  {path}",
        id = a.id,
        pid = a.project_id,
        path = a.path,
    );
}

pub fn print_project_apps_human(items: &[ProjectApplication]) {
    if items.is_empty() {
        println!("(no applications)");
        return;
    }
    for a in items {
        print_project_app_human(a);
    }
    println!("\n{} application(s)", items.len());
}
