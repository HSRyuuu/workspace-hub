use clap::{Parser, Subcommand};

mod commands;
mod output;

use commands::memo::MemoCommand;
use commands::memo_folder::MemoFolderCommand;
use commands::project::ProjectCommand;
use commands::schedule::ScheduleCommand;
use commands::todo::TodoCommand;
use workspace_hub_core::CoreError;

#[derive(Parser)]
#[command(
    name = "workspace-hub",
    version,
    about = "workspace-hub CLI — single source of truth for local TODO / memo / calendar / workspace data."
)]
struct Cli {
    /// Human-readable output (table). Default is JSON for programmatic callers.
    #[arg(long, global = true)]
    human: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// TODO 명령
    #[command(subcommand)]
    Todo(TodoCommand),

    /// 캘린더 일정 명령
    #[command(subcommand)]
    Schedule(ScheduleCommand),

    /// 메모 명령
    #[command(subcommand)]
    Memo(MemoCommand),

    /// 메모 폴더 명령
    #[command(subcommand)]
    MemoFolder(MemoFolderCommand),

    /// 프로젝트 명령 (워크스페이스 묶음 + 디렉터리)
    #[command(subcommand)]
    Project(ProjectCommand),

    /// 버전 출력
    Version,
}

fn main() {
    let cli = Cli::parse();
    let result = run(&cli);
    match result {
        Ok(()) => {}
        Err(AppError::User(msg)) => {
            eprintln!("error: {msg}");
            std::process::exit(1);
        }
        Err(AppError::System(msg)) => {
            eprintln!("error: {msg}");
            std::process::exit(2);
        }
    }
}

fn run(cli: &Cli) -> Result<(), AppError> {
    match &cli.command {
        Command::Version => {
            let v = serde_json::json!({
                "cli": env!("CARGO_PKG_VERSION"),
                "core": workspace_hub_core::version(),
            });
            if cli.human {
                println!(
                    "workspace-hub-cli {}\nworkspace-hub-core {}",
                    env!("CARGO_PKG_VERSION"),
                    workspace_hub_core::version()
                );
            } else {
                output::print_json(&v)?;
            }
            Ok(())
        }
        Command::Todo(cmd) => commands::todo::run(cmd, cli.human),
        Command::Schedule(cmd) => commands::schedule::run(cmd, cli.human),
        Command::Memo(cmd) => commands::memo::run(cmd, cli.human),
        Command::MemoFolder(cmd) => commands::memo_folder::run(cmd, cli.human),
        Command::Project(cmd) => commands::project::run(cmd, cli.human),
    }
}

/// CLI 외부 종료코드 매핑용 에러.
pub enum AppError {
    User(String),
    System(String),
}

impl AppError {
    pub fn from_core(e: CoreError) -> Self {
        match e {
            CoreError::InvalidInput(m) => AppError::User(m),
            CoreError::NotFound(m) => AppError::User(format!("not found: {m}")),
            CoreError::Parse(m) => AppError::User(format!("parse error: {m}")),
            CoreError::HomeNotFound => {
                AppError::System("HOME env var is missing; cannot resolve ~/.workspace-hub".into())
            }
            other => AppError::System(other.to_string()),
        }
    }
}

impl From<CoreError> for AppError {
    fn from(e: CoreError) -> Self {
        AppError::from_core(e)
    }
}
