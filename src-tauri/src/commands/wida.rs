use tauri::State;
use std::sync::Mutex;
use crate::database::DatabaseManager;
use crate::models::*;
use serde::{Deserialize, Serialize};
use serde_json;

// ========== 题库管理 ==========

/// 获取听力题库
#[tauri::command]
pub fn get_wida_listening_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    grade_level: String,
    domain: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<WidaListeningQuestion>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_listening_questions(&grade_level, domain.as_deref(), limit)
        .map_err(|e| e.to_string())
}

/// 获取阅读题库
#[tauri::command]
pub fn get_wida_reading_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    grade_level: String,
    domain: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<WidaReadingQuestion>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_reading_questions(&grade_level, domain.as_deref(), limit)
        .map_err(|e| e.to_string())
}

/// 获取口语题库
#[tauri::command]
pub fn get_wida_speaking_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    grade_level: String,
    domain: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<WidaSpeakingQuestion>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_speaking_questions(&grade_level, domain.as_deref(), limit)
        .map_err(|e| e.to_string())
}

/// 获取写作题库
#[tauri::command]
pub fn get_wida_writing_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    grade_level: String,
    domain: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<WidaWritingQuestion>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_writing_questions(&grade_level, domain.as_deref(), limit)
        .map_err(|e| e.to_string())
}

// ========== 测试会话管理 ==========

/// 开始新的 WIDA 测试
#[tauri::command]
pub fn start_wida_test(
    db: State<'_, Mutex<DatabaseManager>>,
    request: StartWidaTestRequest,
) -> Result<WidaTestSession, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.start_wida_test(&request)
        .map_err(|e| e.to_string())
}

/// 获取测试会话
#[tauri::command]
pub fn get_wida_test_session(
    db: State<'_, Mutex<DatabaseManager>>,
    session_id: i64,
) -> Result<Option<WidaTestSession>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_test_session(session_id)
        .map_err(|e| e.to_string())
}

/// 获取测试题目
#[tauri::command]
pub fn get_wida_test_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    session_id: i64,
) -> Result<serde_json::Value, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_test_questions(session_id)
        .map_err(|e| e.to_string())
}

/// 提交答案
#[tauri::command]
pub fn submit_wida_answer(
    db: State<'_, Mutex<DatabaseManager>>,
    request: SubmitWidaAnswerRequest,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.submit_wida_answer(&request)
        .map_err(|e| e.to_string())
}

/// 完成测试
#[tauri::command]
pub fn complete_wida_test(
    db: State<'_, Mutex<DatabaseManager>>,
    request: CompleteWidaTestRequest,
) -> Result<WidaTestReport, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.complete_wida_test(&request)
        .map_err(|e| e.to_string())
}

/// 获取用户的测试历史
#[tauri::command]
pub fn get_wida_history(
    db: State<'_, Mutex<DatabaseManager>>,
    user_name: String,
    test_type: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<WidaHistoryRecord>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_history(&user_name, test_type.as_deref(), limit)
        .map_err(|e| e.to_string())
}

/// 获取用户综合报告
#[tauri::command]
pub fn get_wida_comprehensive_report(
    db: State<'_, Mutex<DatabaseManager>>,
    user_name: String,
) -> Result<WidaComprehensiveReport, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_wida_comprehensive_report(&user_name)
        .map_err(|e| e.to_string())
}

/// 获取进行中的测试会话
#[tauri::command]
pub fn get_active_wida_sessions(
    db: State<'_, Mutex<DatabaseManager>>,
    user_name: String,
) -> Result<Vec<WidaTestSession>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_active_wida_sessions(&user_name)
        .map_err(|e| e.to_string())
}

/// 删除测试会话
#[tauri::command]
pub fn delete_wida_session(
    db: State<'_, Mutex<DatabaseManager>>,
    session_id: i64,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.delete_wida_session(session_id)
        .map_err(|e| e.to_string())
}

// ========== 题目生成模块 ==========

