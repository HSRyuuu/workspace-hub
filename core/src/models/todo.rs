use serde::{Deserialize, Serialize};

/// 우선순위 enum. `High > Mid > Low` 순서는 `Ord` derive 가 보장한다
/// (선언 순서 Low=0, Mid=1, High=2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "clap-enums", derive(clap::ValueEnum))]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    #[default]
    Mid,
    High,
}

impl Priority {
    pub fn as_str(&self) -> &'static str {
        match self {
            Priority::Low => "low",
            Priority::Mid => "mid",
            Priority::High => "high",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "low" => Some(Priority::Low),
            "mid" => Some(Priority::Mid),
            "high" => Some(Priority::High),
            _ => None,
        }
    }
}

impl rusqlite::types::FromSql for Priority {
    fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
        let s = value.as_str()?;
        Priority::parse(s).ok_or_else(|| {
            rusqlite::types::FromSqlError::Other(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("unknown priority: {s}"),
            )))
        })
    }
}

impl rusqlite::types::ToSql for Priority {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        Ok(rusqlite::types::ToSqlOutput::from(self.as_str()))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "clap-enums", derive(clap::ValueEnum))]
#[serde(rename_all = "lowercase")]
pub enum TodoStatus {
    Open,
    Done,
}

impl TodoStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TodoStatus::Open => "open",
            TodoStatus::Done => "done",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "open" => Some(TodoStatus::Open),
            "done" => Some(TodoStatus::Done),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i64,
    pub workspace_id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub start_date: String,
    pub due_date: Option<String>,
    pub due_time: i64,
    pub priority: Priority,
    pub status: TodoStatus,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NewTodo {
    pub workspace_id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<i64>,
    pub priority: Priority,
}
