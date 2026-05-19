use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub color: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NewProject {
    pub title: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i64>,
}

/// PATCH 패턴 — schedule 의 `UpdateSchedule` 과 동일한 형태.
/// `None` = 미지정(기존 값 유지). `Some(Some(""))` 같은 빈 문자열은 NULL 비우기 신호.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateProject {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub color: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDirectory {
    pub id: i64,
    pub project_id: i64,
    pub path: String,
    pub label: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NewProjectDirectory {
    pub project_id: i64,
    pub path: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateProjectDirectory {
    pub path: Option<String>,
    pub label: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectApplication {
    pub id: i64,
    pub project_id: i64,
    pub path: String,
    pub label: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NewProjectApplication {
    pub project_id: i64,
    pub path: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateProjectApplication {
    pub path: Option<String>,
    pub label: Option<Option<String>>,
}