/// 生成题目请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateQuestionsRequest {
    pub test_type: String,          // listening | reading | speaking | writing
    pub grade_level: String,        // grade_1_2 | grade_3_5 | grade_6_8 | grade_9_12
    pub domain: String,             // 学科领域
    pub difficulty: i32,            // 1-6
    pub count: i32,                 // 生成数量
    pub api_url: String,            // API URL
    pub api_key: String,            // API Key
    pub model: String,              // 模型名称
}

/// 生成题目响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateQuestionsResponse {
    pub success: bool,
    pub message: String,
    pub generated_count: i32,
}

/// AI API 请求
#[derive(Debug, Serialize)]
struct AiApiRequest {
    model: String,
    messages: Vec<AiMessage>,
    temperature: f32,
}

#[derive(Debug, Serialize)]
struct AiMessage {
    role: String,
    content: String,
}

/// AI API 响应
#[derive(Debug, Deserialize)]
struct AiApiResponse {
    choices: Vec<AiChoice>,
}

#[derive(Debug, Deserialize)]
struct AiChoice {
    message: AiMessageContent,
}

#[derive(Debug, Deserialize)]
struct AiMessageContent {
    content: String,
}

/// 生成听力题目
#[tauri::command]
pub async fn generate_listening_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    request: GenerateQuestionsRequest,
) -> Result<GenerateQuestionsResponse, String> {
    let prompt = build_listening_prompt(&request);
    let content = call_ai_api(&request.api_url, &request.api_key, &request.model, &prompt).await?;
    let questions = parse_listening_questions(&content, &request)?;
    
    let db = db.lock().map_err(|e| e.to_string())?;
    let count = db.save_listening_questions(&questions).map_err(|e| e.to_string())?;
    
    Ok(GenerateQuestionsResponse {
        success: true,
        message: format!("成功生成 {} 道听力题", count),
        generated_count: count,
    })
}

/// 生成阅读题目
#[tauri::command]
pub async fn generate_reading_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    request: GenerateQuestionsRequest,
) -> Result<GenerateQuestionsResponse, String> {
    let prompt = build_reading_prompt(&request);
    let content = call_ai_api(&request.api_url, &request.api_key, &request.model, &prompt).await?;
    let questions = parse_reading_questions(&content, &request)?;
    
    let db = db.lock().map_err(|e| e.to_string())?;
    let count = db.save_reading_questions(&questions).map_err(|e| e.to_string())?;
    
    Ok(GenerateQuestionsResponse {
        success: true,
        message: format!("成功生成 {} 道阅读题", count),
        generated_count: count,
    })
}

/// 生成口语题目
#[tauri::command]
pub async fn generate_speaking_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    request: GenerateQuestionsRequest,
) -> Result<GenerateQuestionsResponse, String> {
    let prompt = build_speaking_prompt(&request);
    let content = call_ai_api(&request.api_url, &request.api_key, &request.model, &prompt).await?;
    let questions = parse_speaking_questions(&content, &request)?;
    
    let db = db.lock().map_err(|e| e.to_string())?;
    let count = db.save_speaking_questions(&questions).map_err(|e| e.to_string())?;
    
    Ok(GenerateQuestionsResponse {
        success: true,
        message: format!("成功生成 {} 道口语题", count),
        generated_count: count,
    })
}

/// 生成写作题目
#[tauri::command]
pub async fn generate_writing_questions(
    db: State<'_, Mutex<DatabaseManager>>,
    request: GenerateQuestionsRequest,
) -> Result<GenerateQuestionsResponse, String> {
    let prompt = build_writing_prompt(&request);
    let content = call_ai_api(&request.api_url, &request.api_key, &request.model, &prompt).await?;
    let questions = parse_writing_questions(&content, &request)?;
    
    let db = db.lock().map_err(|e| e.to_string())?;
    let count = db.save_writing_questions(&questions).map_err(|e| e.to_string())?;
    
    Ok(GenerateQuestionsResponse {
        success: true,
        message: format!("成功生成 {} 道写作题", count),
        generated_count: count,
    })
}

