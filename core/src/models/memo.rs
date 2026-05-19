use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoFolder {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NewMemoFolder {
    pub parent_id: Option<i64>,
    pub name: String,
}

/// PATCH — 지정한 필드만 갱신.
/// `parent_id` 는 이중 Option: `Some(Some(n))` 로 다른 폴더 아래로 이동,
/// `Some(None)` 로 루트로 이동, `None` 으로 변경 없음.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateMemoFolder {
    pub name: Option<String>,
    pub parent_id: Option<Option<i64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memo {
    pub id: i64,
    pub folder_id: Option<i64>,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NewMemo {
    pub folder_id: Option<i64>,
    pub title: String,
    pub body: String,
}

/// PATCH — 지정한 필드만 갱신.
/// `folder_id`: `Some(Some(n))` = 폴더로 이동, `Some(None)` = 루트로 이동, `None` = 변경 없음.
/// `title` / `body` 는 빈 문자열도 유효 값(title 은 default '').
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateMemo {
    pub folder_id: Option<Option<i64>>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub pinned: Option<bool>,
}
