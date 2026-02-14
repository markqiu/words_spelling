use serde::{Deserialize, Serialize};

/// 文章
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

/// 创建文章请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateArticleRequest {
    pub title: String,
    pub content: String,
}

/// 更新文章请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateArticleRequest {
    pub title: Option<String>,
    pub content: Option<String>,
}

/// 分词片段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Segment {
    pub id: i64,
    pub article_id: i64,
    pub segment_type: String, // "word" | "phrase" | "sentence"
    pub content: String,
    pub order_index: i32,
}

/// 保存分词请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveSegmentsRequest {
    pub article_id: i64,
    pub segment_type: String,
    pub segments: Vec<String>,
}

/// 练习进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeProgress {
    pub user_name: String,
    pub article_id: i64,
    pub segment_type: String,
    pub current_index: i32,
    pub words_list: String, // JSON array
    pub correct_count: i32,
    pub incorrect_count: i32,
}

/// 保存进度请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveProgressRequest {
    pub user_name: String,
    pub article_id: i64,
    pub segment_type: String,
    pub current_index: i32,
    pub words_list: Vec<String>,
    pub correct_count: i32,
    pub incorrect_count: i32,
}

/// 错误记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mistake {
    pub id: i64,
    pub user_name: String,
    pub segment_id: i64,
    pub segment_content: String,
    pub segment_type: String,
    pub error_count: i32,
    pub last_error_at: String,
}

/// 排行榜记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardRecord {
    pub id: i64,
    pub user_name: String,
    pub article_id: i64,
    pub article_title: String,
    pub segment_type: String,
    pub score: f64,
    pub accuracy: f64,
    pub wpm: f64,
    pub completed_at: String,
}

/// 保存记录请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveRecordRequest {
    pub user_name: String,
    pub article_id: i64,
    pub segment_type: String,
    pub score: f64,
    pub accuracy: f64,
    pub wpm: f64,
}

/// 分词请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentRequest {
    pub text: String,
    pub mode: String, // "word" | "phrase" | "sentence"
    pub server_url: Option<String>,
}

/// 分词响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentResponse {
    pub segments: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
}