/// 调用 AI API
async fn call_ai_api(api_url: &str, api_key: &str, model: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let request_body = AiApiRequest {
        model: model.to_string(),
        messages: vec![AiMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }],
        temperature: 0.7,
    };
    
    let response = client
        .post(api_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("API请求失败: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API返回错误: {} - {}", status, text));
    }
    
    let api_response: AiApiResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    
    Ok(api_response.choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default())
}

/// 构建听力题生成提示词
fn build_listening_prompt(request: &GenerateQuestionsRequest) -> String {
    format!(
        r#"请生成 {} 道WIDA英语听力测试题目。

要求：
- 年级水平: {} (对应难度等级: {})
- 学科领域: {}
- 难度等级: {}/6

每道题目需要包含：
1. audio_text: 听力文本（学生会听到的内容，适合用TTS朗读）
2. question_text: 问题文本
3. options: 4个选项 (A, B, C, D)
4. correct_answer: 正确答案索引 (0-3)
5. explanation: 答案解析

请严格按照以下JSON格式返回，不要包含任何其他文字：
[
  {{
    "audio_text": "听力文本内容...",
    "question_text": "问题...",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "correct_answer": 0,
    "explanation": "解析..."
  }}
]"#,
        request.count,
        request.grade_level,
        request.difficulty,
        request.domain,
        request.difficulty
    )
}

/// 构建阅读题生成提示词
fn build_reading_prompt(request: &GenerateQuestionsRequest) -> String {
    format!(
        r#"请生成 {} 道WIDA英语阅读测试题目。

要求：
- 年级水平: {} (对应难度等级: {})
- 学科领域: {}
- 难度等级: {}/6

每道题目需要包含：
1. passage: 阅读文章（根据年级调整长度和难度）
2. question_text: 问题文本
3. options: 4个选项 (A, B, C, D)
4. correct_answer: 正确答案索引 (0-3)
5. explanation: 答案解析

请严格按照以下JSON格式返回，不要包含任何其他文字：
[
  {{
    "passage": "阅读文章内容...",
    "question_text": "问题...",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "correct_answer": 0,
    "explanation": "解析..."
  }}
]"#,
        request.count,
        request.grade_level,
        request.difficulty,
        request.domain,
        request.difficulty
    )
}

/// 构建口语题生成提示词
fn build_speaking_prompt(request: &GenerateQuestionsRequest) -> String {
    format!(
        r#"请生成 {} 道WIDA英语口语测试题目。

要求：
- 年级水平: {} (对应难度等级: {})
- 学科领域: {}
- 难度等级: {}/6
- 所有题目必须包含图片描述

每道题目需要包含：
1. prompt_type: 必须是 "picture"
2. prompt_text: 提示文本（让学生根据图片回答的问题或任务）
3. image_description: 图片的详细描述（用于生成或选择合适的图片）
4. sample_answer: 示范回答
5. rubric: 评分标准（4个评价点）

图片描述应该：
- 清晰、具体，适合该年级水平
- 包含学生需要描述或讨论的主要元素
- 与学科领域相关
- 激发学生的口语表达能力

请严格按照以下JSON格式返回，不要包含任何其他文字：
[
  {{
    "prompt_type": "picture",
    "prompt_text": "Look at the picture and describe what you see. / What is happening in this picture? / Tell a story about this picture.",
    "image_description": "A detailed description of the image content (e.g., 'A family having a picnic in a park on a sunny day. There are trees, a blanket on the grass, a basket with food, and children playing with a ball.')",
    "sample_answer": "示范回答...",
    "rubric": ["评分标准1", "评分标准2", "评分标准3", "评分标准4"]
  }}
]"#,
        request.count,
        request.grade_level,
        request.difficulty,
        request.domain,
        request.difficulty
    )
}

