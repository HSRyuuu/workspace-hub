use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NewSchedule {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    pub color: Option<String>,
}

/// PATCH 패턴 — 호출자가 명시한 필드만 갱신한다.
/// `None` = 미지정(기존 값 유지), `Some(None)` 으로는 nullable 컬럼을 비우고 싶으나
/// CLI 인터페이스가 단순화되도록 빈 문자열을 NULL 신호로 사용한다(CLI 레이어에서 변환).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateSchedule {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub location: Option<Option<String>>,
    pub start_at: Option<String>,
    pub end_at: Option<String>,
    pub all_day: Option<bool>,
    pub color: Option<Option<String>>,
}
