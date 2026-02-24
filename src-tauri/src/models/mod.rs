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

/// 单词熟练度（SM-2 算法）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordMastery {
    pub user_name: String,
    pub segment_id: i64,
    pub segment_content: String,
    pub segment_type: String,
    pub mastery_level: i32,      // 0-5, 0=新词, 5=完全掌握
    pub ease_factor: f64,        // 难度因子, 默认 2.5
    pub interval_days: i32,      // 复习间隔(天)
    pub next_review_at: String,  // 下次复习时间
    pub last_review_at: String,  // 上次复习时间
    pub review_count: i32,       // 复习次数
}

/// 获取智能调度单词请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetScheduledWordsRequest {
    pub user_name: String,
    pub article_id: i64,
    pub segment_type: String,
    pub limit: i32,              // 本次练习的单词数量
}

/// 更新单词熟练度请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMasteryRequest {
    pub user_name: String,
    pub segment_id: i64,
    pub segment_content: String,
    pub segment_type: String,
    pub correct: bool,           // 是否回答正确
}

/// 智能调度单词响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledWordsResponse {
    pub words: Vec<ScheduledWord>,
    pub new_words_count: i32,   // 新单词数量
    pub review_words_count: i32, // 复习单词数量
}

/// 调度单词
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledWord {
    pub segment_id: i64,
    pub content: String,
    pub segment_type: String,
    pub mastery_level: i32,
    pub is_new: bool,           // 是否是新单词
    pub next_review_at: String, // 下次复习时间（用于排序）
}

/// 练习历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeHistory {
    pub id: i64,
    pub user_name: String,
    pub article_id: i64,
    pub article_title: String,
    pub segment_type: String,
    pub correct_count: i32,
    pub incorrect_count: i32,
    pub total_count: i32,
    pub accuracy: f64,
    pub wpm: f64,               // 每分钟单词数
    pub duration_seconds: i32,   // 练习时长(秒)
    pub completed_at: String,
}

/// 保存练习历史请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveHistoryRequest {
    pub user_name: String,
    pub article_id: i64,
    pub segment_type: String,
    pub correct_count: i32,
    pub incorrect_count: i32,
    pub duration_seconds: i32,
}

/// 用户统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStatistics {
    pub user_name: String,
    pub total_practices: i32,       // 总练习次数
    pub total_correct: i32,         // 总正确数
    pub total_incorrect: i32,       // 总错误数
    pub total_words: i32,           // 总单词数
    pub avg_accuracy: f64,          // 平均正确率
    pub avg_wpm: f64,               // 平均WPM
    pub best_accuracy: f64,         // 最高正确率
    pub best_wpm: f64,              // 最高WPM
    pub total_duration_minutes: f64, // 总练习时长(分钟)
    pub recent_histories: Vec<PracticeHistory>, // 最近几次练习记录
}
