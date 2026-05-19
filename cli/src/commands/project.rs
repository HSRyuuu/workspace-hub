use clap::{Args, Subcommand};

use workspace_hub_core::{
    db,
    models::project::{
        NewProject, NewProjectApplication, NewProjectDirectory, UpdateProject,
        UpdateProjectApplication, UpdateProjectDirectory,
    },
    repo::{
        memo_project as link_repo, project as repo, project_application as app_repo,
        project_directory as dir_repo,
    },
};

use crate::commands::clear_or_value;
use crate::{output, AppError};

#[derive(Subcommand)]
pub enum ProjectCommand {
    /// 새 프로젝트 추가
    Add(AddArgs),
    /// 프로젝트 목록 (sort_order ASC)
    List,
    /// 프로젝트 단건 조회
    Get(IdArg),
    /// 프로젝트 수정 (지정한 필드만)
    Update(UpdateArgs),
    /// 프로젝트 삭제 (디렉터리도 CASCADE)
    Delete(IdArg),
    /// 프로젝트 디렉터리 명령
    #[command(subcommand)]
    Dir(DirCommand),
    /// 프로젝트 응용프로그램(.app) 명령
    #[command(subcommand)]
    App(AppCommand),
    /// 프로젝트에 매핑된 메모 목록
    Memos(IdArg),
}

#[derive(Subcommand)]
pub enum DirCommand {
    /// 디렉터리 추가
    Add(DirAddArgs),
    /// 프로젝트의 디렉터리 목록
    List(DirListArgs),
    /// 디렉터리 수정
    Update(DirUpdateArgs),
    /// 디렉터리 삭제
    Delete(IdArg),
}

#[derive(Subcommand)]
pub enum AppCommand {
    /// 응용프로그램 추가
    Add(AppAddArgs),
    /// 프로젝트의 응용프로그램 목록
    List(AppListArgs),
    /// 응용프로그램 수정
    Update(AppUpdateArgs),
    /// 응용프로그램 삭제
    Delete(IdArg),
}

#[derive(Args)]
pub struct AddArgs {
    /// 제목 (필수)
    #[arg(long, allow_hyphen_values = true)]
    pub title: String,

    /// 설명 (선택)
    #[arg(long, allow_hyphen_values = true)]
    pub description: Option<String>,

    /// 색상 (hex, 예: #3F3393)
    #[arg(long)]
    pub color: Option<String>,

    /// 사이드바 정렬 순서
    #[arg(long)]
    pub sort_order: Option<i64>,
}

#[derive(Args)]
pub struct IdArg {
    pub id: i64,
}

#[derive(Args)]
pub struct UpdateArgs {
    pub id: i64,

    #[arg(long, allow_hyphen_values = true)]
    pub title: Option<String>,

    /// 설명
    #[arg(long, allow_hyphen_values = true, conflicts_with = "clear_description")]
    pub description: Option<String>,

    /// 설명 지우기
    #[arg(long)]
    pub clear_description: bool,

    #[arg(long, allow_hyphen_values = true)]
    pub color: Option<String>,

    #[arg(long)]
    pub sort_order: Option<i64>,
}

#[derive(Args)]
pub struct DirAddArgs {
    /// 부모 project id
    #[arg(long)]
    pub project: i64,

    /// 절대 경로 (필수)
    #[arg(long)]
    pub path: String,

    /// 사용자 별칭 (선택)
    #[arg(long, allow_hyphen_values = true)]
    pub label: Option<String>,
}

#[derive(Args)]
pub struct DirListArgs {
    /// 부모 project id
    #[arg(long)]
    pub project: i64,
}

#[derive(Args)]
pub struct DirUpdateArgs {
    pub id: i64,

    #[arg(long)]
    pub path: Option<String>,

    /// 라벨
    #[arg(long, allow_hyphen_values = true, conflicts_with = "clear_label")]
    pub label: Option<String>,

    /// 라벨 지우기
    #[arg(long)]
    pub clear_label: bool,
}

#[derive(Args)]
pub struct AppAddArgs {
    /// 부모 project id
    #[arg(long)]
    pub project: i64,

    /// .app 번들 절대 경로
    #[arg(long)]
    pub path: String,

    /// 사용자 별칭 (선택)
    #[arg(long, allow_hyphen_values = true)]
    pub label: Option<String>,
}

#[derive(Args)]
pub struct AppListArgs {
    /// 부모 project id
    #[arg(long)]
    pub project: i64,
}

