use rusqlite::{Connection, Result as SqliteResult};
use std::path::Path;

pub struct DatabaseManager {
    conn: Connection,
}

impl DatabaseManager {
    pub fn new<P: AsRef<Path>>(path: P) -> SqliteResult<Self> {
        let conn = Connection::open(path)?;
        let manager = Self { conn };
        manager.initialize_schema()?;
        Ok(manager)
    }

    fn initialize_schema(&self) -> SqliteResult<()> {
        self.conn.execute_batch(
            r#"
            -- 文章表
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- 分词片段表
            CREATE TABLE IF NOT EXISTS segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL,
                segment_type TEXT NOT NULL, -- 'word' | 'phrase' | 'sentence'
                content TEXT NOT NULL,
                order_index INTEGER NOT NULL,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                UNIQUE(article_id, segment_type, order_index)
            );

            -- 创建索引
            CREATE INDEX IF NOT EXISTS idx_segments_article ON segments(article_id);
            CREATE INDEX IF NOT EXISTS idx_segments_type ON segments(article_id, segment_type);

            -- 练习进度表
            CREATE TABLE IF NOT EXISTS practice_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL DEFAULT 'default',
                article_id INTEGER NOT NULL,
                segment_type TEXT NOT NULL,
                current_index INTEGER DEFAULT 0,
                words_list TEXT DEFAULT '[]',
                correct_count INTEGER DEFAULT 0,
                incorrect_count INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                UNIQUE(user_name, article_id, segment_type)
            );

