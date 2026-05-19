pub mod db;
pub mod error;
pub mod models;
pub mod paths;
pub mod repo;

pub use error::CoreError;

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
