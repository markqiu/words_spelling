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
