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
            // TTS
            commands::tts::speak,
            commands::tts::stop_speaking,
            // 分词服务
            commands::segment::segment_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
