use clap::{Args, Subcommand};

use workspace_hub_core::{
    db,
    models::todo::{NewTodo, Priority, TodoStatus},
    repo::todo::{self as repo, TodoPatch},
};

use crate::commands::clear_or_value;
use crate::{output, AppError};

#[derive(Subcommand)]
pub enum TodoCommand {
    /// 새 TODO 추가
    Add(AddArgs),
    /// TODO 목록
    List(ListArgs),
    /// TODO 업데이트 (제목·설명·마감·우선순위·상태)
    Update(UpdateArgs),
    /// TODO 완료 처리
    Complete(IdArg),
    /// TODO 완료 해제
    Uncomplete(IdArg),
    /// TODO 삭제
    Delete(IdArg),
}

#[derive(Args)]
pub struct AddArgs {
    /// 제목 (필수)
    #[arg(long, allow_hyphen_values = true)]
    pub title: String,

    /// 상세 설명 (선택)
    #[arg(long, allow_hyphen_values = true)]
    pub description: Option<String>,

    /// 시작일 — YYYY-MM-DD 또는 RFC3339. DateTime 이면 날짜만 보존.
    #[arg(long)]
    pub start: Option<String>,

    /// 마감일 — YYYY-MM-DD 또는 RFC3339. DateTime 이면 날짜만 보존.
    #[arg(long)]
    pub due: Option<String>,

    /// 마감 시간 — HH:MM 또는 0..1439 분.
    #[arg(long)]
    pub due_time: Option<String>,

    /// 우선순위 (low / mid / high)
    #[arg(long, value_enum, default_value_t = Priority::Mid)]
    pub priority: Priority,

    /// 워크스페이스 ID (선택)
    #[arg(long)]
    pub workspace: Option<i64>,
}

#[derive(Args)]
pub struct UpdateArgs {
    /// TODO id
    pub id: i64,

    /// 새 제목
    #[arg(long, allow_hyphen_values = true)]
    pub title: Option<String>,

    /// 새 설명
    #[arg(long, allow_hyphen_values = true)]
    pub description: Option<String>,

    /// 설명 지우기
    #[arg(long)]
    pub clear_description: bool,

    /// 새 마감일 (YYYY-MM-DD 또는 RFC3339)
    #[arg(long)]
    pub due: Option<String>,

    /// 새 시작일 (YYYY-MM-DD 또는 RFC3339)
    #[arg(long)]
    pub start: Option<String>,

    /// 새 마감 시간 — HH:MM 또는 0..1439 분.
    #[arg(long)]
    pub due_time: Option<String>,

    /// 마감일 지우기
    #[arg(long)]
    pub clear_due: bool,

    /// 우선순위 (low / mid / high)
    #[arg(long, value_enum)]
    pub priority: Option<Priority>,

    /// 상태 (open / done)
    #[arg(long, value_enum)]
    pub status: Option<TodoStatus>,
}

#[derive(Args)]
pub struct ListArgs {
    /// 상태 필터
    #[arg(long, value_enum, default_value_t = ListStatus::All)]
    pub status: ListStatus,
}

#[derive(Args)]
pub struct IdArg {
    /// TODO id
    pub id: i64,
}

#[derive(Copy, Clone, clap::ValueEnum)]
pub enum ListStatus {
    All,
    Open,
    Done,
}

fn parse_due_time(raw: Option<&String>) -> Result<Option<i64>, AppError> {
    let Some(raw) = raw else { return Ok(None) };
    let s = raw.trim();
    if s.is_empty() {
        return Ok(None);
    }

    if let Some((h, m)) = s.split_once(':') {
        let hour = h
            .parse::<i64>()
            .map_err(|_| AppError::User(format!("due_time must be HH:MM or minutes, got: {s}")))?;
        let minute = m
            .parse::<i64>()
            .map_err(|_| AppError::User(format!("due_time must be HH:MM or minutes, got: {s}")))?;
        if (0..=23).contains(&hour) && (0..=59).contains(&minute) {
            return Ok(Some(hour * 60 + minute));
        }
        return Err(AppError::User(format!(
            "due_time must be between 00:00 and 23:59, got: {s}"
        )));
    }

    let minutes = s
        .parse::<i64>()
        .map_err(|_| AppError::User(format!("due_time must be HH:MM or minutes, got: {s}")))?;
    if (0..=1439).contains(&minutes) {
        Ok(Some(minutes))
    } else {
        Err(AppError::User("due_time must be between 0 and 1439".into()))
    }
}

pub fn run(cmd: &TodoCommand, human: bool) -> Result<(), AppError> {
    let conn = db::open()?;
    match cmd {
        TodoCommand::Add(args) => {
            // 날짜 검증·정규화는 core::repo::create 안에서 수행된다 (raw 값을 그대로 전달).
            let new = NewTodo {
                workspace_id: args.workspace,
                title: args.title.clone(),
                description: args.description.clone(),
                start_date: args.start.clone(),
                due_date: args.due.clone(),
                due_time: parse_due_time(args.due_time.as_ref())?,
                priority: args.priority,
            };
            let todo = repo::create(&conn, &new)?;
            output::emit(&todo, human, output::print_todo_human)?;
        }
        TodoCommand::List(args) => {
            let filter = match args.status {
                ListStatus::All => None,
                ListStatus::Open => Some(TodoStatus::Open),
                ListStatus::Done => Some(TodoStatus::Done),
            };
            let todos = repo::list(&conn, filter)?;
            output::emit(&todos, human, |ts| output::print_todos_human(ts))?;
        }
        TodoCommand::Update(args) => {
            let patch = TodoPatch {
                title: args.title.clone(),
                description: clear_or_value(args.clear_description, args.description.clone()),
                start_date: args.start.clone(),
                due_date: clear_or_value(args.clear_due, args.due.clone()),
                due_time: parse_due_time(args.due_time.as_ref())?,
                priority: args.priority,
                status: args.status,
            };
            let todo = repo::update(&conn, args.id, &patch)?;
            output::emit(&todo, human, output::print_todo_human)?;
        }
        TodoCommand::Complete(id) => {
            let todo = repo::complete(&conn, id.id)?;
            output::emit(&todo, human, output::print_todo_human)?;
        }
        TodoCommand::Uncomplete(id) => {
            let todo = repo::uncomplete(&conn, id.id)?;
            output::emit(&todo, human, output::print_todo_human)?;
        }
        TodoCommand::Delete(id) => {
            repo::delete(&conn, id.id)?;
            let ack = serde_json::json!({ "deleted": id.id });
            output::emit(&ack, human, |_| println!("deleted #{}", id.id))?;
        }
    }
    Ok(())
}
