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
        // 先删除旧的分词
        self.conn.execute(
            "DELETE FROM segments WHERE article_id = ? AND segment_type = ?",
            [article_id.to_string(), segment_type.to_string()],
        )?;

        // 插入新的分词
        let tx = self.conn.transaction()?;
        for (index, segment) in segments.iter().enumerate() {
            tx.execute(
                "INSERT INTO segments (article_id, segment_type, content, order_index) VALUES (?, ?, ?, ?)",
                [article_id.to_string(), segment_type.to_string(), segment.clone(), index.to_string()],
            )?;
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
        
        for (segment_id, content, seg_type) in &all_segments {
            if let Some((mastery_level, next_review_at)) = mastery_map.get(segment_id) {
                // 已学习过的，检查是否到期
                if *next_review_at <= now || mastery_level < &3 {
                    // 到期或熟练度较低，纳入复习
                    review_words.push(crate::models::ScheduledWord {
                        segment_id: *segment_id,
                        content: content.clone(),
                        segment_type: seg_type.clone(),
                        mastery_level: *mastery_level,
                        is_new: false,
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
                });
            }
        }
        
        // 4. 合并：复习单词优先，新单词填充剩余位置
        // 按熟练度从低到高排序（越生疏越前面）
        review_words.sort_by_key(|w| w.mastery_level);
        
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
        
        // 随机打乱顺序
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        std::time::SystemTime::now().hash(&mut hasher);
        let seed = hasher.finish();
        let result_len = result.len();
        result.sort_by(move |_, _| {
            let a: u64 = (seed.wrapping_mul(31).wrapping_add(result_len as u64)) % 100;
            let b: u64 = (seed.wrapping_mul(37).wrapping_add(result_len as u64)) % 100;
            a.cmp(&b)
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
}
