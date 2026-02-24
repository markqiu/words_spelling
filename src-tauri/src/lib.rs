mod commands;
mod database;
mod models;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 初始化数据库
            let app_handle = app.handle();
            let db_path = app_handle.path().app_data_dir()
                .expect("Failed to get app data dir")
                .join("spelling.db");
            
            // 确保目录存在
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            
            let db = database::DatabaseManager::new(&db_path)
                .expect("Failed to initialize database");
            
            // 初始化 WIDA 题库
            db.seed_wida_questions().expect("Failed to seed WIDA questions");
            
            // 将数据库实例存储到 state
            app.manage(std::sync::Mutex::new(db));
            
            log::info!("Database initialized at {:?}", db_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 文章管理
            commands::article::get_articles,
            commands::article::get_article,
            commands::article::create_article,
            commands::article::update_article,
            commands::article::delete_article,
            commands::article::save_segments,
            commands::article::get_segments,
            // 练习相关
            commands::practice::save_progress,
            commands::practice::get_progress,
            commands::practice::clear_progress,
            commands::practice::add_mistake,
            commands::practice::remove_mistake,
            commands::practice::get_mistakes,
            commands::practice::save_record,
            commands::practice::get_leaderboard,
            // 智能复习（SM-2）
            commands::practice::get_scheduled_words,
            commands::practice::update_word_mastery,
            commands::practice::get_word_masteries,
            // 练习历史
            commands::practice::save_practice_history,
            commands::practice::get_practice_history,
            commands::practice::get_user_statistics,
            // TTS
            commands::tts::speak,
            commands::tts::stop_speaking,
            // 分词服务
            commands::segment::segment_text,
            // WIDA 测试
            commands::wida::get_wida_listening_questions,
            commands::wida::get_wida_reading_questions,
            commands::wida::get_wida_speaking_questions,
            commands::wida::get_wida_writing_questions,
            commands::wida::start_wida_test,
            commands::wida::get_wida_test_session,
            commands::wida::get_wida_test_questions,
            commands::wida::submit_wida_answer,
            commands::wida::complete_wida_test,
            commands::wida::get_wida_history,
            commands::wida::get_wida_comprehensive_report,
            commands::wida::get_active_wida_sessions,
            commands::wida::delete_wida_session,
            // WIDA 题目生成
            commands::wida::generate_listening_questions,
            commands::wida::generate_reading_questions,
            commands::wida::generate_speaking_questions,
            commands::wida::generate_writing_questions,
            commands::wida::save_api_settings,
            commands::wida::load_api_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