/// 构建写作题生成提示词
fn build_writing_prompt(request: &GenerateQuestionsRequest) -> String {
    format!(
        r#"请生成 {} 道WIDA英语写作测试题目。

要求：
- 年级水平: {} (对应难度等级: {})
- 学科领域: {}
- 难度等级: {}/6

每道题目需要包含：
1. task_type: 任务类型 (argumentative | expository | personal_recount | email | letter | report)
2. prompt: 写作提示
3. word_limit_min: 最少字数
4. word_limit_max: 最多字数
5. rubric: 评分标准（4个评价点）
6. sample_answer: 示范回答

请严格按照以下JSON格式返回，不要包含任何其他文字：
[
  {{
    "task_type": "expository",
    "prompt": "写作提示...",
    "word_limit_min": 50,
    "word_limit_max": 100,
    "rubric": ["评分标准1", "评分标准2", "评分标准3", "评分标准4"],
    "sample_answer": "示范回答..."
  }}
]"#,
        request.count,
        request.grade_level,
        request.difficulty,
        request.domain,
        request.difficulty
    )
}

/// 解析听力题目
fn parse_listening_questions(content: &str, request: &GenerateQuestionsRequest) -> Result<Vec<GeneratedListeningQuestion>, String> {
    // 尝试提取JSON部分
    let json_str = extract_json_array(content);
    
    #[derive(Deserialize)]
    struct RawQuestion {
        audio_text: String,
        question_text: String,
        options: Vec<String>,
        correct_answer: i32,
        explanation: Option<String>,
    }
    
    let raw_questions: Vec<RawQuestion> = serde_json::from_str(json_str)
        .map_err(|e| format!("解析JSON失败: {} - 内容: {}", e, json_str))?;
    
    Ok(raw_questions.into_iter().map(|q| GeneratedListeningQuestion {
        grade_level: request.grade_level.clone(),
        domain: request.domain.clone(),
        difficulty: request.difficulty,
        audio_text: q.audio_text,
        image_url: None,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
    }).collect())
}

/// 解析阅读题目
fn parse_reading_questions(content: &str, request: &GenerateQuestionsRequest) -> Result<Vec<GeneratedReadingQuestion>, String> {
    let json_str = extract_json_array(content);
    
    #[derive(Deserialize)]
    struct RawQuestion {
        passage: String,
        question_text: String,
        options: Vec<String>,
        correct_answer: i32,
        explanation: Option<String>,
    }
    
    let raw_questions: Vec<RawQuestion> = serde_json::from_str(json_str)
        .map_err(|e| format!("解析JSON失败: {}", e))?;
    
    Ok(raw_questions.into_iter().map(|q| GeneratedReadingQuestion {
        grade_level: request.grade_level.clone(),
        domain: request.domain.clone(),
        difficulty: request.difficulty,
        passage: q.passage,
        question_text: q.question_text,
        question_type: "multiple_choice".to_string(),
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
    }).collect())
}

/// 解析口语题目
fn parse_speaking_questions(content: &str, request: &GenerateQuestionsRequest) -> Result<Vec<GeneratedSpeakingQuestion>, String> {
    let json_str = extract_json_array(content);
    
    #[derive(Deserialize)]
    struct RawQuestion {
        prompt_type: String,
        prompt_text: String,
        image_description: Option<String>,
        sample_answer: String,
        rubric: Vec<String>,
    }
    
    let raw_questions: Vec<RawQuestion> = serde_json::from_str(json_str)
        .map_err(|e| format!("解析JSON失败: {}", e))?;
    
    Ok(raw_questions.into_iter().map(|q| {
        // 如果有图片描述，使用 Unsplash Source API 或占位符图片
        let image_url = q.image_description.map(|desc| {
            // 使用图片描述生成一个占位符 URL
            // 在实际应用中，这里可以调用图片生成 API 或从图片库中选择
            format!("https://source.unsplash.com/800x600/?{}", 
                desc.replace(' ', ",")
                    .replace('.', "")
                    .replace('?', "")
                    .to_lowercase()
            )
        });
        
        GeneratedSpeakingQuestion {
            grade_level: request.grade_level.clone(),
            domain: request.domain.clone(),
            difficulty: request.difficulty,
            prompt_type: q.prompt_type,
            prompt_text: q.prompt_text,
            image_url,
            audio_text: None,
            sample_answer: q.sample_answer,
            rubric: q.rubric,
        }
    }).collect())
}

