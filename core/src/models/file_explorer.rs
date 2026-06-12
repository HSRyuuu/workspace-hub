use serde::{Deserialize, Serialize};

/// files 도메인이 연 적 있는 로컬 폴더 1건.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileExplorerFolder {
    pub id: i64,
    pub path: String,
    pub is_favorite: bool,
    pub last_opened_at: String,
}
