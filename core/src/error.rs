use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("home directory not found (HOME env var missing)")]
    HomeNotFound,

    #[error("not found: {0}")]
    NotFound(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("parse: {0}")]
    Parse(String),
}