            -- 错误记录表
            CREATE TABLE IF NOT EXISTS mistakes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL DEFAULT 'default',
                segment_id INTEGER NOT NULL,
                segment_content TEXT NOT NULL,
                segment_type TEXT NOT NULL,
                error_count INTEGER DEFAULT 1,
                last_error_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
                UNIQUE(user_name, segment_id)
            );

            CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_name);

            -- 排行榜表
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL DEFAULT 'default',
                article_id INTEGER NOT NULL,
                segment_type TEXT NOT NULL,
                score REAL NOT NULL,
                accuracy REAL NOT NULL,
                wpm REAL NOT NULL,
                completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(article_id, segment_type, score DESC);

            -- 单词熟练度表（SM-2 算法）
            CREATE TABLE IF NOT EXISTS word_mastery (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL DEFAULT 'default',
                segment_id INTEGER NOT NULL,
                segment_content TEXT NOT NULL,
                segment_type TEXT NOT NULL,
                mastery_level INTEGER DEFAULT 0,      -- 0-5, 0=新词, 5=完全掌握
                ease_factor REAL DEFAULT 2.5,         -- 难度因子
                interval_days INTEGER DEFAULT 0,     -- 复习间隔(天)
                next_review_at TEXT,                  -- 下次复习时间
                last_review_at TEXT,                 -- 上次复习时间
                review_count INTEGER DEFAULT 0,      -- 复习次数
                FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
                UNIQUE(user_name, segment_id)
            );

            CREATE INDEX IF NOT EXISTS idx_word_mastery_user ON word_mastery(user_name);
            CREATE INDEX IF NOT EXISTS idx_word_mastery_review ON word_mastery(next_review_at);

            -- 练习历史记录表
            CREATE TABLE IF NOT EXISTS practice_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL DEFAULT 'default',
                article_id INTEGER NOT NULL,
                segment_type TEXT NOT NULL,
                correct_count INTEGER DEFAULT 0,
                incorrect_count INTEGER DEFAULT 0,
                total_count INTEGER DEFAULT 0,
                accuracy REAL DEFAULT 0,
                wpm REAL DEFAULT 0,
                duration_seconds INTEGER DEFAULT 0,
                completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_practice_history_user ON practice_history(user_name);
            CREATE INDEX IF NOT EXISTS idx_practice_history_date ON practice_history(completed_at DESC);

            -- ========== WIDA 测试模块表 ==========

            -- WIDA 听力题库
            CREATE TABLE IF NOT EXISTS wida_listening_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                grade_level TEXT NOT NULL,         -- 'grade_1_2' | 'grade_3_5' | 'grade_6_8' | 'grade_9_12'
                domain TEXT NOT NULL,              -- 学科领域
                difficulty INTEGER NOT NULL,       -- 1-6 对应 WIDA 等级
                audio_text TEXT NOT NULL,          -- 音频文本（用于TTS）
                image_url TEXT,                    -- 配图URL
                question_text TEXT NOT NULL,       -- 问题文本
                options TEXT NOT NULL,             -- JSON array of options
                correct_answer INTEGER NOT NULL,   -- 正确答案索引 (0-3)
                explanation TEXT,                  -- 答案解析
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- WIDA 阅读题库
            CREATE TABLE IF NOT EXISTS wida_reading_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                grade_level TEXT NOT NULL,
                domain TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                passage TEXT NOT NULL,             -- 阅读文章
                question_text TEXT NOT NULL,
                question_type TEXT NOT NULL,       -- 'multiple_choice' | 'true_false' | 'matching'
                options TEXT NOT NULL,             -- JSON array
                correct_answer INTEGER NOT NULL,
                explanation TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- WIDA 口语题库
            CREATE TABLE IF NOT EXISTS wida_speaking_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                grade_level TEXT NOT NULL,
                domain TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                prompt_type TEXT NOT NULL,         -- 'picture' | 'text' | 'audio'
                prompt_text TEXT NOT NULL,         -- 提示文本
                image_url TEXT,
                audio_text TEXT,                   -- 用于TTS
                sample_answer TEXT NOT NULL,       -- 示范回答
                rubric TEXT NOT NULL,              -- JSON array of rubric criteria
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- WIDA 写作题库
            CREATE TABLE IF NOT EXISTS wida_writing_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                grade_level TEXT NOT NULL,
                domain TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                task_type TEXT NOT NULL,           -- 'argumentative' | 'expository' | 'personal_recount' | 'email' | 'letter' | 'report'
                prompt TEXT NOT NULL,
                image_url TEXT,
                word_limit_min INTEGER NOT NULL,
                word_limit_max INTEGER NOT NULL,
                rubric TEXT NOT NULL,              -- JSON array
                sample_answer TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- WIDA 测试会话
            CREATE TABLE IF NOT EXISTS wida_test_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL DEFAULT 'default',
                test_type TEXT NOT NULL,           -- 'listening' | 'reading' | 'speaking' | 'writing'
                grade_level TEXT NOT NULL,
                domain TEXT,                       -- 可选，指定学科领域
                status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
                current_question INTEGER DEFAULT 0,
                total_questions INTEGER NOT NULL,
                question_ids TEXT NOT NULL,        -- JSON array of question IDs
                answers TEXT DEFAULT '[]',         -- JSON array of answers
                score REAL,                        -- 100-600 Scale Score
                proficiency_level INTEGER,         -- 1-6
                started_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                duration_seconds INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_wida_sessions_user ON wida_test_sessions(user_name);
            CREATE INDEX IF NOT EXISTS idx_wida_sessions_status ON wida_test_sessions(status);

            -- WIDA 测试历史记录
            CREATE TABLE IF NOT EXISTS wida_test_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL DEFAULT 'default',
                test_type TEXT NOT NULL,
                grade_level TEXT NOT NULL,
                score REAL NOT NULL,
                proficiency_level INTEGER NOT NULL,
                accuracy REAL NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                duration_seconds INTEGER NOT NULL,
                completed_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_wida_history_user ON wida_test_history(user_name);
            CREATE INDEX IF NOT EXISTS idx_wida_history_date ON wida_test_history(completed_at DESC);
            "#,
        )?;
        Ok(())
    }

    // ========== 文章管理 ==========

    pub fn get_articles(&self) -> SqliteResult<Vec<crate::models::Article>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, content, created_at, updated_at FROM articles ORDER BY updated_at DESC"
        )?;
        let articles = stmt.query_map([], |row| {
            Ok(crate::models::Article {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        articles
    }

    pub fn get_article(&self, id: i64) -> SqliteResult<Option<crate::models::Article>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, content, created_at, updated_at FROM articles WHERE id = ?"
        )?;
        let mut articles = stmt.query_map([id], |row| {
            Ok(crate::models::Article {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        Ok(articles.next().transpose()?)
    }

    pub fn create_article(&self, title: &str, content: &str) -> SqliteResult<i64> {
        self.conn.execute(
            "INSERT INTO articles (title, content) VALUES (?, ?)",
            [title, content],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_article(&self, id: i64, title: Option<&str>, content: Option<&str>) -> SqliteResult<bool> {
        let rows_affected = if let (Some(t), Some(c)) = (title, content) {
            self.conn.execute(
                "UPDATE articles SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [t, c, &id.to_string()],
            )?
        } else if let Some(t) = title {
            self.conn.execute(
                "UPDATE articles SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [t, &id.to_string()],
            )?
        } else if let Some(c) = content {
            self.conn.execute(
                "UPDATE articles SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [c, &id.to_string()],
            )?
        } else {
            return Ok(false);
        };
        Ok(rows_affected > 0)
    }

    pub fn delete_article(&self, id: i64) -> SqliteResult<bool> {
        let rows = self.conn.execute("DELETE FROM articles WHERE id = ?", [id])?;
        Ok(rows > 0)
    }

    // ========== 分词管理 ==========

    pub fn save_segments(&mut self, article_id: i64, segment_type: &str, segments: &[String]) -> SqliteResult<()> {
        let tx = self.conn.transaction()?;
        
        // 1. 在删除旧分词前，保存现有的 word_mastery 记录（按 content 映射）
        let mut mastery_stmt = tx.prepare(
            "SELECT segment_content, mastery_level, ease_factor, interval_days, 
                    next_review_at, last_review_at, review_count 
             FROM word_mastery 
             WHERE segment_id IN (SELECT id FROM segments WHERE article_id = ? AND segment_type = ?)"
        )?;
        let old_mastery: Vec<(String, i32, f64, i32, String, String, i32)> = mastery_stmt
            .query_map(rusqlite::params![article_id, segment_type], |row| {
                Ok((
                    row.get(0)?,  // segment_content
                    row.get(1)?,  // mastery_level
                    row.get(2)?,  // ease_factor
                    row.get(3)?,  // interval_days
                    row.get(4)?,  // next_review_at
                    row.get(5)?,  // last_review_at
                    row.get(6)?,  // review_count
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();
        drop(mastery_stmt);
        
        // 2. 删除旧的分词（word_mastery 会级联删除）
        tx.execute(
            "DELETE FROM segments WHERE article_id = ? AND segment_type = ?",
            [article_id.to_string(), segment_type.to_string()],
        )?;

        // 3. 插入新的分词，并记录新生成的 ID
        let mut new_segment_ids: Vec<i64> = Vec::new();
        for (index, segment) in segments.iter().enumerate() {
            tx.execute(
                "INSERT INTO segments (article_id, segment_type, content, order_index) VALUES (?, ?, ?, ?)",
                [article_id.to_string(), segment_type.to_string(), segment.clone(), index.to_string()],
            )?;
            // 获取新插入的分词 ID
            let new_id = tx.last_insert_rowid();
            new_segment_ids.push(new_id);
        }
        
        // 4. 根据 content 匹配，恢复 word_mastery 记录
        for (i, segment) in segments.iter().enumerate() {
            let new_segment_id = new_segment_ids[i];
            
            // 查找该 content 是否有旧记录
            if let Some((_, mastery_level, ease_factor, interval_days, next_review_at, last_review_at, review_count)) 
                = old_mastery.iter().find(|(content, _, _, _, _, _, _)| content == segment) 
            {
                // 恢复 word_mastery 记录
                tx.execute(
                    "INSERT INTO word_mastery (user_name, segment_id, segment_content, segment_type, 
                     mastery_level, ease_factor, interval_days, next_review_at, last_review_at, review_count)
                     VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    rusqlite::params![
                        new_segment_id,
                        segment,
                        segment_type,
                        mastery_level,
                        ease_factor,
                        interval_days,
                        next_review_at,
                        last_review_at,
                        review_count
                    ],
                )?;
            }
        }
        
        tx.commit()?;
        Ok(())
    }

    pub fn get_segments(&self, article_id: i64, segment_type: &str) -> SqliteResult<Vec<crate::models::Segment>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, article_id, segment_type, content, order_index FROM segments 
             WHERE article_id = ? AND segment_type = ? ORDER BY order_index"
        )?;
        let segments = stmt.query_map([article_id.to_string(), segment_type.to_string()], |row| {
            Ok(crate::models::Segment {
                id: row.get(0)?,
                article_id: row.get(1)?,
                segment_type: row.get(2)?,
                content: row.get(3)?,
                order_index: row.get(4)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        segments
    }

    #[allow(dead_code)]
    pub fn has_segments(&self, article_id: i64, segment_type: &str) -> SqliteResult<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM segments WHERE article_id = ? AND segment_type = ?",
            [article_id.to_string(), segment_type.to_string()],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    // ========== 练习进度 ==========

    pub fn save_progress(
        &self,
        user_name: &str,
        article_id: i64,
        segment_type: &str,
        current_index: i32,
        words_list: &str,
        correct_count: i32,
        incorrect_count: i32,
    ) -> SqliteResult<()> {
        self.conn.execute(
            r#"INSERT OR REPLACE INTO practice_progress 
               (user_name, article_id, segment_type, current_index, words_list, correct_count, incorrect_count, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
            [
                user_name,
                &article_id.to_string(),
                segment_type,
                &current_index.to_string(),
                words_list,
                &correct_count.to_string(),
                &incorrect_count.to_string(),
            ],
        )?;
        Ok(())
    }

    pub fn get_progress(
        &self,
        user_name: &str,
        article_id: i64,
        segment_type: &str,
    ) -> SqliteResult<Option<crate::models::PracticeProgress>> {
        let mut stmt = self.conn.prepare(
            "SELECT user_name, article_id, segment_type, current_index, words_list, correct_count, incorrect_count 
             FROM practice_progress WHERE user_name = ? AND article_id = ? AND segment_type = ?"
        )?;
        let mut progress = stmt.query_map([user_name, &article_id.to_string(), segment_type], |row| {
            Ok(crate::models::PracticeProgress {
                user_name: row.get(0)?,
                article_id: row.get(1)?,
                segment_type: row.get(2)?,
                current_index: row.get(3)?,
                words_list: row.get(4)?,
                correct_count: row.get(5)?,
                incorrect_count: row.get(6)?,
            })
        })?;
        Ok(progress.next().transpose()?)
    }

    pub fn clear_progress(&self, user_name: &str, article_id: i64, segment_type: &str) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM practice_progress WHERE user_name = ? AND article_id = ? AND segment_type = ?",
            [user_name, &article_id.to_string(), segment_type],
        )?;
        Ok(())
    }

    // ========== 错词/错句管理 ==========

    pub fn add_mistake(
        &self,
        user_name: &str,
        segment_id: i64,
        segment_content: &str,
        segment_type: &str,
    ) -> SqliteResult<()> {
        self.conn.execute(
            r#"INSERT INTO mistakes (user_name, segment_id, segment_content, segment_type, error_count, last_error_at)
               VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
               ON CONFLICT(user_name, segment_id) 
               DO UPDATE SET error_count = error_count + 1, last_error_at = CURRENT_TIMESTAMP"#,
            [user_name, &segment_id.to_string(), segment_content, segment_type],
        )?;
        Ok(())
    }

    pub fn remove_mistake(&self, user_name: &str, segment_id: i64) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM mistakes WHERE user_name = ? AND segment_id = ?",
            [user_name, &segment_id.to_string()],
        )?;
        Ok(())
    }

    pub fn get_mistakes(&self, user_name: &str, segment_type: Option<&str>) -> SqliteResult<Vec<crate::models::Mistake>> {
        let mut stmt = if segment_type.is_some() {
            self.conn.prepare(
                "SELECT id, user_name, segment_id, segment_content, segment_type, error_count, last_error_at 
                 FROM mistakes WHERE user_name = ? AND segment_type = ? ORDER BY last_error_at DESC"
            )?
        } else {
            self.conn.prepare(
                "SELECT id, user_name, segment_id, segment_content, segment_type, error_count, last_error_at 
                 FROM mistakes WHERE user_name = ? ORDER BY last_error_at DESC"
            )?
        };

        let mistakes = if let Some(st) = segment_type {
            stmt.query_map([user_name, st], |row| {
                Ok(crate::models::Mistake {
                    id: row.get(0)?,
                    user_name: row.get(1)?,
                    segment_id: row.get(2)?,
                    segment_content: row.get(3)?,
                    segment_type: row.get(4)?,
                    error_count: row.get(5)?,
                    last_error_at: row.get(6)?,
                })
            })?.collect::<SqliteResult<Vec<_>>>()
        } else {
            stmt.query_map([user_name], |row| {
                Ok(crate::models::Mistake {
                    id: row.get(0)?,
                    user_name: row.get(1)?,
                    segment_id: row.get(2)?,
                    segment_content: row.get(3)?,
                    segment_type: row.get(4)?,
                    error_count: row.get(5)?,
                    last_error_at: row.get(6)?,
                })
            })?.collect::<SqliteResult<Vec<_>>>()
        };
        mistakes
    }

    // ========== 排行榜 ==========

    pub fn save_record(
        &self,
        user_name: &str,
        article_id: i64,
        segment_type: &str,
        score: f64,
        accuracy: f64,
        wpm: f64,
    ) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT INTO leaderboard (user_name, article_id, segment_type, score, accuracy, wpm) VALUES (?, ?, ?, ?, ?, ?)",
            [user_name, &article_id.to_string(), segment_type, &score.to_string(), &accuracy.to_string(), &wpm.to_string()],
        )?;
        Ok(())
    }

    pub fn get_leaderboard(
        &self,
        article_id: Option<i64>,
        segment_type: Option<&str>,
        limit: i32,
    ) -> SqliteResult<Vec<crate::models::LeaderboardRecord>> {
        let sql = match (article_id, segment_type) {
            (Some(aid), Some(st)) => format!(
                "SELECT l.id, l.user_name, l.article_id, a.title, l.segment_type, l.score, l.accuracy, l.wpm, l.completed_at 
                 FROM leaderboard l JOIN articles a ON l.article_id = a.id 
                 WHERE l.article_id = {} AND l.segment_type = '{}' 
                 ORDER BY l.score DESC LIMIT {}", 
                aid, st, limit
            ),
            (Some(aid), None) => format!(
                "SELECT l.id, l.user_name, l.article_id, a.title, l.segment_type, l.score, l.accuracy, l.wpm, l.completed_at 
                 FROM leaderboard l JOIN articles a ON l.article_id = a.id 
                 WHERE l.article_id = {} 
                 ORDER BY l.score DESC LIMIT {}", 
                aid, limit
            ),
            (None, Some(st)) => format!(
                "SELECT l.id, l.user_name, l.article_id, a.title, l.segment_type, l.score, l.accuracy, l.wpm, l.completed_at 
                 FROM leaderboard l JOIN articles a ON l.article_id = a.id 
                 WHERE l.segment_type = '{}' 
                 ORDER BY l.score DESC LIMIT {}", 
                st, limit
            ),
            (None, None) => format!(
                "SELECT l.id, l.user_name, l.article_id, a.title, l.segment_type, l.score, l.accuracy, l.wpm, l.completed_at 
                 FROM leaderboard l JOIN articles a ON l.article_id = a.id 
                 ORDER BY l.score DESC LIMIT {}", 
                limit
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let records = stmt.query_map([], |row| {
            Ok(crate::models::LeaderboardRecord {
                id: row.get(0)?,
                user_name: row.get(1)?,
                article_id: row.get(2)?,
                article_title: row.get(3)?,
                segment_type: row.get(4)?,
                score: row.get(5)?,
                accuracy: row.get(6)?,
                wpm: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        records
    }

    // ========== SM-2 间隔重复算法 ==========

    /// 获取需要复习的单词（到期 + 新词）
    pub fn get_scheduled_words(
        &self,
        user_name: &str,
        article_id: i64,
        segment_type: &str,
        limit: i32,
    ) -> SqliteResult<crate::models::ScheduledWordsResponse> {
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        // 1. 获取该文章的所有分词
        let mut stmt = self.conn.prepare(
            "SELECT id, content, segment_type FROM segments WHERE article_id = ?1 AND segment_type = ?2"
        )?;
        let all_segments: Vec<(i64, String, String)> = stmt.query_map(rusqlite::params![article_id, segment_type], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?.collect::<SqliteResult<Vec<_>>>()?;
        
        if all_segments.is_empty() {
            return Ok(crate::models::ScheduledWordsResponse {
                words: vec![],
                new_words_count: 0,
                review_words_count: 0,
            });
        }
        
        // 2. 获取已存在的熟练度记录
        let mut mastery_stmt = self.conn.prepare(
            "SELECT segment_id, mastery_level, next_review_at FROM word_mastery 
             WHERE user_name = ?1 AND segment_id IN (SELECT id FROM segments WHERE article_id = ?2 AND segment_type = ?3)"
        )?;
        let mastery_map: std::collections::HashMap<i64, (i32, String)> = mastery_stmt
            .query_map(rusqlite::params![user_name, article_id, segment_type], |row| {
                Ok((row.get(0)?, (row.get(1)?, row.get(2)?)))
            })?
            .filter_map(|r| r.ok())
            .map(|(id, (level, next))| (id, (level, next)))
            .collect();
        
        // 3. 分类：到期复习的单词 + 未学习的新单词
        let mut review_words: Vec<crate::models::ScheduledWord> = vec![];
        let mut new_words: Vec<crate::models::ScheduledWord> = vec![];
        let future_time = "2999-12-31 23:59:59"; // 新单词的未来时间
        
        for (segment_id, content, seg_type) in &all_segments {
            if let Some((mastery_level, next_review_at)) = mastery_map.get(segment_id) {
                // 已学习过的，检查是否到期
                // 只有到期的单词才需要复习（除非是刚开始学习的新词）
                if *next_review_at <= now {
                    // 到期，纳入复习
                    review_words.push(crate::models::ScheduledWord {
                        segment_id: *segment_id,
                        content: content.clone(),
                        segment_type: seg_type.clone(),
                        mastery_level: *mastery_level,
                        is_new: false,
                        next_review_at: next_review_at.clone(),
                    });
                }
            } else {
                // 新单词
                new_words.push(crate::models::ScheduledWord {
                    segment_id: *segment_id,
                    content: content.clone(),
                    segment_type: seg_type.clone(),
                    mastery_level: 0,
                    is_new: true,
                    next_review_at: future_time.to_string(),
                });
            }
        }
        
        // 4. 合并：复习单词优先，新单词填充剩余位置
        
        // 合并逻辑：优先选满 limit 数量的单词
        // 如果复习单词足够，直接取 limit 个
        // 如果复习单词不足，用新单词填满
        let mut result: Vec<_> = review_words.clone();
        
        if result.len() < limit as usize {
            // 复习单词不够，从新单词中补充
            let remaining = limit as usize - result.len();
            let new_to_add: Vec<_> = new_words.into_iter().take(remaining).collect();
            result.extend(new_to_add);
        } else {
            // 复习单词足够，只取前 limit 个
            result.truncate(limit as usize);
        }
        
        // 按记忆曲线优先级排序：
        // 1. 首先到期的单词优先（next_review_at 早的优先）
        // 2. 同等条件下 mastery_level 低的优先（掌握程度差的优先）
        // 3. 新单词按原始顺序（在最后）
        result.sort_by(|a, b| {
            // 新单词排在最后
            if a.is_new != b.is_new {
                return a.is_new.cmp(&b.is_new);
            }
            // 按下次复习时间排序（早的优先）
            let time_cmp = a.next_review_at.cmp(&b.next_review_at);
            if time_cmp != std::cmp::Ordering::Equal {
                return time_cmp;
            }
            // 按掌握程度排序（低的优先）
            a.mastery_level.cmp(&b.mastery_level)
        });
        
        // 统计新词和复习词数量
        let new_count = result.iter().filter(|w| w.is_new).count() as i32;
        let review_count_val = result.iter().filter(|w| !w.is_new).count() as i32;
        
        Ok(crate::models::ScheduledWordsResponse {
            words: result,
            new_words_count: new_count,
            review_words_count: review_count_val,
        })
    }

    /// 更新单词熟练度（SM-2 算法）
    pub fn update_word_mastery(
        &self,
        user_name: &str,
        segment_id: i64,
        segment_content: &str,
        segment_type: &str,
        correct: bool,
    ) -> SqliteResult<crate::models::WordMastery> {
        let now = chrono::Utc::now();
        let now_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
        
        // 查询现有记录
        let mut stmt = self.conn.prepare(
            "SELECT mastery_level, ease_factor, interval_days, review_count FROM word_mastery 
             WHERE user_name = ?1 AND segment_id = ?2"
        )?;
        
        let existing: Option<(i32, f64, i32, i32)> = stmt
            .query_row(rusqlite::params![user_name, segment_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .ok();
        
        // SM-2 算法计算
        let (mastery_level, ease_factor, interval_days, review_count) = if let Some((ml, ef, iv, rc)) = existing {
            if correct {
                // 答对：增加熟练度，延长间隔
                let new_ml = (ml + 1).min(5);
                let new_ef = (ef + 0.1).min(3.0).max(1.3);
                let new_iv = match new_ml {
                    0 => 1,
                    1 => 1,
                    2 => 3,
                    3 => 7,
                    4 => 14,
                    5 => 30,
                    _ => iv,
                };
                (new_ml, new_ef, new_iv, rc + 1)
            } else {
                // 答错：降低熟练度，重置间隔
                let new_ml = (ml - 1).max(0);
                let new_ef = (ef - 0.2).max(1.3);
                let new_iv = 0; // 立即需要再次复习
                (new_ml, new_ef, new_iv, rc)
            }
        } else {
            // 新单词
            if correct {
                (1, 2.5, 1, 1) // 答对后熟练度1，间隔1天
            } else {
                (0, 2.5, 0, 0) // 答错保持新词状态
            }
        };
        
        // 计算下次复习时间
        let next_review = if interval_days == 0 {
            // 答错或新词，当天或明天继续
            now_str.clone()
        } else {
            let next = now + chrono::Duration::days(interval_days as i64);
            next.format("%Y-%m-%d %H:%M:%S").to_string()
        };
        
        // 保存到数据库
        self.conn.execute(
            "INSERT INTO word_mastery (user_name, segment_id, segment_content, segment_type, mastery_level, ease_factor, interval_days, next_review_at, last_review_at, review_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_name, segment_id) DO UPDATE SET
                mastery_level = excluded.mastery_level,
                ease_factor = excluded.ease_factor,
                interval_days = excluded.interval_days,
                next_review_at = excluded.next_review_at,
                last_review_at = excluded.last_review_at,
                review_count = excluded.review_count,
                segment_content = excluded.segment_content,
                segment_type = excluded.segment_type",
            rusqlite::params![
                user_name,
                segment_id,
                segment_content,
                segment_type,
                mastery_level,
                ease_factor,
                interval_days,
                next_review,
                now_str,
                review_count
            ],
        )?;
        
        Ok(crate::models::WordMastery {
            user_name: user_name.to_string(),
            segment_id,
            segment_content: segment_content.to_string(),
            segment_type: segment_type.to_string(),
            mastery_level,
            ease_factor,
            interval_days,
            next_review_at: next_review,
            last_review_at: now_str,
            review_count,
        })
    }

    /// 获取用户所有单词的熟练度
    pub fn get_word_masteries(
        &self,
        user_name: &str,
        segment_type: Option<&str>,
    ) -> SqliteResult<Vec<crate::models::WordMastery>> {
        let sql = match segment_type {
            Some(st) => format!(
                "SELECT user_name, segment_id, segment_content, segment_type, mastery_level, ease_factor, interval_days, next_review_at, last_review_at, review_count 
                 FROM word_mastery WHERE user_name = '{}' AND segment_type = '{}' ORDER BY mastery_level ASC",
                user_name, st
            ),
            None => format!(
                "SELECT user_name, segment_id, segment_content, segment_type, mastery_level, ease_factor, interval_days, next_review_at, last_review_at, review_count 
                 FROM word_mastery WHERE user_name = '{}' ORDER BY mastery_level ASC",
                user_name
            ),
        };
        
        let mut stmt = self.conn.prepare(&sql)?;
        let masteries: SqliteResult<Vec<_>> = stmt.query_map([], |row| {
            Ok(crate::models::WordMastery {
                user_name: row.get(0)?,
                segment_id: row.get(1)?,
                segment_content: row.get(2)?,
                segment_type: row.get(3)?,
                mastery_level: row.get(4)?,
                ease_factor: row.get(5)?,
                interval_days: row.get(6)?,
                next_review_at: row.get(7)?,
                last_review_at: row.get(8)?,
                review_count: row.get(9)?,
            })
        })?.collect();
        
        Ok(masteries?)
    }

    // ========== 练习历史记录 ==========

    /// 保存练习历史
    pub fn save_practice_history(
        &self,
        user_name: &str,
        article_id: i64,
        segment_type: &str,
        correct_count: i32,
        incorrect_count: i32,
        duration_seconds: i32,
    ) -> SqliteResult<()> {
        let total_count = correct_count + incorrect_count;
        let accuracy = if total_count > 0 {
            (correct_count as f64 / total_count as f64) * 100.0
        } else {
            0.0
        };
        
        // 计算WPM（每分钟单词数）
        let wpm = if duration_seconds > 0 {
            (total_count as f64 / duration_seconds as f64) * 60.0
        } else {
            0.0
        };
        
        self.conn.execute(
            "INSERT INTO practice_history (user_name, article_id, segment_type, correct_count, incorrect_count, total_count, accuracy, wpm, duration_seconds) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                user_name,
                article_id,
                segment_type,
                correct_count,
                incorrect_count,
                total_count,
                accuracy,
                wpm,
                duration_seconds
            ],
        )?;
        Ok(())
    }

    /// 获取用户练习历史
    pub fn get_practice_history(
        &self,
        user_name: &str,
        limit: i32,
    ) -> SqliteResult<Vec<crate::models::PracticeHistory>> {
        let sql = format!(
            "SELECT h.id, h.user_name, h.article_id, a.title, h.segment_type, h.correct_count, h.incorrect_count, h.total_count, h.accuracy, h.wpm, h.duration_seconds, h.completed_at 
             FROM practice_history h 
             LEFT JOIN articles a ON h.article_id = a.id 
             WHERE h.user_name = '{}' 
             ORDER BY h.completed_at DESC 
             LIMIT {}",
            user_name, limit
        );
        
        let mut stmt = self.conn.prepare(&sql)?;
        let histories = stmt.query_map([], |row| {
            Ok(crate::models::PracticeHistory {
                id: row.get(0)?,
                user_name: row.get(1)?,
                article_id: row.get(2)?,
                article_title: row.get(3).unwrap_or_else(|_| "未知文章".to_string()),
                segment_type: row.get(4)?,
                correct_count: row.get(5)?,
                incorrect_count: row.get(6)?,
                total_count: row.get(7)?,
                accuracy: row.get(8)?,
                wpm: row.get(9)?,
                duration_seconds: row.get(10)?,
                completed_at: row.get(11)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        
        histories
    }

    /// 获取用户统计信息
    pub fn get_user_statistics(&self, user_name: &str) -> SqliteResult<crate::models::UserStatistics> {
        // 总体统计
        let stats_sql = format!(
            "SELECT 
                COUNT(*) as total_practices,
                COALESCE(SUM(correct_count), 0) as total_correct,
                COALESCE(SUM(incorrect_count), 0) as total_incorrect,
                COALESCE(SUM(total_count), 0) as total_words,
                COALESCE(AVG(accuracy), 0) as avg_accuracy,
                COALESCE(AVG(wpm), 0) as avg_wpm,
                COALESCE(MAX(accuracy), 0) as best_accuracy,
                COALESCE(MAX(wpm), 0) as best_wpm,
                COALESCE(SUM(duration_seconds), 0) as total_duration_seconds
             FROM practice_history 
             WHERE user_name = '{}'",
            user_name
        );
        
        let (total_practices, total_correct, total_incorrect, total_words, avg_accuracy, avg_wpm, best_accuracy, best_wpm, total_duration_seconds): (
            i32, i32, i32, i32, f64, f64, f64, f64, i32
        ) = self.conn.query_row(&stats_sql, [], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        })?;
        
        // 获取最近的练习记录
        let recent_histories = self.get_practice_history(user_name, 10)?;
        
        Ok(crate::models::UserStatistics {
            user_name: user_name.to_string(),
            total_practices,
            total_correct,
            total_incorrect,
            total_words,
            avg_accuracy,
            avg_wpm,
            best_accuracy,
            best_wpm,
            total_duration_minutes: total_duration_seconds as f64 / 60.0,
            recent_histories,
        })
    }

    // ========== WIDA 测试模块 ==========

    /// 获取听力题库
    pub fn get_wida_listening_questions(
        &self,
        grade_level: &str,
        domain: Option<&str>,
        limit: Option<i32>,
    ) -> SqliteResult<Vec<crate::models::WidaListeningQuestion>> {
        let sql = match (domain, limit) {
            (Some(d), Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, audio_text, image_url, question_text, options, correct_answer, explanation 
                 FROM wida_listening_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, d, l
            ),
            (None, Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, audio_text, image_url, question_text, options, correct_answer, explanation 
                 FROM wida_listening_questions WHERE grade_level = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, l
            ),
            (Some(d), None) => format!(
                "SELECT id, grade_level, domain, difficulty, audio_text, image_url, question_text, options, correct_answer, explanation 
                 FROM wida_listening_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY id",
                grade_level, d
            ),
            (None, None) => format!(
                "SELECT id, grade_level, domain, difficulty, audio_text, image_url, question_text, options, correct_answer, explanation 
                 FROM wida_listening_questions WHERE grade_level = '{}' 
                 ORDER BY id",
                grade_level
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let questions = stmt.query_map([], |row| {
            let options_json: String = row.get(7)?;
            let options: Vec<String> = serde_json::from_str(&options_json).unwrap_or_default();
            Ok(crate::models::WidaListeningQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                audio_text: row.get(4)?,
                image_url: row.get(5)?,
                question_text: row.get(6)?,
                options,
                correct_answer: row.get(8)?,
                explanation: row.get(9)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        questions
    }

    /// 获取阅读题库
    pub fn get_wida_reading_questions(
        &self,
        grade_level: &str,
        domain: Option<&str>,
        limit: Option<i32>,
    ) -> SqliteResult<Vec<crate::models::WidaReadingQuestion>> {
        let sql = match (domain, limit) {
            (Some(d), Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, passage, question_text, question_type, options, correct_answer, explanation 
                 FROM wida_reading_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, d, l
            ),
            (None, Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, passage, question_text, question_type, options, correct_answer, explanation 
                 FROM wida_reading_questions WHERE grade_level = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, l
            ),
            (Some(d), None) => format!(
                "SELECT id, grade_level, domain, difficulty, passage, question_text, question_type, options, correct_answer, explanation 
                 FROM wida_reading_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY id",
                grade_level, d
            ),
            (None, None) => format!(
                "SELECT id, grade_level, domain, difficulty, passage, question_text, question_type, options, correct_answer, explanation 
                 FROM wida_reading_questions WHERE grade_level = '{}' 
                 ORDER BY id",
                grade_level
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let questions = stmt.query_map([], |row| {
            let options_json: String = row.get(7)?;
            let options: Vec<String> = serde_json::from_str(&options_json).unwrap_or_default();
            Ok(crate::models::WidaReadingQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                passage: row.get(4)?,
                question_text: row.get(5)?,
                question_type: row.get(6)?,
                options,
                correct_answer: row.get(8)?,
                explanation: row.get(9)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        questions
    }

    /// 获取口语题库
    pub fn get_wida_speaking_questions(
        &self,
        grade_level: &str,
        domain: Option<&str>,
        limit: Option<i32>,
    ) -> SqliteResult<Vec<crate::models::WidaSpeakingQuestion>> {
        let sql = match (domain, limit) {
            (Some(d), Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, prompt_type, prompt_text, image_url, audio_text, sample_answer, rubric 
                 FROM wida_speaking_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, d, l
            ),
            (None, Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, prompt_type, prompt_text, image_url, audio_text, sample_answer, rubric 
                 FROM wida_speaking_questions WHERE grade_level = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, l
            ),
            (Some(d), None) => format!(
                "SELECT id, grade_level, domain, difficulty, prompt_type, prompt_text, image_url, audio_text, sample_answer, rubric 
                 FROM wida_speaking_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY id",
                grade_level, d
            ),
            (None, None) => format!(
                "SELECT id, grade_level, domain, difficulty, prompt_type, prompt_text, image_url, audio_text, sample_answer, rubric 
                 FROM wida_speaking_questions WHERE grade_level = '{}' 
                 ORDER BY id",
                grade_level
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let questions = stmt.query_map([], |row| {
            let rubric_json: String = row.get(9)?;
            let rubric: Vec<String> = serde_json::from_str(&rubric_json).unwrap_or_default();
            Ok(crate::models::WidaSpeakingQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                prompt_type: row.get(4)?,
                prompt_text: row.get(5)?,
                image_url: row.get(6)?,
                audio_text: row.get(7)?,
                sample_answer: row.get(8)?,
                rubric,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        questions
    }

    /// 获取写作题库
    pub fn get_wida_writing_questions(
        &self,
        grade_level: &str,
        domain: Option<&str>,
        limit: Option<i32>,
    ) -> SqliteResult<Vec<crate::models::WidaWritingQuestion>> {
        let sql = match (domain, limit) {
            (Some(d), Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, task_type, prompt, image_url, word_limit_min, word_limit_max, rubric, sample_answer 
                 FROM wida_writing_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, d, l
            ),
            (None, Some(l)) => format!(
                "SELECT id, grade_level, domain, difficulty, task_type, prompt, image_url, word_limit_min, word_limit_max, rubric, sample_answer 
                 FROM wida_writing_questions WHERE grade_level = '{}' 
                 ORDER BY RANDOM() LIMIT {}",
                grade_level, l
            ),
            (Some(d), None) => format!(
                "SELECT id, grade_level, domain, difficulty, task_type, prompt, image_url, word_limit_min, word_limit_max, rubric, sample_answer 
                 FROM wida_writing_questions WHERE grade_level = '{}' AND domain = '{}' 
                 ORDER BY id",
                grade_level, d
            ),
            (None, None) => format!(
                "SELECT id, grade_level, domain, difficulty, task_type, prompt, image_url, word_limit_min, word_limit_max, rubric, sample_answer 
                 FROM wida_writing_questions WHERE grade_level = '{}' 
                 ORDER BY id",
                grade_level
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let questions = stmt.query_map([], |row| {
            let rubric_json: String = row.get(9)?;
            let rubric: Vec<String> = serde_json::from_str(&rubric_json).unwrap_or_default();
            Ok(crate::models::WidaWritingQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                task_type: row.get(4)?,
                prompt: row.get(5)?,
                image_url: row.get(6)?,
                word_limit_min: row.get(7)?,
                word_limit_max: row.get(8)?,
                rubric,
                sample_answer: row.get(10)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        questions
    }

    /// 开始新的 WIDA 测试
    pub fn start_wida_test(&self, request: &crate::models::StartWidaTestRequest) -> SqliteResult<crate::models::WidaTestSession> {
        let question_ids: Vec<i64>;
        
        // 根据测试类型获取题目ID
        match request.test_type.as_str() {
            "listening" => {
                let questions = self.get_wida_listening_questions(
                    &request.grade_level,
                    request.domain.as_deref(),
                    Some(request.question_count),
                )?;
                question_ids = questions.iter().map(|q| q.id).collect();
            }
            "reading" => {
                let questions = self.get_wida_reading_questions(
                    &request.grade_level,
                    request.domain.as_deref(),
                    Some(request.question_count),
                )?;
                question_ids = questions.iter().map(|q| q.id).collect();
            }
            "speaking" => {
                let questions = self.get_wida_speaking_questions(
                    &request.grade_level,
                    request.domain.as_deref(),
                    Some(request.question_count),
                )?;
                question_ids = questions.iter().map(|q| q.id).collect();
            }
            "writing" => {
                let questions = self.get_wida_writing_questions(
                    &request.grade_level,
                    request.domain.as_deref(),
                    Some(request.question_count),
                )?;
                question_ids = questions.iter().map(|q| q.id).collect();
            }
            _ => return Err(rusqlite::Error::InvalidParameterName("Invalid test type".into())),
        }

        if question_ids.is_empty() {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        let question_ids_json = serde_json::to_string(&question_ids).unwrap_or_else(|_| "[]".to_string());
        let total_questions = question_ids.len() as i32;
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        self.conn.execute(
            "INSERT INTO wida_test_sessions (user_name, test_type, grade_level, domain, status, current_question, total_questions, question_ids, answers, started_at)
             VALUES (?, ?, ?, ?, 'in_progress', 0, ?, ?, '[]', ?)",
            rusqlite::params![
                request.user_name,
                request.test_type,
                request.grade_level,
                request.domain,
                total_questions,
                question_ids_json,
                now
            ],
        )?;

        let session_id = self.conn.last_insert_rowid();
        
        Ok(crate::models::WidaTestSession {
            id: session_id,
            user_name: request.user_name.clone(),
            test_type: request.test_type.clone(),
            grade_level: request.grade_level.clone(),
            domain: request.domain.clone(),
            status: "in_progress".to_string(),
            current_question: 0,
            total_questions,
            answers: "[]".to_string(),
            score: None,
            proficiency_level: None,
            started_at: now,
            completed_at: None,
            duration_seconds: 0,
        })
    }

    /// 获取测试会话
    pub fn get_wida_test_session(&self, session_id: i64) -> SqliteResult<Option<crate::models::WidaTestSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, user_name, test_type, grade_level, domain, status, current_question, total_questions, question_ids, answers, score, proficiency_level, started_at, completed_at, duration_seconds
             FROM wida_test_sessions WHERE id = ?"
        )?;
        
        let mut sessions = stmt.query_map([session_id], |row| {
            Ok(crate::models::WidaTestSession {
                id: row.get(0)?,
                user_name: row.get(1)?,
                test_type: row.get(2)?,
                grade_level: row.get(3)?,
                domain: row.get(4)?,
                status: row.get(5)?,
                current_question: row.get(6)?,
                total_questions: row.get(7)?,
                // question_ids is stored but not returned in session
                answers: row.get(9)?,
                score: row.get(10)?,
                proficiency_level: row.get(11)?,
                started_at: row.get(12)?,
                completed_at: row.get(13)?,
                duration_seconds: row.get(14)?,
            })
        })?;
        
        Ok(sessions.next().transpose()?)
    }

    /// 获取测试题目
    pub fn get_wida_test_questions(&self, session_id: i64) -> SqliteResult<serde_json::Value> {
        let question_ids_json: String = self.conn.query_row(
            "SELECT question_ids FROM wida_test_sessions WHERE id = ?",
            [session_id],
            |row| row.get(0),
        )?;

        let question_ids: Vec<i64> = serde_json::from_str(&question_ids_json).unwrap_or_default();
        let test_type: String = self.conn.query_row(
            "SELECT test_type FROM wida_test_sessions WHERE id = ?",
            [session_id],
            |row| row.get(0),
        )?;

        let questions = match test_type.as_str() {
            "listening" => {
                let q: Vec<crate::models::WidaListeningQuestion> = question_ids.iter()
                    .filter_map(|&id| self.get_wida_listening_question_by_id(id).ok().flatten())
                    .collect();
                serde_json::to_value(q).unwrap_or(serde_json::json!([]))
            }
            "reading" => {
                let q: Vec<crate::models::WidaReadingQuestion> = question_ids.iter()
                    .filter_map(|&id| self.get_wida_reading_question_by_id(id).ok().flatten())
                    .collect();
                serde_json::to_value(q).unwrap_or(serde_json::json!([]))
            }
            "speaking" => {
                let q: Vec<crate::models::WidaSpeakingQuestion> = question_ids.iter()
                    .filter_map(|&id| self.get_wida_speaking_question_by_id(id).ok().flatten())
                    .collect();
                serde_json::to_value(q).unwrap_or(serde_json::json!([]))
            }
            "writing" => {
                let q: Vec<crate::models::WidaWritingQuestion> = question_ids.iter()
                    .filter_map(|&id| self.get_wida_writing_question_by_id(id).ok().flatten())
                    .collect();
                serde_json::to_value(q).unwrap_or(serde_json::json!([]))
            }
            _ => serde_json::json!([]),
        };

        Ok(questions)
    }

    fn get_wida_listening_question_by_id(&self, id: i64) -> SqliteResult<Option<crate::models::WidaListeningQuestion>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, grade_level, domain, difficulty, audio_text, image_url, question_text, options, correct_answer, explanation 
             FROM wida_listening_questions WHERE id = ?"
        )?;
        let mut questions = stmt.query_map([id], |row| {
            let options_json: String = row.get(7)?;
            let options: Vec<String> = serde_json::from_str(&options_json).unwrap_or_default();
            Ok(crate::models::WidaListeningQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                audio_text: row.get(4)?,
                image_url: row.get(5)?,
                question_text: row.get(6)?,
                options,
                correct_answer: row.get(8)?,
                explanation: row.get(9)?,
            })
        })?;
        Ok(questions.next().transpose()?)
    }

    fn get_wida_reading_question_by_id(&self, id: i64) -> SqliteResult<Option<crate::models::WidaReadingQuestion>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, grade_level, domain, difficulty, passage, question_text, question_type, options, correct_answer, explanation 
             FROM wida_reading_questions WHERE id = ?"
        )?;
        let mut questions = stmt.query_map([id], |row| {
            let options_json: String = row.get(7)?;
            let options: Vec<String> = serde_json::from_str(&options_json).unwrap_or_default();
            Ok(crate::models::WidaReadingQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                passage: row.get(4)?,
                question_text: row.get(5)?,
                question_type: row.get(6)?,
                options,
                correct_answer: row.get(8)?,
                explanation: row.get(9)?,
            })
        })?;
        Ok(questions.next().transpose()?)
    }

    fn get_wida_speaking_question_by_id(&self, id: i64) -> SqliteResult<Option<crate::models::WidaSpeakingQuestion>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, grade_level, domain, difficulty, prompt_type, prompt_text, image_url, audio_text, sample_answer, rubric 
             FROM wida_speaking_questions WHERE id = ?"
        )?;
        let mut questions = stmt.query_map([id], |row| {
            let rubric_json: String = row.get(9)?;
            let rubric: Vec<String> = serde_json::from_str(&rubric_json).unwrap_or_default();
            Ok(crate::models::WidaSpeakingQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                prompt_type: row.get(4)?,
                prompt_text: row.get(5)?,
                image_url: row.get(6)?,
                audio_text: row.get(7)?,
                sample_answer: row.get(8)?,
                rubric,
            })
        })?;
        Ok(questions.next().transpose()?)
    }

    fn get_wida_writing_question_by_id(&self, id: i64) -> SqliteResult<Option<crate::models::WidaWritingQuestion>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, grade_level, domain, difficulty, task_type, prompt, image_url, word_limit_min, word_limit_max, rubric, sample_answer 
             FROM wida_writing_questions WHERE id = ?"
        )?;
        let mut questions = stmt.query_map([id], |row| {
            let rubric_json: String = row.get(9)?;
            let rubric: Vec<String> = serde_json::from_str(&rubric_json).unwrap_or_default();
            Ok(crate::models::WidaWritingQuestion {
                id: row.get(0)?,
                grade_level: row.get(1)?,
                domain: row.get(2)?,
                difficulty: row.get(3)?,
                task_type: row.get(4)?,
                prompt: row.get(5)?,
                image_url: row.get(6)?,
                word_limit_min: row.get(7)?,
                word_limit_max: row.get(8)?,
                rubric,
                sample_answer: row.get(10)?,
            })
        })?;
        Ok(questions.next().transpose()?)
    }

    /// 提交答案
    pub fn submit_wida_answer(&self, request: &crate::models::SubmitWidaAnswerRequest) -> SqliteResult<()> {
        // 获取当前答案列表
        let answers_json: String = self.conn.query_row(
            "SELECT answers FROM wida_test_sessions WHERE id = ?",
            [request.session_id],
            |row| row.get(0),
        )?;

        let mut answers: Vec<crate::models::WidaTestAnswer> = serde_json::from_str(&answers_json).unwrap_or_default();
        
        // 添加新答案
        answers.push(crate::models::WidaTestAnswer {
            question_id: request.question_id,
            user_answer: request.answer.clone(),
            is_correct: None,
            time_spent_seconds: request.time_spent_seconds,
        });

        let new_answers_json = serde_json::to_string(&answers).unwrap_or_else(|_| "[]".to_string());
        let new_current_question = answers.len() as i32;

        self.conn.execute(
            "UPDATE wida_test_sessions SET answers = ?, current_question = ? WHERE id = ?",
            rusqlite::params![new_answers_json, new_current_question, request.session_id],
        )?;

        Ok(())
    }

    /// 完成测试并计算成绩
    pub fn complete_wida_test(&self, request: &crate::models::CompleteWidaTestRequest) -> SqliteResult<crate::models::WidaTestReport> {
        let session = self.get_wida_test_session(request.session_id)?.ok_or_else(|| {
            rusqlite::Error::QueryReturnedNoRows
        })?;

        // 获取答案和题目
        let answers_json: String = self.conn.query_row(
            "SELECT answers FROM wida_test_sessions WHERE id = ?",
            [request.session_id],
            |row| row.get(0),
        )?;

        let question_ids_json: String = self.conn.query_row(
            "SELECT question_ids FROM wida_test_sessions WHERE id = ?",
            [request.session_id],
            |row| row.get(0),
        )?;

        let answers: Vec<crate::models::WidaTestAnswer> = serde_json::from_str(&answers_json).unwrap_or_default();
        let question_ids: Vec<i64> = serde_json::from_str(&question_ids_json).unwrap_or_default();

        // 计算成绩
        let mut correct_count = 0;
        let mut details: Vec<crate::models::WidaAnswerDetail> = Vec::new();
        let total_count = question_ids.len() as i32;

        // 根据测试类型验证答案
        for (idx, &question_id) in question_ids.iter().enumerate() {
            if idx < answers.len() {
                let answer = &answers[idx];
                let is_correct = self.check_wida_answer(&session.test_type, question_id, &answer.user_answer)?;
                
                if is_correct {
                    correct_count += 1;
                }

                // 获取题目文本和正确答案
                let (question_text, correct_answer_text) = self.get_wida_question_info(&session.test_type, question_id)?;

                details.push(crate::models::WidaAnswerDetail {
                    question_id,
                    question_text,
                    user_answer: answer.user_answer.clone(),
                    correct_answer: correct_answer_text,
                    is_correct,
                    time_spent_seconds: answer.time_spent_seconds,
                    explanation: None,
                });
            }
        }

        let accuracy = if total_count > 0 {
            (correct_count as f64 / total_count as f64) * 100.0
        } else {
            0.0
        };

        // 计算 Scale Score (100-600)
        let score = 100.0 + (accuracy / 100.0) * 500.0;
        
        // 计算 Proficiency Level (1-6)
        let proficiency_level = if score >= 550.0 { 6 }
            else if score >= 475.0 { 5 }
            else if score >= 400.0 { 4 }
            else if score >= 325.0 { 3 }
            else if score >= 250.0 { 2 }
            else { 1 };

        let proficiency_level_name = match proficiency_level {
            1 => "Entering",
            2 => "Emerging",
            3 => "Developing",
            4 => "Expanding",
            5 => "Bridging",
            6 => "Reaching",
            _ => "Unknown",
        }.to_string();

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        // 更新会话状态
        self.conn.execute(
            "UPDATE wida_test_sessions SET status = 'completed', score = ?, proficiency_level = ?, completed_at = ? WHERE id = ?",
            rusqlite::params![score, proficiency_level, now, request.session_id],
        )?;

        // 保存到历史记录
        self.conn.execute(
            "INSERT INTO wida_test_history (user_name, test_type, grade_level, score, proficiency_level, accuracy, total_questions, correct_count, duration_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
            rusqlite::params![
                session.user_name,
                session.test_type,
                session.grade_level,
                score,
                proficiency_level,
                accuracy,
                total_count,
                correct_count
            ],
        )?;

        Ok(crate::models::WidaTestReport {
            session: crate::models::WidaTestSession {
                id: session.id,
                user_name: session.user_name,
                test_type: session.test_type.clone(),
                grade_level: session.grade_level,
                domain: session.domain,
                status: "completed".to_string(),
                current_question: session.current_question,
                total_questions: session.total_questions,
                answers: session.answers,
                score: Some(score),
                proficiency_level: Some(proficiency_level),
                started_at: session.started_at,
                completed_at: Some(now),
                duration_seconds: session.duration_seconds,
            },
            correct_count,
            total_count,
            accuracy,
            listening_score: if session.test_type == "listening" { Some(score) } else { None },
            reading_score: if session.test_type == "reading" { Some(score) } else { None },
            speaking_score: if session.test_type == "speaking" { Some(score) } else { None },
            writing_score: if session.test_type == "writing" { Some(score) } else { None },
            overall_score: score,
            proficiency_level,
            proficiency_level_name,
            details,
        })
    }

    fn check_wida_answer(&self, test_type: &str, question_id: i64, user_answer: &str) -> SqliteResult<bool> {
        match test_type {
            "listening" => {
                if let Some(q) = self.get_wida_listening_question_by_id(question_id)? {
                    return Ok(user_answer.parse::<i32>().unwrap_or(-1) == q.correct_answer);
                }
            }
            "reading" => {
                if let Some(q) = self.get_wida_reading_question_by_id(question_id)? {
                    return Ok(user_answer.parse::<i32>().unwrap_or(-1) == q.correct_answer);
                }
            }
            // 口语和写作需要人工评分，暂时返回true
            "speaking" | "writing" => return Ok(true),
            _ => {}
        }
        Ok(false)
    }

    fn get_wida_question_info(&self, test_type: &str, question_id: i64) -> SqliteResult<(String, String)> {
        match test_type {
            "listening" => {
                if let Some(q) = self.get_wida_listening_question_by_id(question_id)? {
                    return Ok((q.question_text, q.options.get(q.correct_answer as usize).cloned().unwrap_or_default()));
                }
            }
            "reading" => {
                if let Some(q) = self.get_wida_reading_question_by_id(question_id)? {
                    return Ok((q.question_text, q.options.get(q.correct_answer as usize).cloned().unwrap_or_default()));
                }
            }
            "speaking" => {
                if let Some(q) = self.get_wida_speaking_question_by_id(question_id)? {
                    return Ok((q.prompt_text, q.sample_answer));
                }
            }
            "writing" => {
                if let Some(q) = self.get_wida_writing_question_by_id(question_id)? {
                    return Ok((q.prompt, q.sample_answer.unwrap_or_default()));
                }
            }
            _ => {}
        }
        Ok(("".to_string(), "".to_string()))
    }

    /// 获取用户测试历史
    pub fn get_wida_history(&self, user_name: &str, test_type: Option<&str>, limit: Option<i32>) -> SqliteResult<Vec<crate::models::WidaHistoryRecord>> {
        let sql = match (test_type, limit) {
            (Some(t), Some(l)) => format!(
                "SELECT id, user_name, test_type, grade_level, score, proficiency_level, accuracy, total_questions, correct_count, duration_seconds, completed_at
                 FROM wida_test_history WHERE user_name = '{}' AND test_type = '{}' ORDER BY completed_at DESC LIMIT {}",
                user_name, t, l
            ),
            (None, Some(l)) => format!(
                "SELECT id, user_name, test_type, grade_level, score, proficiency_level, accuracy, total_questions, correct_count, duration_seconds, completed_at
                 FROM wida_test_history WHERE user_name = '{}' ORDER BY completed_at DESC LIMIT {}",
                user_name, l
            ),
            (Some(t), None) => format!(
                "SELECT id, user_name, test_type, grade_level, score, proficiency_level, accuracy, total_questions, correct_count, duration_seconds, completed_at
                 FROM wida_test_history WHERE user_name = '{}' AND test_type = '{}' ORDER BY completed_at DESC",
                user_name, t
            ),
            (None, None) => format!(
                "SELECT id, user_name, test_type, grade_level, score, proficiency_level, accuracy, total_questions, correct_count, duration_seconds, completed_at
                 FROM wida_test_history WHERE user_name = '{}' ORDER BY completed_at DESC",
                user_name
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let records = stmt.query_map([], |row| {
            Ok(crate::models::WidaHistoryRecord {
                id: row.get(0)?,
                user_name: row.get(1)?,
                test_type: row.get(2)?,
                grade_level: row.get(3)?,
                score: row.get(4)?,
                proficiency_level: row.get(5)?,
                accuracy: row.get(6)?,
                total_questions: row.get(7)?,
                correct_count: row.get(8)?,
                duration_seconds: row.get(9)?,
                completed_at: row.get(10)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        records
    }

    /// 获取用户综合报告
    pub fn get_wida_comprehensive_report(&self, user_name: &str) -> SqliteResult<crate::models::WidaComprehensiveReport> {
        let history = self.get_wida_history(user_name, None, Some(100))?;

        let mut listening_scores: Vec<f64> = Vec::new();
        let mut reading_scores: Vec<f64> = Vec::new();
        let mut speaking_scores: Vec<f64> = Vec::new();
        let mut writing_scores: Vec<f64> = Vec::new();

        for record in &history {
            match record.test_type.as_str() {
                "listening" => listening_scores.push(record.score),
                "reading" => reading_scores.push(record.score),
                "speaking" => speaking_scores.push(record.score),
                "writing" => writing_scores.push(record.score),
                _ => {}
            }
        }

        let listening_score = if !listening_scores.is_empty() { Some(listening_scores.iter().sum::<f64>() / listening_scores.len() as f64) } else { None };
        let reading_score = if !reading_scores.is_empty() { Some(reading_scores.iter().sum::<f64>() / reading_scores.len() as f64) } else { None };
        let speaking_score = if !speaking_scores.is_empty() { Some(speaking_scores.iter().sum::<f64>() / speaking_scores.len() as f64) } else { None };
        let writing_score = if !writing_scores.is_empty() { Some(writing_scores.iter().sum::<f64>() / writing_scores.len() as f64) } else { None };

        let listening_level = listening_score.map(|s| score_to_level(s));
        let reading_level = reading_score.map(|s| score_to_level(s));
        let speaking_level = speaking_score.map(|s| score_to_level(s));
        let writing_level = writing_score.map(|s| score_to_level(s));

        // 计算综合分数
        let oral_score = match (&listening_score, &speaking_score) {
            (Some(l), Some(s)) => Some((l + s) / 2.0),
            (Some(l), None) => Some(*l),
            (None, Some(s)) => Some(*s),
            _ => None,
        };

        let literacy_score = match (&reading_score, &writing_score) {
            (Some(r), Some(w)) => Some((r + w) / 2.0),
            (Some(r), None) => Some(*r),
            (None, Some(w)) => Some(*w),
            _ => None,
        };

        // 总分 = 30%听口 + 70%读写
        let overall_score = match (&oral_score, &literacy_score) {
            (Some(o), Some(l)) => o * 0.3 + l * 0.7,
            (Some(o), None) => *o,
            (None, Some(l)) => *l,
            _ => 0.0,
        };

        let overall_level = score_to_level(overall_score);
        let last_test_date = history.first().map(|r| r.completed_at.clone()).unwrap_or_default();

        Ok(crate::models::WidaComprehensiveReport {
            user_name: user_name.to_string(),
            listening_score,
            listening_level,
            reading_score,
            reading_level,
            speaking_score,
            speaking_level,
            writing_score,
            writing_level,
            oral_score,
            literacy_score,
            overall_score,
            overall_level,
            test_count: history.len() as i32,
            last_test_date,
        })
    }

    /// 获取进行中的测试会话
    pub fn get_active_wida_sessions(&self, user_name: &str) -> SqliteResult<Vec<crate::models::WidaTestSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, user_name, test_type, grade_level, domain, status, current_question, total_questions, question_ids, answers, score, proficiency_level, started_at, completed_at, duration_seconds
             FROM wida_test_sessions WHERE user_name = ? AND status = 'in_progress' ORDER BY started_at DESC"
        )?;
        
        let sessions = stmt.query_map([user_name], |row| {
            Ok(crate::models::WidaTestSession {
                id: row.get(0)?,
                user_name: row.get(1)?,
                test_type: row.get(2)?,
                grade_level: row.get(3)?,
                domain: row.get(4)?,
                status: row.get(5)?,
                current_question: row.get(6)?,
                total_questions: row.get(7)?,
                answers: row.get(9)?,
                score: row.get(10)?,
                proficiency_level: row.get(11)?,
                started_at: row.get(12)?,
                completed_at: row.get(13)?,
                duration_seconds: row.get(14)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>();
        sessions
    }

    /// 删除测试会话
    pub fn delete_wida_session(&self, session_id: i64) -> SqliteResult<()> {
        self.conn.execute("DELETE FROM wida_test_sessions WHERE id = ?", [session_id])?;
        Ok(())
    }
    
    // ========== 保存生成的题目 ==========
    
    /// 保存生成的听力题目
    pub fn save_listening_questions(&self, questions: &[crate::commands::wida::GeneratedListeningQuestion]) -> SqliteResult<i32> {
        let mut count = 0;
        for q in questions {
            let options_json = serde_json::to_string(&q.options).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_listening_questions (grade_level, domain, difficulty, audio_text, image_url, question_text, options, correct_answer, explanation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.audio_text,
                    q.image_url,
                    q.question_text,
                    options_json,
                    q.correct_answer,
                    q.explanation,
                ],
            )?;
            count += 1;
        }
        Ok(count)
    }
    
    /// 保存生成的阅读题目
    pub fn save_reading_questions(&self, questions: &[crate::commands::wida::GeneratedReadingQuestion]) -> SqliteResult<i32> {
        let mut count = 0;
        for q in questions {
            let options_json = serde_json::to_string(&q.options).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_reading_questions (grade_level, domain, difficulty, passage, question_text, question_type, options, correct_answer, explanation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.passage,
                    q.question_text,
                    q.question_type,
                    options_json,
                    q.correct_answer,
                    q.explanation,
                ],
            )?;
            count += 1;
        }
        Ok(count)
    }
    
    /// 保存生成的口语题目
    pub fn save_speaking_questions(&self, questions: &[crate::commands::wida::GeneratedSpeakingQuestion]) -> SqliteResult<i32> {
        let mut count = 0;
        for q in questions {
            let rubric_json = serde_json::to_string(&q.rubric).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_speaking_questions (grade_level, domain, difficulty, prompt_type, prompt_text, image_url, audio_text, sample_answer, rubric)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.prompt_type,
                    q.prompt_text,
                    q.image_url,
                    q.audio_text,
                    q.sample_answer,
                    rubric_json,
                ],
            )?;
            count += 1;
        }
        Ok(count)
    }
    
    /// 保存生成的写作题目
    pub fn save_writing_questions(&self, questions: &[crate::commands::wida::GeneratedWritingQuestion]) -> SqliteResult<i32> {
        let mut count = 0;
        for q in questions {
            let rubric_json = serde_json::to_string(&q.rubric).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_writing_questions (grade_level, domain, difficulty, task_type, prompt, image_url, word_limit_min, word_limit_max, rubric, sample_answer)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.task_type,
                    q.prompt,
                    q.image_url,
                    q.word_limit_min,
                    q.word_limit_max,
                    rubric_json,
                    q.sample_answer,
                ],
            )?;
            count += 1;
        }
        Ok(count)
    }
}

fn score_to_level(score: f64) -> i32 {
    if score >= 550.0 { 6 }
    else if score >= 475.0 { 5 }
    else if score >= 400.0 { 4 }
    else if score >= 325.0 { 3 }
    else if score >= 250.0 { 2 }
    else { 1 }
}

impl DatabaseManager {
    /// 初始化WIDA题库（如果为空）
    pub fn seed_wida_questions(&self) -> SqliteResult<()> {
        // 检查是否已有数据
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM wida_listening_questions",
            [],
            |row| row.get(0),
        )?;

        if count > 0 {
            return Ok(()); // 已有数据，跳过
        }

        // 插入听力题
        let listening_questions = get_default_listening_questions();
        for q in listening_questions {
            let options_json = serde_json::to_string(&q.options).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_listening_questions (id, grade_level, domain, difficulty, audio_text, image_url, question_text, options, correct_answer, explanation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.id,
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.audio_text,
                    q.image_url,
                    q.question_text,
                    options_json,
                    q.correct_answer,
                    q.explanation,
                ],
            )?;
        }

        // 插入阅读题
        let reading_questions = get_default_reading_questions();
        for q in reading_questions {
            let options_json = serde_json::to_string(&q.options).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_reading_questions (id, grade_level, domain, difficulty, passage, question_text, question_type, options, correct_answer, explanation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.id,
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.passage,
                    q.question_text,
                    q.question_type,
                    options_json,
                    q.correct_answer,
                    q.explanation,
                ],
            )?;
        }

        // 插入口语题
        let speaking_questions = get_default_speaking_questions();
        for q in speaking_questions {
            let rubric_json = serde_json::to_string(&q.rubric).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_speaking_questions (id, grade_level, domain, difficulty, prompt_type, prompt_text, image_url, audio_text, sample_answer, rubric)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.id,
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.prompt_type,
                    q.prompt_text,
                    q.image_url,
                    q.audio_text,
                    q.sample_answer,
                    rubric_json,
                ],
            )?;
        }

        // 插入写作题
        let writing_questions = get_default_writing_questions();
        for q in writing_questions {
            let rubric_json = serde_json::to_string(&q.rubric).unwrap_or_else(|_| "[]".to_string());
            self.conn.execute(
                "INSERT INTO wida_writing_questions (id, grade_level, domain, difficulty, task_type, prompt, image_url, word_limit_min, word_limit_max, rubric, sample_answer)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    q.id,
                    q.grade_level,
                    q.domain,
                    q.difficulty,
                    q.task_type,
                    q.prompt,
                    q.image_url,
                    q.word_limit_min,
                    q.word_limit_max,
                    rubric_json,
                    q.sample_answer,
                ],
            )?;
        }

        log::info!("WIDA questions seeded successfully");
        Ok(())
    }
}

#[derive(Debug)]
struct ListeningQuestionData {
    id: i64,
    grade_level: String,
    domain: String,
    difficulty: i32,
    audio_text: String,
    image_url: Option<String>,
    question_text: String,
    options: Vec<String>,
    correct_answer: i32,
    explanation: Option<String>,
}

#[derive(Debug)]
struct ReadingQuestionData {
    id: i64,
    grade_level: String,
    domain: String,
    difficulty: i32,
    passage: String,
    question_text: String,
    question_type: String,
    options: Vec<String>,
    correct_answer: i32,
    explanation: Option<String>,
}

#[derive(Debug)]
struct SpeakingQuestionData {
    id: i64,
    grade_level: String,
    domain: String,
    difficulty: i32,
    prompt_type: String,
    prompt_text: String,
    image_url: Option<String>,
    audio_text: Option<String>,
    sample_answer: String,
    rubric: Vec<String>,
}

#[derive(Debug)]
struct WritingQuestionData {
    id: i64,
    grade_level: String,
    domain: String,
    difficulty: i32,
    task_type: String,
    prompt: String,
    image_url: Option<String>,
    word_limit_min: i32,
    word_limit_max: i32,
    rubric: Vec<String>,
    sample_answer: Option<String>,
}

fn get_default_listening_questions() -> Vec<ListeningQuestionData> {
    vec![
        ListeningQuestionData {
            id: 1,
            grade_level: "grade_1_2".to_string(),
            domain: "social_instructional".to_string(),
            difficulty: 1,
            audio_text: "Hello, my name is Sarah. I am six years old. What is your name?".to_string(),
            image_url: None,
            question_text: "What is the speaker's name?".to_string(),
            options: vec!["Sarah".to_string(), "Emma".to_string(), "Lisa".to_string(), "Anna".to_string()],
            correct_answer: 0,
            explanation: Some("The speaker introduces herself as Sarah at the beginning.".to_string()),
        },
        ListeningQuestionData {
            id: 2,
            grade_level: "grade_1_2".to_string(),
            domain: "social_instructional".to_string(),
            difficulty: 1,
            audio_text: "Look at the picture. There are three apples on the table. Two apples are red and one apple is green.".to_string(),
            image_url: None,
            question_text: "How many apples are there in total?".to_string(),
            options: vec!["Two".to_string(), "Three".to_string(), "Four".to_string(), "Five".to_string()],
            correct_answer: 1,
            explanation: Some("The speaker says 'There are three apples on the table.'".to_string()),
        },
        ListeningQuestionData {
            id: 3,
            grade_level: "grade_1_2".to_string(),
            domain: "mathematics".to_string(),
            difficulty: 2,
            audio_text: "Tom has five pencils. He gives two pencils to his friend. How many pencils does Tom have now?".to_string(),
            image_url: None,
            question_text: "How many pencils does Tom have after giving away two?".to_string(),
            options: vec!["Two".to_string(), "Three".to_string(), "Four".to_string(), "Five".to_string()],
            correct_answer: 1,
            explanation: Some("Five minus two equals three.".to_string()),
        },
        ListeningQuestionData {
            id: 4,
            grade_level: "grade_1_2".to_string(),
            domain: "science".to_string(),
            difficulty: 2,
            audio_text: "Plants need water and sunlight to grow. Without water, plants will dry up and die.".to_string(),
            image_url: None,
            question_text: "What do plants need to grow according to the audio?".to_string(),
            options: vec!["Only water".to_string(), "Only sunlight".to_string(), "Water and sunlight".to_string(), "Nothing".to_string()],
            correct_answer: 2,
            explanation: Some("The speaker mentions that plants need both water and sunlight.".to_string()),
        },
        ListeningQuestionData {
            id: 5,
            grade_level: "grade_3_5".to_string(),
            domain: "social_instructional".to_string(),
            difficulty: 2,
            audio_text: "Good morning, students! Today we are going to learn about animals. First, let's talk about mammals. Mammals are animals that have hair or fur and feed their babies with milk.".to_string(),
            image_url: None,
            question_text: "What characteristic is mentioned about mammals?".to_string(),
            options: vec!["They have feathers".to_string(), "They have scales".to_string(), "They have hair or fur".to_string(), "They lay eggs".to_string()],
            correct_answer: 2,
            explanation: Some("The speaker says mammals have hair or fur.".to_string()),
        },
        ListeningQuestionData {
            id: 6,
            grade_level: "grade_3_5".to_string(),
            domain: "mathematics".to_string(),
            difficulty: 3,
            audio_text: "A rectangle has four sides. The two longer sides are each 8 centimeters. The two shorter sides are each 5 centimeters. What is the perimeter of the rectangle?".to_string(),
            image_url: None,
            question_text: "What is the perimeter of the rectangle?".to_string(),
            options: vec!["13 cm".to_string(), "21 cm".to_string(), "26 cm".to_string(), "40 cm".to_string()],
            correct_answer: 2,
            explanation: Some("Perimeter = 8 + 8 + 5 + 5 = 26 centimeters.".to_string()),
        },
        ListeningQuestionData {
            id: 7,
            grade_level: "grade_3_5".to_string(),
            domain: "science".to_string(),
            difficulty: 3,
            audio_text: "The water cycle is the process of water moving from the Earth to the sky and back again. First, the sun heats up water in lakes and oceans. Then the water becomes vapor and rises into the air. This is called evaporation.".to_string(),
            image_url: None,
            question_text: "What happens during evaporation?".to_string(),
            options: vec!["Water falls as rain".to_string(), "Water becomes vapor and rises".to_string(), "Water freezes".to_string(), "Water flows in rivers".to_string()],
            correct_answer: 1,
            explanation: Some("During evaporation, water becomes vapor and rises into the air.".to_string()),
        },
        ListeningQuestionData {
            id: 8,
            grade_level: "grade_3_5".to_string(),
            domain: "language_arts".to_string(),
            difficulty: 3,
            audio_text: "Once upon a time, there was a little rabbit named Ruby. Ruby loved to hop through the green meadow. One sunny day, she found a beautiful blue flower.".to_string(),
            image_url: None,
            question_text: "What color was the flower Ruby found?".to_string(),
            options: vec!["Red".to_string(), "Yellow".to_string(), "Blue".to_string(), "White".to_string()],
            correct_answer: 2,
            explanation: Some("The story says Ruby found a beautiful blue flower.".to_string()),
        },
        ListeningQuestionData {
            id: 9,
            grade_level: "grade_6_8".to_string(),
            domain: "social_studies".to_string(),
            difficulty: 4,
            audio_text: "The American Revolution began in 1775. The thirteen colonies wanted independence from Great Britain. They were unhappy about paying taxes without having representatives in the British government.".to_string(),
            image_url: None,
            question_text: "Why were the colonies unhappy with Great Britain?".to_string(),
            options: vec!["They wanted more land".to_string(), "They had to pay taxes without representation".to_string(), "They wanted to join France".to_string(), "They disliked the British king".to_string()],
            correct_answer: 1,
            explanation: Some("The colonies were unhappy about paying taxes without representatives.".to_string()),
        },
        ListeningQuestionData {
            id: 10,
            grade_level: "grade_6_8".to_string(),
            domain: "science".to_string(),
            difficulty: 4,
            audio_text: "Photosynthesis is the process by which plants make their own food. During this process, plants use sunlight, carbon dioxide, and water to produce glucose and oxygen. This process mainly occurs in the leaves of plants.".to_string(),
            image_url: None,
            question_text: "What is produced during photosynthesis?".to_string(),
            options: vec!["Carbon dioxide and water".to_string(), "Sunlight and oxygen".to_string(), "Glucose and oxygen".to_string(), "Water and glucose only".to_string()],
            correct_answer: 2,
            explanation: Some("Photosynthesis produces glucose and oxygen.".to_string()),
        },
    ]
}

fn get_default_reading_questions() -> Vec<ReadingQuestionData> {
    vec![
        ReadingQuestionData {
            id: 1,
            grade_level: "grade_1_2".to_string(),
            domain: "social_instructional".to_string(),
            difficulty: 1,
            passage: "My name is Tom. I have a dog. My dog's name is Spot. Spot is brown and white. He likes to play with his ball.".to_string(),
            question_text: "What color is Spot?".to_string(),
            question_type: "multiple_choice".to_string(),
            options: vec!["Black".to_string(), "Brown and white".to_string(), "Gray".to_string(), "Yellow".to_string()],
            correct_answer: 1,
            explanation: Some("The passage says 'Spot is brown and white.'".to_string()),
        },
        ReadingQuestionData {
            id: 2,
            grade_level: "grade_1_2".to_string(),
            domain: "mathematics".to_string(),
            difficulty: 1,
            passage: "Sara has 3 red apples. She buys 2 more red apples at the store. Now Sara has apples to share with her friends.".to_string(),
            question_text: "How many apples does Sara have in total?".to_string(),
            question_type: "multiple_choice".to_string(),
            options: vec!["3 apples".to_string(), "2 apples".to_string(), "5 apples".to_string(), "6 apples".to_string()],
            correct_answer: 2,
            explanation: Some("3 + 2 = 5 apples.".to_string()),
        },
        ReadingQuestionData {
            id: 3,
            grade_level: "grade_1_2".to_string(),
            domain: "science".to_string(),
            difficulty: 2,
            passage: "Fish live in water. They have fins to help them swim. Fish use gills to breathe underwater. Some fish are small, and some fish are very big.".to_string(),
            question_text: "What do fish use to breathe underwater?".to_string(),
            question_type: "multiple_choice".to_string(),
            options: vec!["Lungs".to_string(), "Fins".to_string(), "Gills".to_string(), "Nose".to_string()],
            correct_answer: 2,
            explanation: Some("The passage states that fish use gills to breathe underwater.".to_string()),
        },
        ReadingQuestionData {
            id: 4,
            grade_level: "grade_3_5".to_string(),
            domain: "language_arts".to_string(),
            difficulty: 2,
            passage: "The Little Red Hen lived on a farm with a pig, a duck, and a cat. One day, she found some wheat seeds. She asked her friends, 'Who will help me plant these seeds?' 'Not I,' said the pig. 'Not I,' said the duck. 'Not I,' said the cat. So the Little Red Hen planted the seeds herself.".to_string(),
            question_text: "Who helped the Little Red Hen plant the seeds?".to_string(),
            question_type: "multiple_choice".to_string(),
            options: vec!["The pig".to_string(), "The duck".to_string(), "The cat".to_string(), "No one".to_string()],
            correct_answer: 3,
            explanation: Some("All the animals said 'Not I,' so the hen planted the seeds herself.".to_string()),
        },
        ReadingQuestionData {
            id: 5,
            grade_level: "grade_3_5".to_string(),
            domain: "science".to_string(),
            difficulty: 3,
            passage: "Plants are very important for life on Earth. They take in carbon dioxide from the air and release oxygen. This process is called photosynthesis. Humans and animals need oxygen to breathe. Plants also provide food for many animals.".to_string(),
            question_text: "What gas do plants release during photosynthesis?".to_string(),
            question_type: "multiple_choice".to_string(),
            options: vec!["Carbon dioxide".to_string(), "Nitrogen".to_string(), "Oxygen".to_string(), "Hydrogen".to_string()],
            correct_answer: 2,
            explanation: Some("The passage says plants release oxygen during photosynthesis.".to_string()),
        },
    ]
}

fn get_default_speaking_questions() -> Vec<SpeakingQuestionData> {
    vec![
        SpeakingQuestionData {
            id: 1,
            grade_level: "grade_1_2".to_string(),
            domain: "social_instructional".to_string(),
            difficulty: 1,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this picture and tell me about your family. How many people are in your family? Who are they?".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "There are four people in my family. I have a mother, a father, and a brother. My mother is a teacher. My father works in an office. My brother is younger than me.".to_string(),
            rubric: vec!["Uses complete sentences".to_string(), "Includes number of family members".to_string(), "Names family members".to_string(), "Speaks clearly".to_string()],
        },
        SpeakingQuestionData {
            id: 2,
            grade_level: "grade_1_2".to_string(),
            domain: "social_instructional".to_string(),
            difficulty: 1,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this picture of a park. Tell me what you see in the picture.".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1565109160632-244323ef1b0e?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "I see a big park. There are many trees and flowers. Children are playing on the swings. Some people are sitting on benches. There is a dog running in the grass.".to_string(),
            rubric: vec!["Describes main objects in picture".to_string(), "Uses appropriate vocabulary".to_string(), "Forms complete sentences".to_string(), "Speaks at appropriate pace".to_string()],
        },
        SpeakingQuestionData {
            id: 3,
            grade_level: "grade_1_2".to_string(),
            domain: "mathematics".to_string(),
            difficulty: 2,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at the numbers in this picture. Count from one to twenty. Then tell me which number comes after fifteen.".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "One, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty. The number after fifteen is sixteen.".to_string(),
            rubric: vec!["Counts accurately".to_string(), "Pronounces numbers clearly".to_string(), "Identifies correct number".to_string(), "Completes the task".to_string()],
        },
        SpeakingQuestionData {
            id: 4,
            grade_level: "grade_3_5".to_string(),
            domain: "language_arts".to_string(),
            difficulty: 2,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at these books. Tell me about your favorite book. What is it about? Why do you like it?".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "My favorite book is 'Charlotte's Web.' It is about a pig named Wilbur and his friend Charlotte, who is a spider. Charlotte helps Wilbur by writing words in her web. I like this book because it shows the importance of friendship and kindness.".to_string(),
            rubric: vec!["Names the book".to_string(), "Summarizes the story".to_string(), "Explains personal opinion".to_string(), "Uses descriptive language".to_string()],
        },
        SpeakingQuestionData {
            id: 5,
            grade_level: "grade_3_5".to_string(),
            domain: "science".to_string(),
            difficulty: 3,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this picture showing the water cycle. Explain what happens during the water cycle. Include the words evaporation, condensation, and precipitation in your answer.".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "The water cycle is how water moves around the Earth. First, evaporation happens when the sun heats water and it turns into vapor. Then, condensation occurs when the vapor cools and forms clouds. Finally, precipitation happens when water falls from clouds as rain or snow.".to_string(),
            rubric: vec!["Uses all three vocabulary words correctly".to_string(), "Explains the process in order".to_string(), "Shows understanding of the concept".to_string(), "Uses complete sentences".to_string()],
        },
        SpeakingQuestionData {
            id: 6,
            grade_level: "grade_3_5".to_string(),
            domain: "social_studies".to_string(),
            difficulty: 3,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this picture of a community. Describe your community. What are some important places in your community? What do people do there?".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "My community has many important places. We have a school where children learn. There is a library where people borrow books. The fire station has firefighters who help keep us safe. We also have parks where families play and stores where people buy food and clothes.".to_string(),
            rubric: vec!["Names multiple community places".to_string(), "Describes functions of places".to_string(), "Shows community understanding".to_string(), "Uses varied vocabulary".to_string()],
        },
        SpeakingQuestionData {
            id: 7,
            grade_level: "grade_6_8".to_string(),
            domain: "language_arts".to_string(),
            difficulty: 3,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at these travel destinations. If you could travel to any country in the world, where would you go and why? What would you want to see or do there?".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "I would travel to Japan because I am interested in its culture and technology. I would want to visit Tokyo to see the modern buildings and try Japanese food like sushi. I would also like to see ancient temples and learn about Japanese history.".to_string(),
            rubric: vec!["States clear destination".to_string(), "Provides multiple reasons".to_string(), "Includes specific activities".to_string(), "Uses varied sentence structures".to_string()],
        },
        SpeakingQuestionData {
            id: 8,
            grade_level: "grade_6_8".to_string(),
            domain: "science".to_string(),
            difficulty: 4,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at these energy sources. Explain the difference between renewable and non-renewable energy sources. Give examples of each.".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "Renewable energy sources can be naturally replenished. Examples include solar power from the sun, wind energy from wind turbines, and hydroelectric power from moving water. Non-renewable energy sources cannot be easily replaced once used. Examples include coal, oil, and natural gas, which take millions of years to form.".to_string(),
            rubric: vec!["Defines both types clearly".to_string(), "Provides accurate examples for each".to_string(), "Shows understanding of sustainability".to_string(), "Uses appropriate scientific vocabulary".to_string()],
        },
        SpeakingQuestionData {
            id: 9,
            grade_level: "grade_6_8".to_string(),
            domain: "social_studies".to_string(),
            difficulty: 4,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this picture showing people voting. What is democracy? Explain how it works and why it is important.".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "Democracy is a form of government where citizens have the power to make decisions. In a democracy, people vote to elect leaders who represent them. It is important because it gives everyone a voice in how their country is run. Democratic governments protect individual rights and freedoms, and leaders can be held accountable for their actions.".to_string(),
            rubric: vec!["Defines democracy accurately".to_string(), "Explains the voting process".to_string(), "Discusses importance".to_string(), "Shows understanding of civic concepts".to_string()],
        },
        SpeakingQuestionData {
            id: 10,
            grade_level: "grade_9_12".to_string(),
            domain: "language_arts".to_string(),
            difficulty: 5,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this image showing social media. Do you think social media has a positive or negative effect on society? Support your opinion with specific examples.".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "Social media has both positive and negative effects on society. On the positive side, it allows people to connect with friends and family around the world and gives everyone a platform to share ideas. For example, social media has helped organize important social movements. However, there are negative effects too, such as the spread of misinformation and the impact on mental health. Overall, I believe social media can be positive if used responsibly.".to_string(),
            rubric: vec!["Presents clear opinion".to_string(), "Provides balanced analysis".to_string(), "Uses specific examples".to_string(), "Demonstrates critical thinking".to_string()],
        },
        SpeakingQuestionData {
            id: 11,
            grade_level: "grade_9_12".to_string(),
            domain: "science".to_string(),
            difficulty: 5,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this medical image. Explain how vaccines work to protect the body from diseases. Include information about the immune system in your explanation.".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "Vaccines work by training the immune system to recognize and fight specific diseases. When you receive a vaccine, it contains weakened or inactive parts of a pathogen that cause the disease. The immune system responds by producing antibodies and memory cells. If you later encounter the actual disease, your immune system recognizes it quickly and can fight it off more effectively. This is why vaccines can prevent serious illnesses.".to_string(),
            rubric: vec!["Explains vaccine mechanism".to_string(), "Describes immune system response".to_string(), "Uses accurate scientific terms".to_string(), "Shows comprehensive understanding".to_string()],
        },
        SpeakingQuestionData {
            id: 12,
            grade_level: "grade_9_12".to_string(),
            domain: "social_studies".to_string(),
            difficulty: 5,
            prompt_type: "picture".to_string(),
            prompt_text: "Look at this global connection image. Discuss the causes and effects of globalization. How has it changed the world we live in?".to_string(),
            image_url: Some("https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop".to_string()),
            audio_text: None,
            sample_answer: "Globalization is the increasing interconnectedness of countries through trade, technology, and cultural exchange. Causes include advances in transportation and communication technology. The effects are significant: economies are more connected, with products made in one country sold worldwide. Cultures influence each other, leading to both cultural exchange and concerns about losing traditions. While globalization has created economic opportunities, it has also raised concerns about inequality and environmental impact.".to_string(),
            rubric: vec!["Defines globalization".to_string(), "Identifies multiple causes".to_string(), "Discusses various effects".to_string(), "Shows nuanced understanding".to_string()],
        },
    ]
}

fn get_default_writing_questions() -> Vec<WritingQuestionData> {
    vec![
        WritingQuestionData {
            id: 1,
            grade_level: "grade_1_2".to_string(),
            domain: "social_instructional".to_string(),
            difficulty: 1,
            task_type: "personal_recount".to_string(),
            prompt: "Write about your favorite day of the week. What do you do on that day? Why do you like it?".to_string(),
            image_url: None,
            word_limit_min: 20,
            word_limit_max: 50,
            rubric: vec!["Writes complete sentences".to_string(), "Includes activities".to_string(), "Explains why it is favorite".to_string(), "Uses correct spelling".to_string()],
            sample_answer: Some("My favorite day is Saturday. On Saturday, I don't go to school. I play with my friends in the park. We play soccer and ride bikes. I like Saturday because I can sleep late and have fun all day.".to_string()),
        },
        WritingQuestionData {
            id: 2,
            grade_level: "grade_3_5".to_string(),
            domain: "language_arts".to_string(),
            difficulty: 2,
            task_type: "personal_recount".to_string(),
            prompt: "Write a story about a time when you helped someone. Describe what happened and how you felt.".to_string(),
            image_url: None,
            word_limit_min: 50,
            word_limit_max: 100,
            rubric: vec!["Tells a complete story".to_string(), "Includes feelings and reactions".to_string(), "Uses descriptive language".to_string(), "Has beginning, middle, and end".to_string()],
            sample_answer: Some("Last week, I helped my grandmother carry groceries from the car. She had many heavy bags, and she walks slowly. I ran to help her and carried the heaviest bags into the house. She smiled and thanked me. I felt happy and proud that I could help.".to_string()),
        },
        WritingQuestionData {
            id: 3,
            grade_level: "grade_6_8".to_string(),
            domain: "social_studies".to_string(),
            difficulty: 4,
            task_type: "argumentative".to_string(),
            prompt: "Should students have homework every day? Write an essay stating your opinion and supporting it with reasons and examples.".to_string(),
            image_url: None,
            word_limit_min: 100,
            word_limit_max: 200,
            rubric: vec!["States clear opinion".to_string(), "Provides multiple supporting reasons".to_string(), "Uses examples to support arguments".to_string(), "Organizes essay logically".to_string()],
            sample_answer: Some("I believe students should not have homework every day. First, children need time to rest and play. Second, many students have activities after school. Third, spending time with family is important. A better approach would be to have homework only a few times a week.".to_string()),
        },
    ]
}

// ========== 记忆曲线测试模块 ==========
#[cfg(test)]
mod tests {
    use super::*;
    
    /// 创建测试数据库
    fn create_test_db() -> DatabaseManager {
        let conn = Connection::open_in_memory().unwrap();
        let db = DatabaseManager { conn };
        db.initialize_schema().unwrap();
        db
    }
    
    /// 创建测试文章和分词
    fn setup_test_data(db: &mut DatabaseManager) -> (i64, i64, i64) {
        // 创建文章
        db.create_article("测试文章", "这是一篇测试文章").unwrap();
        
        // 添加分词
        let article_id = 1;
        let segments_vec: Vec<String> = vec![
            "apple".to_string(), "banana".to_string(), "cherry".to_string(),
            "date".to_string(), "elder".to_string()
        ];
        db.save_segments(article_id, "word", &segments_vec).unwrap();
        
        // 获取分词 ID（按 order_index 排序）
        let segments = db.get_segments(article_id, "word").unwrap();
        assert_eq!(segments.len(), 5);
        
        (article_id, segments[0].id, segments[1].id)
    }
    
    /// 测试 1: 新单词答对 → 熟练度变为 1，间隔 1 天
    #[test]
    fn test_new_word_correct() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 答对新单词
        let result = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        
        assert_eq!(result.mastery_level, 1);
        assert_eq!(result.interval_days, 1);
        assert_eq!(result.review_count, 1);
    }
    
    /// 测试 2: 新单词答错 → 熟练度保持 0，间隔 0 天
    #[test]
    fn test_new_word_incorrect() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 答错新单词
        let result = db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        
        assert_eq!(result.mastery_level, 0);
        assert_eq!(result.interval_days, 0);
        assert_eq!(result.review_count, 0);
    }
    
    /// 测试 3: 已学习单词答对 → 熟练度 +1
    #[test]
    fn test_existing_word_correct() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 先答对，熟练度变为 1
        db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        
        // 再次答对，熟练度变为 2
        let result = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        
        assert_eq!(result.mastery_level, 2);
        assert_eq!(result.interval_days, 3); // 熟练度 2 → 间隔 3 天
    }
    
    /// 测试 4: 已学习单词答错 → 熟练度 -1，间隔重置
    #[test]
    fn test_existing_word_incorrect() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 先答对，熟练度变为 1
        db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        
        // 答错，熟练度变为 0
        let result = db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        
        assert_eq!(result.mastery_level, 0);
        assert_eq!(result.interval_days, 0); // 立即需要复习
    }
    
    /// 测试 5: 熟练度达到 5 后答对 → 保持 5，间隔 30 天
    #[test]
    fn test_max_mastery_level() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 连续答对 5 次，达到熟练度 5
        for _ in 0..5 {
            db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        }
        
        // 第 6 次答对，应该保持熟练度 5
        let result = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        
        assert_eq!(result.mastery_level, 5);
        assert_eq!(result.interval_days, 30); // 熟练度 5 → 间隔 30 天
    }
    
    /// 测试 6: 熟练度为 0 后答错 → 保持 0
    #[test]
    fn test_min_mastery_level() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 答错，熟练度为 0
        db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        
        // 再次答错，应该保持 0
        let result = db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        
        assert_eq!(result.mastery_level, 0);
    }
    
    /// 测试 7: 文章没有分词 → 返回空
    #[test]
    fn test_no_segments() {
        let db = create_test_db();
        let _ = db.create_article("空文章", "内容").unwrap();
        
        let result = db.get_scheduled_words("default", 1, "word", 10).unwrap();
        
        assert!(result.words.is_empty());
        assert_eq!(result.new_words_count, 0);
        assert_eq!(result.review_words_count, 0);
    }
    
    /// 测试 8: 只有新词 → 返回新词
    #[test]
    fn test_only_new_words() {
        let mut db = create_test_db();
        let (article_id, _, _) = setup_test_data(&mut db);
        
        let result = db.get_scheduled_words("default", article_id, "word", 10).unwrap();
        
        assert_eq!(result.words.len(), 5);
        assert_eq!(result.new_words_count, 5);
        assert_eq!(result.review_words_count, 0);
        
        // 所有都是新词
        for word in &result.words {
            assert!(word.is_new);
            assert_eq!(word.mastery_level, 0);
        }
    }
    
    /// 测试 9: 到期复习词优先于新词
    #[test]
    fn test_review_words_first() {
        let mut db = create_test_db();
        let (article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 让第一个单词到期（答错，interval=0）
        db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        
        let result = db.get_scheduled_words("default", article_id, "word", 5).unwrap();
        
        // 到期的复习词应该排在前面
        assert_eq!(result.words.len(), 5);
        assert_eq!(result.review_words_count, 1);
        assert_eq!(result.new_words_count, 4);
        
        // 第一个应该是已复习的 apple
        assert_eq!(result.words[0].content, "apple");
        assert!(!result.words[0].is_new);
    }
    
    /// 测试 10: 复习词数量超过 limit → 只返回 limit 个
    #[test]
    fn test_review_words_exceed_limit() {
        let mut db = create_test_db();
        let (article_id, segment_id1, segment_id2) = setup_test_data(&mut db);
        
        // 让两个单词都到期
        db.update_word_mastery("default", segment_id1, "apple", "word", false).unwrap();
        db.update_word_mastery("default", segment_id2, "banana", "word", false).unwrap();
        
        // limit = 1
        let result = db.get_scheduled_words("default", article_id, "word", 1).unwrap();
        
        assert_eq!(result.words.len(), 1);
        assert_eq!(result.review_words_count, 1);
    }
    
    /// 测试 11: 复习词不足 limit → 补充新词
    #[test]
    fn test_review_words_insufficient() {
        let mut db = create_test_db();
        let (article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 让一个单词到期
        db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        
        // limit = 5，复习词只有 1 个，需要补充 4 个新词
        let result = db.get_scheduled_words("default", article_id, "word", 5).unwrap();
        
        assert_eq!(result.words.len(), 5);
        assert_eq!(result.review_words_count, 1);
        assert_eq!(result.new_words_count, 4);
    }
    
    /// 测试 12: 按熟练度排序 → 低的优先
    #[test]
    fn test_sort_by_mastery_level() {
        let mut db = create_test_db();
        let (article_id, segment_id1, segment_id2) = setup_test_data(&mut db);
        
        // apple 熟练度 2
        db.update_word_mastery("default", segment_id1, "apple", "word", true).unwrap(); // 1
        db.update_word_mastery("default", segment_id1, "apple", "word", true).unwrap(); // 2
        
        // banana 熟练度 1
        db.update_word_mastery("default", segment_id2, "banana", "word", true).unwrap(); // 1
        
        // 让两个都到期
        db.update_word_mastery("default", segment_id1, "apple", "word", false).unwrap();
        db.update_word_mastery("default", segment_id2, "banana", "word", false).unwrap();
        
        let result = db.get_scheduled_words("default", article_id, "word", 5).unwrap();
        
        // 熟练度低的应该排在前面
        assert_eq!(result.words[0].content, "banana"); // 熟练度 1
        assert_eq!(result.words[1].content, "apple");  // 熟练度 2
    }
    
    /// 测试 13: 重新分词后保留记忆曲线数据
    #[test]
    fn test_resegment_preserves_mastery() {
        let mut db = create_test_db();
        let (article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 答错 apple（interval=0，当天到期）
        db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        
        // 验证 apple 已学习（因为答错，当天到期）
        let result1 = db.get_scheduled_words("default", article_id, "word", 10).unwrap();
        
        // 找到 apple
        let apple_before = result1.words.iter().find(|w| w.content == "apple");
        assert!(apple_before.is_some(), "apple should exist before resegment");
        assert!(!apple_before.unwrap().is_new, "apple should not be new");
        
        // 重新分词：添加一个新词，保持原有词
        let new_segments: Vec<String> = vec![
            "apple".to_string(), "banana".to_string(), "new_word".to_string()
        ];
        db.save_segments(article_id, "word", &new_segments).unwrap();
        
        // 检查分词是否正确插入
        let segments = db.get_segments(article_id, "word").unwrap();
        assert_eq!(segments.len(), 3, "Expected 3 segments, got {}", segments.len());
        
        // 检查 apple 的熟练度是否保留
        let result = db.get_scheduled_words("default", article_id, "word", 10).unwrap();
        
        // apple 应该是已学习的
        let apple = result.words.iter().find(|w| w.content == "apple");
        assert!(apple.is_some(), "apple should exist in scheduled words");
        let apple = apple.unwrap();
        assert!(!apple.is_new, "apple should not be new after resegment");
        
        // new_word 应该是新的
        let new_word = result.words.iter().find(|w| w.content == "new_word").unwrap();
        assert!(new_word.is_new);
    }
    
    /// 测试 14: 难度因子调整
    #[test]
    fn test_ease_factor() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 第一次答对 → ease_factor 保持 2.5（初始值）
        let result1 = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        assert_eq!(result1.ease_factor, 2.5);
        
        // 第二次答对 → ease_factor 增加
        let result2 = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        assert!(result2.ease_factor > 2.5);
        
        // 答错 → ease_factor 减少
        let result3 = db.update_word_mastery("default", segment_id, "apple", "word", false).unwrap();
        assert!(result3.ease_factor < result2.ease_factor);
        
        // ease_factor 应该在 1.3 ~ 3.0 范围内
        assert!(result3.ease_factor >= 1.3);
    }
    
    /// 测试 15: 间隔天数正确计算
    #[test]
    fn test_interval_days() {
        let mut db = create_test_db();
        let (_article_id, segment_id, _) = setup_test_data(&mut db);
        
        // 熟练度 0 → 间隔 1 天
        db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        let r1 = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        assert_eq!(r1.interval_days, 3); // 熟练度 2
        
        let r2 = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        assert_eq!(r2.interval_days, 7); // 熟练度 3
        
        let r3 = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        assert_eq!(r3.interval_days, 14); // 熟练度 4
        
        let r4 = db.update_word_mastery("default", segment_id, "apple", "word", true).unwrap();
        assert_eq!(r4.interval_days, 30); // 熟练度 5
    }
}
