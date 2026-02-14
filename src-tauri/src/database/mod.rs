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
}
