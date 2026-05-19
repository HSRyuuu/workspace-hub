use clap::{Args, Subcommand};

use workspace_hub_core::{
    db,
    models::memo::{NewMemo, UpdateMemo},
    repo::{
        memo::{self as repo, ListScope},
        memo_project as link_repo,
    },
};

use crate::{output, AppError};

#[derive(Subcommand)]
pub enum MemoCommand {
    /// 새 메모 추가
    Add(AddArgs),
    /// 메모 목록 (필터: `--folder <id>` / `--root` / `--trash`. 기본은 휴지통 제외 전체)
    List(ListArgs),
    /// 메모 단건 조회
    Get(IdArg),
    /// 메모 수정 (지정한 필드만)
    Update(UpdateArgs),
    /// 메모를 휴지통으로 (soft-delete)
    Delete(IdArg),
    /// 휴지통에서 복원
    Restore(IdArg),
    /// 영구 삭제 (휴지통의 메모만 허용)
    Purge(IdArg),
    /// 휴지통 비우기 (삭제된 모든 메모 영구 삭제)
    EmptyTrash,
    /// 메모–프로젝트 매핑 명령
    #[command(subcommand)]
    Project(MemoProjectCommand),
}

#[derive(Subcommand)]
pub enum MemoProjectCommand {
    /// 매핑된 프로젝트 목록
    List(MemoProjectListArgs),
    /// 매핑 추가 (멱등)
    Link(MemoProjectLinkArgs),
    /// 매핑 제거
    Unlink(MemoProjectLinkArgs),
}

#[derive(Args)]
pub struct MemoProjectListArgs {
    /// memo id
    pub id: i64,
}

#[derive(Args)]
pub struct MemoProjectLinkArgs {
    /// memo id
    pub memo: i64,
    /// project id
    pub project: i64,
}

#[derive(Args)]
pub struct AddArgs {
    /// 제목 (선택; 비우면 본문 첫 줄이 표시 제목)
    #[arg(long, default_value = "", allow_hyphen_values = true)]
    pub title: String,

    /// 본문 (markdown). 미지정 시 빈 메모
    #[arg(long, default_value = "", allow_hyphen_values = true)]
    pub body: String,

    /// 소속 폴더 id (미지정 시 루트)
    #[arg(long)]
    pub folder: Option<i64>,
}

#[derive(Args)]
pub struct ListArgs {
    /// 특정 폴더만 (id 지정)
    #[arg(long, conflicts_with_all = ["root", "trash"])]
    pub folder: Option<i64>,

    /// 루트(folder NULL) 만
    #[arg(long, conflicts_with_all = ["folder", "trash"])]
    pub root: bool,

    /// 휴지통만
    #[arg(long, conflicts_with_all = ["folder", "root"])]
    pub trash: bool,
}

#[derive(Args)]
pub struct IdArg {
    /// memo id
    pub id: i64,
}

#[derive(Args)]
pub struct UpdateArgs {
    /// memo id
    pub id: i64,

    #[arg(long, allow_hyphen_values = true)]
    pub title: Option<String>,

    #[arg(long, allow_hyphen_values = true)]
    pub body: Option<String>,

    /// 소속 폴더로 이동 (id 지정)
    #[arg(long, conflicts_with = "to_root")]
    pub folder: Option<i64>,

    /// 루트로 이동 (folder_id NULL)
    #[arg(long, conflicts_with = "folder")]
    pub to_root: bool,

    /// 핀 토글 (true/false)
    #[arg(long)]
    pub pinned: Option<bool>,
}

pub fn run(cmd: &MemoCommand, human: bool) -> Result<(), AppError> {
    let conn = db::open()?;
    match cmd {
        MemoCommand::Add(args) => {
            let new = NewMemo {
                folder_id: args.folder,
                title: args.title.clone(),
                body: args.body.clone(),
            };
            let m = repo::create(&conn, &new)?;
            output::emit(&m, human, output::print_memo_human)?;
        }
        MemoCommand::List(args) => {
            let scope = if args.trash {
                ListScope::Trash
            } else if args.root {
                ListScope::Folder(None)
            } else if let Some(fid) = args.folder {
                ListScope::Folder(Some(fid))
            } else {
                ListScope::AllActive
            };
            let items = repo::list(&conn, scope)?;
            output::emit(&items, human, |xs| output::print_memos_human(xs))
                ?;
        }
        MemoCommand::Get(id) => {
            let m = repo::get(&conn, id.id)?;
            output::emit(&m, human, output::print_memo_human)?;
        }
        MemoCommand::Update(args) => {
            let folder_id = if args.to_root {
                Some(None)
            } else {
                args.folder.map(Some)
            };
            let patch = UpdateMemo {
                folder_id,
                title: args.title.clone(),
                body: args.body.clone(),
                pinned: args.pinned,
            };
            let m = repo::update(&conn, args.id, &patch)?;
            output::emit(&m, human, output::print_memo_human)?;
        }
        MemoCommand::Delete(id) => {
            let m = repo::soft_delete(&conn, id.id)?;
            output::emit(&m, human, output::print_memo_human)?;
        }
        MemoCommand::Restore(id) => {
            let m = repo::restore(&conn, id.id)?;
            output::emit(&m, human, output::print_memo_human)?;
        }
        MemoCommand::Purge(id) => {
            repo::purge(&conn, id.id)?;
            let ack = serde_json::json!({ "purged": id.id });
            output::emit(&ack, human, |_| println!("purged #{}", id.id))
                ?;
        }
        MemoCommand::EmptyTrash => {
            let count = repo::empty_trash(&conn)?;
            let ack = serde_json::json!({ "purged_count": count });
            output::emit(&ack, human, |_| println!("emptied trash: {count} memo(s) purged"))
                ?;
        }
        MemoCommand::Project(MemoProjectCommand::List(args)) => {
            let items = link_repo::list_projects_for_memo(&conn, args.id)
                ?;
            output::emit(&items, human, |xs| output::print_projects_human(xs))
                ?;
        }
        MemoCommand::Project(MemoProjectCommand::Link(args)) => {
            link_repo::link(&conn, args.memo, args.project)?;
            let ack = serde_json::json!({
                "linked": { "memo_id": args.memo, "project_id": args.project }
            });
            output::emit(&ack, human, |_| {
                println!("linked memo #{} ↔ project #{}", args.memo, args.project)
            })
            ?;
        }
        MemoCommand::Project(MemoProjectCommand::Unlink(args)) => {
            link_repo::unlink(&conn, args.memo, args.project)?;
            let ack = serde_json::json!({
                "unlinked": { "memo_id": args.memo, "project_id": args.project }
            });
            output::emit(&ack, human, |_| {
                println!("unlinked memo #{} ↔ project #{}", args.memo, args.project)
            })
            ?;
        }
    }
    Ok(())
}