/// 解析写作题目
fn parse_writing_questions(content: &str, request: &GenerateQuestionsRequest) -> Result<Vec<GeneratedWritingQuestion>, String> {
    let json_str = extract_json_array(content);
    
    #[derive(Deserialize)]
    struct RawQuestion {
        task_type: String,
        prompt: String,
        word_limit_min: i32,
        word_limit_max: i32,
        rubric: Vec<String>,
        sample_answer: Option<String>,
    }
    
    let raw_questions: Vec<RawQuestion> = serde_json::from_str(json_str)
        .map_err(|e| format!("解析JSON失败: {}", e))?;
    
    Ok(raw_questions.into_iter().map(|q| GeneratedWritingQuestion {
        grade_level: request.grade_level.clone(),
        domain: request.domain.clone(),
        difficulty: request.difficulty,
        task_type: q.task_type,
        prompt: q.prompt,
        image_url: None,
        word_limit_min: q.word_limit_min,
        word_limit_max: q.word_limit_max,
        rubric: q.rubric,
        sample_answer: q.sample_answer,
    }).collect())
}

/// 从文本中提取JSON数组
fn extract_json_array(content: &str) -> &str {
    let start = content.find('[').unwrap_or(0);
    let end = content.rfind(']').map(|i| i + 1).unwrap_or(content.len());
    &content[start..end]
}

/// 生成的听力题目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedListeningQuestion {
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,
    pub audio_text: String,
    pub image_url: Option<String>,
    pub question_text: String,
    pub options: Vec<String>,
    pub correct_answer: i32,
    pub explanation: Option<String>,
}

/// 生成的阅读题目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedReadingQuestion {
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,
    pub passage: String,
    pub question_text: String,
    pub question_type: String,
    pub options: Vec<String>,
    pub correct_answer: i32,
    pub explanation: Option<String>,
}

/// 生成的口语题目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedSpeakingQuestion {
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,
    pub prompt_type: String,
    pub prompt_text: String,
    pub image_url: Option<String>,
    pub audio_text: Option<String>,
    pub sample_answer: String,
    pub rubric: Vec<String>,
}

/// 生成的写作题目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedWritingQuestion {
    pub grade_level: String,
    pub domain: String,
    pub difficulty: i32,
    pub task_type: String,
    pub prompt: String,
    pub image_url: Option<String>,
    pub word_limit_min: i32,
    pub word_limit_max: i32,
    pub rubric: Vec<String>,
    pub sample_answer: Option<String>,
}

/// API设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiSettings {
    pub api_url: String,
    pub api_key: String,
    pub model: String,
}

/// 保存API设置
#[tauri::command]
pub async fn save_api_settings(
    settings: ApiSettings,
    app: tauri::AppHandle,
) -> Result<(), String> {
    use tauri::Manager;
    
    // 保存到配置文件
    let settings_json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    
    let config_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("wida_api_settings.json");
    
    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    std::fs::write(&config_path, settings_json).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 加载API设置
#[tauri::command]
pub async fn load_api_settings(
    app: tauri::AppHandle,
) -> Result<ApiSettings, String> {
    use tauri::Manager;
    
    let config_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("wida_api_settings.json");
    
    if !config_path.exists() {
        // 返回默认设置
        return Ok(ApiSettings {
            api_url: "https://api.openai.com/v1".to_string(),
            api_key: "".to_string(),
            model: "gpt-3.5-turbo".to_string(),
        });
    }
    
    let settings_json = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let settings: ApiSettings = serde_json::from_str(&settings_json).map_err(|e| e.to_string())?;
    
    Ok(settings)
}
