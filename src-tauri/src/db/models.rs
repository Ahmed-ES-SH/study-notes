use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MainSection {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MainSectionCascadeInfo {
    pub subsection_count: i64,
    pub note_count: i64,
    pub asset_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SubsectionCascadeInfo {
    pub note_count: i64,
    pub asset_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subsection {
    pub id: String,
    pub main_section_id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NoteCascadeInfo {
    pub asset_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub subsection_id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: String,
    pub note_id: String,
    pub file_path: String,
    pub alt_text: String,
    pub created_at: String,
}
