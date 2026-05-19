use clap::{Args, Subcommand};

use workspace_hub_core::{
    db,
    models::memo::{NewMemoFolder, UpdateMemoFolder},
    repo::memo_folder as repo,
};

use crate::{output, AppError};

#[derive(Subcommand)]
pub enum MemoFolderCommand {
    /// 새 폴더 추가 (`--parent <id>` 미지정 시 루트)
    Add(AddArgs),
    /// 전체 폴더 목록 (트리 조립은 호출자 책임)
    List,
    /// 폴더 이름 변경
    Rename(RenameArgs),
    /// 폴더 이동 (`--to-root` 면 루트, 아니면 `--parent <id>`)
    Move(MoveArgs),
    /// 같은 부모 아래 형제 폴더들의 순서를 `--order` 배열대로 0..N 으로 재할당
    Reorder(ReorderArgs),
    /// 폴더 삭제 — 자손 폴더는 함께 삭제, 속한 메모는 휴지통으로 이동
    Delete(IdArg),
}

#[derive(Args)]
pub struct AddArgs {
    /// 폴더 이름 (필수)
    #[arg(long, allow_hyphen_values = true)]
    pub name: String,

    /// 부모 폴더 id (미지정 시 루트)
    #[arg(long)]
    pub parent: Option<i64>,
}

#[derive(Args)]
pub struct IdArg {
    /// memo_folder id
    pub id: i64,
}

#[derive(Args)]
pub struct RenameArgs {
    /// memo_folder id
    pub id: i64,

    /// 새 이름
    #[arg(long, allow_hyphen_values = true)]
    pub name: String,
}

#[derive(Args)]
pub struct MoveArgs {
    /// memo_folder id
    pub id: i64,

    /// 새 부모 폴더 id
    #[arg(long, conflicts_with = "to_root")]
    pub parent: Option<i64>,

    /// 루트로 이동
    #[arg(long, conflicts_with = "parent")]
    pub to_root: bool,
}

#[derive(Args)]
pub struct ReorderArgs {
    /// 대상 부모 폴더 id (미지정 시 루트). `--at-root` 와는 동의어 — 둘 다 미지정이면 루트.
    #[arg(long)]
    pub parent: Option<i64>,

    /// 같은 부모 아래의 모든 형제 폴더 id 를 원하는 순서대로 콤마 구분으로 나열. 빠짐없이.
    /// 예: `--order 12,9,5`
    #[arg(long, value_delimiter = ',', required = true)]
    pub order: Vec<i64>,
}

pub fn run(cmd: &MemoFolderCommand, human: bool) -> Result<(), AppError> {
    match cmd {
        MemoFolderCommand::Add(args) => {
            let mut conn = db::open()?;
            let new = NewMemoFolder {
                parent_id: args.parent,
                name: args.name.clone(),
            };
            let f = repo::create(&mut conn, &new)?;
            output::emit(&f, human, output::print_memo_folder_human)
                ?;
        }
        MemoFolderCommand::List => {
            let conn = db::open()?;
            let items = repo::list_all(&conn)?;
            output::emit(&items, human, |xs| output::print_memo_folders_human(xs))
                ?;
        }
        MemoFolderCommand::Rename(args) => {
            let mut conn = db::open()?;
            let patch = UpdateMemoFolder {
                name: Some(args.name.clone()),
                ..Default::default()
            };
            let f = repo::update(&mut conn, args.id, &patch)?;
            output::emit(&f, human, output::print_memo_folder_human)
                ?;
        }
        MemoFolderCommand::Move(args) => {
            let mut conn = db::open()?;
            let parent_id = if args.to_root {
                Some(None)
            } else if let Some(p) = args.parent {
                Some(Some(p))
            } else {
                return Err(AppError::User(
                    "either --parent <id> or --to-root must be provided".into(),
                ));
            };
            let patch = UpdateMemoFolder {
                parent_id,
                ..Default::default()
            };
            let f = repo::update(&mut conn, args.id, &patch)?;
            output::emit(&f, human, output::print_memo_folder_human)
                ?;
        }
        MemoFolderCommand::Reorder(args) => {
            let mut conn = db::open()?;
            repo::reorder(&mut conn, args.parent, &args.order)?;
            let ack = serde_json::json!({
                "reordered": args.order.len(),
                "parent_id": args.parent,
            });
            output::emit(&ack, human, |_| {
                println!(
                    "reordered {} folder(s) under parent={}",
                    args.order.len(),
                    args.parent
                        .map(|p| p.to_string())
                        .unwrap_or_else(|| "root".into())
                )
            })
            ?;
        }
        MemoFolderCommand::Delete(id) => {
            let mut conn = db::open()?;
            repo::delete(&mut conn, id.id)?;
            let ack = serde_json::json!({ "deleted": id.id });
            output::emit(&ack, human, |_| println!("deleted folder #{}", id.id))
                ?;
        }
    }
    Ok(())
}
