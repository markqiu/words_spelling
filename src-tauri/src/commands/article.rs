use std::sync::Mutex;
use tauri::State;

use crate::database::DatabaseManager;
use crate::models::{Article, CreateArticleRequest, SaveSegmentsRequest, Segment, UpdateArticleRequest};

/// 获取所有文章列表
#[tauri::command]
pub fn get_articles(db: State<'_, Mutex<DatabaseManager>>) -> Result<Vec<Article>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_articles().map_err(|e| e.to_string())
}

/// 获取单篇文章
#[tauri::command]
pub fn get_article(id: i64, db: State<'_, Mutex<DatabaseManager>>) -> Result<Option<Article>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_article(id).map_err(|e| e.to_string())
}

/// 创建文章
#[tauri::command]
pub fn create_article(request: CreateArticleRequest, db: State<'_, Mutex<DatabaseManager>>) -> Result<i64, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.create_article(&request.title, &request.content).map_err(|e| e.to_string())
}

/// 更新文章
#[tauri::command]
pub fn update_article(id: i64, request: UpdateArticleRequest, db: State<'_, Mutex<DatabaseManager>>) -> Result<bool, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.update_article(id, request.title.as_deref(), request.content.as_deref())
        .map_err(|e| e.to_string())
}

/// 删除文章
#[tauri::command]
pub fn delete_article(id: i64, db: State<'_, Mutex<DatabaseManager>>) -> Result<bool, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.delete_article(id).map_err(|e| e.to_string())
}

/// 保存分词结果
#[tauri::command]
pub fn save_segments(request: SaveSegmentsRequest, db: State<'_, Mutex<DatabaseManager>>) -> Result<(), String> {
    let mut db = db.lock().map_err(|e| e.to_string())?;
    db.save_segments(request.article_id, &request.segment_type, &request.segments)
        .map_err(|e| e.to_string())
}

/// 获取文章的分词结果
#[tauri::command]
pub fn get_segments(article_id: i64, segment_type: String, db: State<'_, Mutex<DatabaseManager>>) -> Result<Vec<Segment>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_segments(article_id, &segment_type).map_err(|e| e.to_string())
}