#[derive(Args)]
pub struct AppUpdateArgs {
    pub id: i64,

    #[arg(long)]
    pub path: Option<String>,

    /// 라벨
    #[arg(long, allow_hyphen_values = true, conflicts_with = "clear_label")]
    pub label: Option<String>,

    /// 라벨 지우기
    #[arg(long)]
    pub clear_label: bool,
}

pub fn run(cmd: &ProjectCommand, human: bool) -> Result<(), AppError> {
    let conn = db::open()?;
    match cmd {
        ProjectCommand::Add(args) => {
            let new = NewProject {
                title: args.title.clone(),
                description: args.description.clone(),
                color: args.color.clone(),
                sort_order: args.sort_order,
            };
            let p = repo::create(&conn, &new)?;
            output::emit(&p, human, output::print_project_human)?;
        }
        ProjectCommand::List => {
            let items = repo::list(&conn)?;
            output::emit(&items, human, |xs| output::print_projects_human(xs))
                ?;
        }
        ProjectCommand::Get(id) => {
            let p = repo::get(&conn, id.id)?;
            output::emit(&p, human, output::print_project_human)?;
        }
        ProjectCommand::Update(args) => {
            let patch = UpdateProject {
                title: args.title.clone(),
                description: clear_or_value(args.clear_description, args.description.clone()),
                color: args.color.clone(),
                sort_order: args.sort_order,
            };
            let p = repo::update(&conn, args.id, &patch)?;
            output::emit(&p, human, output::print_project_human)?;
        }
        ProjectCommand::Delete(id) => {
            repo::delete(&conn, id.id)?;
            let ack = serde_json::json!({ "deleted": id.id });
            output::emit(&ack, human, |_| println!("deleted #{}", id.id))
                ?;
        }
        ProjectCommand::Dir(DirCommand::Add(args)) => {
            let new = NewProjectDirectory {
                project_id: args.project,
                path: args.path.clone(),
                label: args.label.clone(),
            };
            let d = dir_repo::create(&conn, &new)?;
            output::emit(&d, human, output::print_project_dir_human)
                ?;
        }
        ProjectCommand::Dir(DirCommand::List(args)) => {
            let items =
                dir_repo::list_by_project(&conn, args.project)?;
            output::emit(&items, human, |xs| output::print_project_dirs_human(xs))
                ?;
        }
        ProjectCommand::Dir(DirCommand::Update(args)) => {
            let patch = UpdateProjectDirectory {
                path: args.path.clone(),
                label: clear_or_value(args.clear_label, args.label.clone()),
            };
            let d = dir_repo::update(&conn, args.id, &patch)?;
            output::emit(&d, human, output::print_project_dir_human)
                ?;
        }
        ProjectCommand::Dir(DirCommand::Delete(id)) => {
            dir_repo::delete(&conn, id.id)?;
            let ack = serde_json::json!({ "deleted": id.id });
            output::emit(&ack, human, |_| println!("deleted #{}", id.id))
                ?;
        }
        ProjectCommand::App(AppCommand::Add(args)) => {
            let new = NewProjectApplication {
                project_id: args.project,
                path: args.path.clone(),
                label: args.label.clone(),
            };
            let a = app_repo::create(&conn, &new)?;
            output::emit(&a, human, output::print_project_app_human)
                ?;
        }
        ProjectCommand::App(AppCommand::List(args)) => {
            let items =
                app_repo::list_by_project(&conn, args.project)?;
            output::emit(&items, human, |xs| output::print_project_apps_human(xs))
                ?;
        }
        ProjectCommand::App(AppCommand::Update(args)) => {
            let patch = UpdateProjectApplication {
                path: args.path.clone(),
                label: clear_or_value(args.clear_label, args.label.clone()),
            };
            let a = app_repo::update(&conn, args.id, &patch)?;
            output::emit(&a, human, output::print_project_app_human)
                ?;
        }
        ProjectCommand::App(AppCommand::Delete(id)) => {
            app_repo::delete(&conn, id.id)?;
            let ack = serde_json::json!({ "deleted": id.id });
            output::emit(&ack, human, |_| println!("deleted #{}", id.id))
                ?;
        }
        ProjectCommand::Memos(id) => {
            let items = link_repo::list_memos_for_project(&conn, id.id)
                ?;
            output::emit(&items, human, |xs| output::print_memos_human(xs))
                ?;
        }
    }
    Ok(())
}
