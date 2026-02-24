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

// ========== WIDA 测试模块 ==========

/// WIDA 年级等级
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WidaGradeLevel {
    #[serde(rename = "grade_1_2")]
    Grade1_2,   // 1-2年级
    #[serde(rename = "grade_3_5")]
    Grade3_5,   // 3-5年级
    #[serde(rename = "grade_6_8")]
    Grade6_8,   // 6-8年级
    #[serde(rename = "grade_9_12")]
    Grade9_12,  // 9-12年级
}

/// WIDA 测试类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WidaTestType {
    #[serde(rename = "listening")]
    Listening,  // 听力
    #[serde(rename = "reading")]
    Reading,    // 阅读
    #[serde(rename = "speaking")]
    Speaking,   // 口语
    #[serde(rename = "writing")]
    Writing,    // 写作
}

/// WIDA 学科领域
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WidaDomain {
    #[serde(rename = "social_instructional")]
    SocialInstructional,    // 社交与教学英语
    #[serde(rename = "language_arts")]
    LanguageArts,           // 艺术语言类英语
    #[serde(rename = "mathematics")]
    Mathematics,            // 数学英语
    #[serde(rename = "science")]
    Science,                // 科学英语
    #[serde(rename = "social_studies")]
    SocialStudies,          // 社会研究英语
}

/// WIDA 题目 - 听力选择题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaListeningQuestion {
    pub id: i64,
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,            // 1-6 对应 WIDA 等级
    pub audio_text: String,         // 音频文本（用于TTS播放）
    pub image_url: Option<String>,  // 配图（可选）
    pub question_text: String,      // 问题文本
    pub options: Vec<String>,       // 选项 A, B, C, D
    pub correct_answer: i32,        // 正确答案索引 (0-3)
    pub explanation: Option<String>,// 答案解析
}

/// WIDA 题目 - 阅读选择题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaReadingQuestion {
    pub id: i64,
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,
    pub passage: String,            // 阅读文章
    pub question_text: String,
    pub question_type: String,      // "multiple_choice" | "true_false" | "matching"
    pub options: Vec<String>,
    pub correct_answer: i32,
    pub explanation: Option<String>,
}

/// WIDA 题目 - 口语题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaSpeakingQuestion {
    pub id: i64,
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,
    pub prompt_type: String,        // "picture" | "text" | "audio"
    pub prompt_text: String,        // 提示文本
    pub image_url: Option<String>,  // 图片提示
    pub audio_text: Option<String>, // 音频文本（用于TTS）
    pub sample_answer: String,      // 示范回答
    pub rubric: Vec<String>,        // 评分标准
}

/// WIDA 题目 - 写作题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaWritingQuestion {
    pub id: i64,
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,
    pub task_type: String,          // "argumentative" | "expository" | "personal_recount" | "email" | "letter" | "report"
    pub prompt: String,             // 写作提示
    pub image_url: Option<String>,  // 配图
    pub word_limit_min: i32,        // 最少字数
    pub word_limit_max: i32,        // 最多字数
    pub rubric: Vec<String>,        // 评分标准
    pub sample_answer: Option<String>,
}

/// WIDA 测试会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaTestSession {
    pub id: i64,
    pub user_name: String,
    pub test_type: String,
    pub grade_level: String,
    pub domain: Option<String>,
    pub status: String,             // "in_progress" | "completed" | "abandoned"
    pub current_question: i32,      // 当前题目索引
    pub total_questions: i32,
    pub answers: String,            // JSON array of answers
    pub score: Option<f64>,         // 得分 (100-600 Scale Score)
    pub proficiency_level: Option<i32>, // 能力等级 (1-6)
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_seconds: i32,
}

/// WIDA 测试答案
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaTestAnswer {
    pub question_id: i64,
    pub user_answer: String,        // 用户答案（选择题为选项索引，写作题为文本）
    pub is_correct: Option<bool>,   // 是否正确（写作题需要人工评分）
    pub time_spent_seconds: i32,    // 答题用时
}

/// 开始 WIDA 测试请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartWidaTestRequest {
    pub user_name: String,
    pub test_type: String,
    pub grade_level: String,
    pub domain: Option<String>,
    pub question_count: i32,        // 题目数量
}

/// 提交答案请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitWidaAnswerRequest {
    pub session_id: i64,
    pub question_id: i64,
    pub answer: String,
    pub time_spent_seconds: i32,
}

/// 完成 WIDA 测试请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteWidaTestRequest {
    pub session_id: i64,
}

/// WIDA 测试结果报告
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaTestReport {
    pub session: WidaTestSession,
    pub correct_count: i32,
    pub total_count: i32,
    pub accuracy: f64,
    pub listening_score: Option<f64>,
    pub reading_score: Option<f64>,
    pub speaking_score: Option<f64>,
    pub writing_score: Option<f64>,
    pub overall_score: f64,         // 综合得分
    pub proficiency_level: i32,     // 1-6
    pub proficiency_level_name: String,
    pub details: Vec<WidaAnswerDetail>,
}

/// 答案详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaAnswerDetail {
    pub question_id: i64,
    pub question_text: String,
    pub user_answer: String,
    pub correct_answer: String,
    pub is_correct: bool,
    pub time_spent_seconds: i32,
    pub explanation: Option<String>,
}

/// WIDA 历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaHistoryRecord {
    pub id: i64,
    pub user_name: String,
    pub test_type: String,
    pub grade_level: String,
    pub score: f64,
    pub proficiency_level: i32,
    pub accuracy: f64,
    pub total_questions: i32,
    pub correct_count: i32,
    pub duration_seconds: i32,
    pub completed_at: String,
}

/// WIDA 综合报告
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidaComprehensiveReport {
    pub user_name: String,
    pub listening_score: Option<f64>,
    pub listening_level: Option<i32>,
    pub reading_score: Option<f64>,
    pub reading_level: Option<i32>,
    pub speaking_score: Option<f64>,
    pub speaking_level: Option<i32>,
    pub writing_score: Option<f64>,
    pub writing_level: Option<i32>,
    pub oral_score: Option<f64>,        // 听口综合 (50%听力+50%口语)
    pub literacy_score: Option<f64>,    // 读写综合 (50%阅读+50%写作)
    pub overall_score: f64,             // 总分 (30%听口+70%读写)
    pub overall_level: i32,
    pub test_count: i32,
    pub last_test_date: String,
}
