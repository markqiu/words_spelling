use std::sync::Mutex;
use tauri::State;

use crate::database::DatabaseManager;
use crate::models::{
    LeaderboardRecord, Mistake, PracticeProgress, 
    SaveProgressRequest, SaveRecordRequest, ScheduledWordsResponse, WordMastery
};

/// 保存练习进度
#[tauri::command]
pub fn save_progress(request: SaveProgressRequest, db: State<'_, Mutex<DatabaseManager>>) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let words_list_json = serde_json::to_string(&request.words_list).unwrap_or_else(|_| "[]".to_string());
    db.save_progress(
        &request.user_name,
        request.article_id,
        &request.segment_type,
        request.current_index,
        &words_list_json,
        request.correct_count,
        request.incorrect_count,
    ).map_err(|e| e.to_string())
}

/// 获取练习进度
#[tauri::command]
pub fn get_progress(
    user_name: String,
    article_id: i64,
    segment_type: String,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<Option<PracticeProgress>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_progress(&user_name, article_id, &segment_type).map_err(|e| e.to_string())
}

/// 清除练习进度
#[tauri::command]
pub fn clear_progress(
    user_name: String,
    article_id: i64,
    segment_type: String,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.clear_progress(&user_name, article_id, &segment_type).map_err(|e| e.to_string())
}

/// 添加错词/错句
#[tauri::command]
pub fn add_mistake(
    user_name: String,
    segment_id: i64,
    segment_content: String,
    segment_type: String,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.add_mistake(&user_name, segment_id, &segment_content, &segment_type)
        .map_err(|e| e.to_string())
}

/// 移除错词/错句
#[tauri::command]
pub fn remove_mistake(user_name: String, segment_id: i64, db: State<'_, Mutex<DatabaseManager>>) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.remove_mistake(&user_name, segment_id).map_err(|e| e.to_string())
}

/// 获取错词本
#[tauri::command]
pub fn get_mistakes(
    user_name: String,
    segment_type: Option<String>,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<Vec<Mistake>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_mistakes(&user_name, segment_type.as_deref()).map_err(|e| e.to_string())
}

/// 保存练习记录（排行榜）
#[tauri::command]
pub fn save_record(request: SaveRecordRequest, db: State<'_, Mutex<DatabaseManager>>) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.save_record(
        &request.user_name,
        request.article_id,
        &request.segment_type,
        request.score,
        request.accuracy,
        request.wpm,
    ).map_err(|e| e.to_string())
}

/// 获取排行榜
#[tauri::command]
pub fn get_leaderboard(
    article_id: Option<i64>,
    segment_type: Option<String>,
    limit: Option<i32>,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<Vec<LeaderboardRecord>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_leaderboard(article_id, segment_type.as_deref(), limit.unwrap_or(10))
        .map_err(|e| e.to_string())
}

/// 获取智能调度的单词（基于记忆曲线）
#[tauri::command]
pub fn get_scheduled_words(
    user_name: String,
    article_id: i64,
    segment_type: String,
    limit: i32,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<ScheduledWordsResponse, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_scheduled_words(&user_name, article_id, &segment_type, limit)
        .map_err(|e| e.to_string())
}

/// 更新单词熟练度（SM-2 算法）
#[tauri::command]
pub fn update_word_mastery(
    user_name: String,
    segment_id: i64,
    segment_content: String,
    segment_type: String,
    correct: bool,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<WordMastery, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.update_word_mastery(&user_name, segment_id, &segment_content, &segment_type, correct)
        .map_err(|e| e.to_string())
}

/// 获取单词熟练度列表
#[tauri::command]
pub fn get_word_masteries(
    user_name: String,
    segment_type: Option<String>,
    db: State<'_, Mutex<DatabaseManager>>,
) -> Result<Vec<WordMastery>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_word_masteries(&user_name, segment_type.as_deref())
        .map_err(|e| e.to_string())
}
