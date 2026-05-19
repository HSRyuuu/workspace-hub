use clap::{Args, Subcommand};

use workspace_hub_core::{
    db,
    models::schedule::{NewSchedule, UpdateSchedule},
    repo::schedule as repo,
};

use crate::commands::clear_or_value;
use crate::{output, AppError};

#[derive(Subcommand)]
pub enum ScheduleCommand {
    /// 새 일정 추가
    Add(AddArgs),
    /// 일정 목록 (`--from`/`--to` 미지정 시 전체)
    List(ListArgs),
    /// 일정 단건 조회
    Get(IdArg),
    /// 일정 수정 (지정한 필드만)
    Update(UpdateArgs),
    /// 일정 삭제
    Delete(IdArg),
}

#[derive(Args)]
pub struct AddArgs {
    /// 제목 (필수)
    #[arg(long, allow_hyphen_values = true)]
    pub title: String,

    /// 시작 — YYYY-MM-DD 또는 RFC3339 (예: 2026-05-20T09:00:00Z)
    #[arg(long)]
    pub start: String,

    /// 종료 — YYYY-MM-DD 또는 RFC3339
    #[arg(long)]
    pub end: String,

    /// 종일 여부
    #[arg(long, default_value_t = false)]
    pub all_day: bool,

    /// 상세 설명 (선택)
    #[arg(long, allow_hyphen_values = true)]
    pub description: Option<String>,

    /// 장소 (선택)
    #[arg(long, allow_hyphen_values = true)]
    pub location: Option<String>,

    /// 색상 (hex, 예: #3F3393)
    #[arg(long)]
    pub color: Option<String>,
}

#[derive(Args)]
pub struct ListArgs {
    /// 범위 시작 (포함)
    #[arg(long)]
    pub from: Option<String>,

    /// 범위 끝 (제외)
    #[arg(long)]
    pub to: Option<String>,
}

#[derive(Args)]
pub struct IdArg {
    /// schedule id
    pub id: i64,
}

#[derive(Args)]
pub struct UpdateArgs {
    /// schedule id
    pub id: i64,

    #[arg(long, allow_hyphen_values = true)]
    pub title: Option<String>,

    #[arg(long)]
    pub start: Option<String>,

    #[arg(long)]
    pub end: Option<String>,

    /// 종일 여부 (지정 시에만 변경)
    #[arg(long)]
    pub all_day: Option<bool>,

    /// 설명
    #[arg(long, allow_hyphen_values = true, conflicts_with = "clear_description")]
    pub description: Option<String>,

    /// 설명 지우기
    #[arg(long)]
    pub clear_description: bool,

    /// 장소
    #[arg(long, allow_hyphen_values = true, conflicts_with = "clear_location")]
    pub location: Option<String>,

    /// 장소 지우기
    #[arg(long)]
    pub clear_location: bool,

    /// 색상
    #[arg(long, allow_hyphen_values = true, conflicts_with = "clear_color")]
    pub color: Option<String>,

    /// 색상 지우기
    #[arg(long)]
    pub clear_color: bool,
}

pub fn run(cmd: &ScheduleCommand, human: bool) -> Result<(), AppError> {
    let conn = db::open()?;
    match cmd {
        ScheduleCommand::Add(args) => {
            let new = NewSchedule {
                title: args.title.clone(),
                description: args.description.clone(),
                location: args.location.clone(),
                start_at: args.start.clone(),
                end_at: args.end.clone(),
                all_day: args.all_day,
                color: args.color.clone(),
            };
            let s = repo::create(&conn, &new)?;
            output::emit(&s, human, output::print_schedule_human)?;
        }
        ScheduleCommand::List(args) => {
            let items = match (args.from.as_deref(), args.to.as_deref()) {
                (Some(f), Some(t)) => {
                    repo::list_in_range(&conn, f, t)?
                }
                (None, None) => repo::list(&conn)?,
                _ => {
                    return Err(AppError::User(
                        "--from and --to must be provided together".into(),
                    ))
                }
            };
            output::emit(&items, human, |xs| output::print_schedules_human(xs))
                ?;
        }
        ScheduleCommand::Get(id) => {
            let s = repo::get(&conn, id.id)?;
            output::emit(&s, human, output::print_schedule_human)?;
        }
        ScheduleCommand::Update(args) => {
            let patch = UpdateSchedule {
                title: args.title.clone(),
                description: clear_or_value(args.clear_description, args.description.clone()),
                location: clear_or_value(args.clear_location, args.location.clone()),
                start_at: args.start.clone(),
                end_at: args.end.clone(),
                all_day: args.all_day,
                color: clear_or_value(args.clear_color, args.color.clone()),
            };
            let s = repo::update(&conn, args.id, &patch)?;
            output::emit(&s, human, output::print_schedule_human)?;
        }
        ScheduleCommand::Delete(id) => {
            repo::delete(&conn, id.id)?;
            let ack = serde_json::json!({ "deleted": id.id });
            output::emit(&ack, human, |_| println!("deleted #{}", id.id))
                ?;
        }
    }
    Ok(())
}
