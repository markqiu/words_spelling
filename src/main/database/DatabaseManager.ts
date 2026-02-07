import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import type { Article, PracticeRecord, LeaderboardEntry, ArticleCategory, MistakeWord, ArticleWordProgress } from '../../types'

export class DatabaseManager {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'spelling-game.db')

    // 确保目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }

    // 升级前备份数据库
    this.backupDatabase()
  }

  // 升级前备份数据库
  private backupDatabase(): void {
    if (!fs.existsSync(this.dbPath)) return

    const backupPath = `${this.dbPath}.backup.${Date.now()}`
    try {
      fs.copyFileSync(this.dbPath, backupPath)
      console.log(`Database backed up to: ${backupPath}`)

      // 只保留最近 5 个备份
      this.cleanupOldBackups()
    } catch (error) {
      console.error('Database backup failed:', error)
    }
  }

  // 清理旧的数据库备份（只保留最近 5 个）
  private cleanupOldBackups(): void {
    const userDataPath = path.dirname(this.dbPath)
    const dbName = path.basename(this.dbPath)

    try {
      const backups = fs.readdirSync(userDataPath)
        .filter(file => file.startsWith(`${dbName}.backup.`))
        .map(file => ({
          name: file,
          path: path.join(userDataPath, file),
          time: fs.statSync(path.join(userDataPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      // 删除超过 5 个的备份
      if (backups.length > 5) {
        backups.slice(5).forEach(backup => {
          try {
            fs.unlinkSync(backup.path)
            console.log(`Deleted old backup: ${backup.name}`)
          } catch (error) {
            console.error(`Failed to delete backup ${backup.name}:`, error)
          }
        })
      }
    } catch (error) {
      console.error('Cleanup old backups failed:', error)
    }
  }

  initialize() {
    this.db = new Database(this.dbPath)
    this.createTables()
    this.migrate()
  }

  // 获取数据库版本
  private getDbVersion(): number {
    if (!this.db) return 0

    try {
      // 检查是否有版本表
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='db_version'
      `).get()

      if (!tableExists) {
        // 创建版本表
        this.db.exec(`
          CREATE TABLE db_version (
            version INTEGER PRIMARY KEY DEFAULT 1
          )
        `)
        this.db.prepare(`INSERT INTO db_version (version) VALUES (1)`).run()
        return 1
      }

      const row = this.db.prepare(`SELECT version FROM db_version`).get() as { version: number } | undefined
      return row?.version || 1
    } catch {
      return 1
    }
  }

  // 设置数据库版本
  private setDbVersion(version: number): void {
    if (!this.db) return

    this.db.prepare(`UPDATE db_version SET version = ?`).run(version)
  }

  // 数据库迁移
  private migrate(): void {
    const currentVersion = this.getDbVersion()
    console.log(`Database version: ${currentVersion}`)

    // 版本 2: 添加练习进度表（在 createTables 中已经通过 IF NOT EXISTS 创建了）
    if (currentVersion < 2) {
      console.log('Migrating to version 2...')
      // practice_progress 表已经在 createTables 中创建
      this.setDbVersion(2)
    }

    // 未来版本迁移在这里添加
    // if (currentVersion < 3) { ... }
  }

  private createTables() {
    if (!this.db) return

    // 文章表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL DEFAULT 'medium',
        word_count INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'custom',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 练习记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS practice_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        article_id INTEGER NOT NULL,
        article_title TEXT NOT NULL,
        mode TEXT NOT NULL,
        accuracy REAL NOT NULL,
        wpm INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id)
      )
    `)

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
      CREATE INDEX IF NOT EXISTS idx_practice_user ON practice_records(user_name);
      CREATE INDEX IF NOT EXISTS idx_practice_score ON practice_records(score DESC);
    `)

    // 错词本表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mistake_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        word TEXT NOT NULL,
        error_count INTEGER NOT NULL DEFAULT 1,
        article_ids TEXT, -- JSON 数组存储相关文章ID
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_practiced_at DATETIME,
        UNIQUE(user_name, word)
      )
    `)

    // 文章词汇掌握状态表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS article_word_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        article_id INTEGER NOT NULL,
        word TEXT NOT NULL,
        mastered INTEGER NOT NULL DEFAULT 0, -- 0=false, 1=true
        error_count INTEGER NOT NULL DEFAULT 0,
        practiced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_name, article_id, word)
      )
    `)

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mistake_user ON mistake_words(user_name);
      CREATE INDEX IF NOT EXISTS idx_word_progress_user ON article_word_progress(user_name);
      CREATE INDEX IF NOT EXISTS idx_word_progress_article ON article_word_progress(article_id);
    `)

    // 练习进度表（保存未完成的练习）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS practice_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        article_id INTEGER NOT NULL,
        current_index INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        incorrect_count INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER NOT NULL DEFAULT 50,
        practice_mode TEXT NOT NULL DEFAULT 'all',
        words_list TEXT, -- JSON 数组存储单词列表（用于错题本模式）
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_name, article_id)
      )
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_practice_progress_user ON practice_progress(user_name);
    `)
  }

  // 获取文章列表
  getArticles(category?: string): Article[] {
    if (!this.db) return []
    
    let sql = 'SELECT * FROM articles ORDER BY created_at DESC'
    const params: string[] = []
    
    if (category && category !== 'all') {
      sql = 'SELECT * FROM articles WHERE category = ? ORDER BY created_at DESC'
      params.push(category)
    }
    
    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as Record<string, unknown>[]
    
    return rows.map(row => ({
      id: row.id as number,
      title: row.title as string,
      content: row.content as string,
      category: row.category as ArticleCategory,
      difficulty: row.difficulty as 'easy' | 'medium' | 'hard',
      wordCount: row.word_count as number,
      source: row.source as string,
      createdAt: row.created_at as string
    }))
  }

  // 根据ID获取文章
  getArticleById(id: number): Article | null {
    if (!this.db) return null
    
    const stmt = this.db.prepare('SELECT * FROM articles WHERE id = ?')
    const row = stmt.get(id) as Record<string, unknown> | undefined
    
    if (!row) return null
    
    return {
      id: row.id as number,
      title: row.title as string,
      content: row.content as string,
      category: row.category as ArticleCategory,
      difficulty: row.difficulty as 'easy' | 'medium' | 'hard',
      wordCount: row.word_count as number,
      source: row.source as string,
      createdAt: row.created_at as string
    }
  }

  // 添加文章
  addArticle(article: Article): number {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare(`
      INSERT INTO articles (title, content, category, difficulty, word_count, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      article.title,
      article.content,
      article.category,
      article.difficulty,
      article.wordCount,
      article.source
    )
    
    return Number(result.lastInsertRowid)
  }

  // 批量添加文章
  addArticles(articles: Article[]): number[] {
    if (!this.db) throw new Error('Database not initialized')
    
    const ids: number[] = []
    const insert = this.db.prepare(`
      INSERT INTO articles (title, content, category, difficulty, word_count, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const insertMany = this.db.transaction((articles: Article[]) => {
      for (const article of articles) {
        const result = insert.run(
          article.title,
          article.content,
          article.category,
          article.difficulty,
          article.wordCount,
          article.source
        )
        ids.push(Number(result.lastInsertRowid))
      }
    })
    
    insertMany(articles)
    return ids
  }

  // 删除文章
  deleteArticle(id: number): boolean {
    if (!this.db) return false
    
    const stmt = this.db.prepare('DELETE FROM articles WHERE id = ?')
    const result = stmt.run(id)
    
    return result.changes > 0
  }

  // 更新文章
  updateArticle(article: Article): boolean {
    if (!this.db || !article.id) return false
    
    const stmt = this.db.prepare(`
      UPDATE articles 
      SET title = ?, content = ?, category = ?, difficulty = ?, word_count = ?, source = ?
      WHERE id = ?
    `)
    
    const result = stmt.run(
      article.title,
      article.content,
      article.category,
      article.difficulty,
      article.wordCount,
      article.source,
      article.id
    )
    
    return result.changes > 0
  }

  // 保存练习记录
  savePracticeRecord(record: PracticeRecord): number {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare(`
      INSERT INTO practice_records 
      (user_name, article_id, article_title, mode, accuracy, wpm, duration, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      record.userName,
      record.articleId,
      record.articleTitle,
      record.mode,
      record.accuracy,
      record.wpm,
      record.duration,
      record.score
    )
    
    return Number(result.lastInsertRowid)
  }

  // 获取用户练习记录
  getPracticeRecords(userName: string): PracticeRecord[] {
    if (!this.db) return []
    
    const stmt = this.db.prepare(`
      SELECT * FROM practice_records 
      WHERE user_name = ? 
      ORDER BY created_at DESC
    `)
    
    const rows = stmt.all(userName) as Record<string, unknown>[]
    
    return rows.map(row => ({
      id: row.id as number,
      userName: row.user_name as string,
      articleId: row.article_id as number,
      articleTitle: row.article_title as string,
      mode: row.mode as 'spelling' | 'typing',
      accuracy: row.accuracy as number,
      wpm: row.wpm as number,
      duration: row.duration as number,
      score: row.score as number,
      createdAt: row.created_at as string
    }))
  }

  // 获取排行榜
  getLeaderboard(limit: number = 100): LeaderboardEntry[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT 
        user_name,
        SUM(score) as total_score,
        COUNT(*) as total_practices,
        AVG(accuracy) as avg_accuracy,
        AVG(wpm) as avg_wpm
      FROM practice_records
      GROUP BY user_name
      ORDER BY total_score DESC
      LIMIT ?
    `)

    const rows = stmt.all(limit) as Record<string, unknown>[]

    return rows.map(row => ({
      userName: row.user_name as string,
      totalScore: row.total_score as number,
      totalPractices: row.total_practices as number,
      avgAccuracy: Math.round((row.avg_accuracy as number) * 100) / 100,
      avgWpm: Math.round(row.avg_wpm as number)
    }))
  }

  // 检查是否有文章
  hasArticles(): boolean {
    if (!this.db) return false
    
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM articles')
    const row = stmt.get() as { count: number }
    
    return row.count > 0
  }

  // 初始化默认文章
  initializeDefaultArticles(): boolean {
    if (!this.db) return false
    
    // 检查是否已有文章
    if (this.hasArticles()) {
      return false
    }

    const defaultArticles: Article[] = [
      {
        title: 'The Old Man and the Sea - Excerpt',
        content: `He was an old man who fished alone in a skiff in the Gulf Stream and he had gone eighty-four days now without taking a fish. In the first forty days a boy had been with him. But after forty days without a fish the boy's parents had told him that the old man was now definitely and finally salao, which is the worst form of unlucky, and the boy had gone at their orders in another boat which caught three good fish the first week. It made the boy sad to see the old man come in each day with his skiff empty and he always went down to help him carry either the coiled lines or the gaff and harpoon and the sail that was furled around the mast. The sail was patched with flour sacks and, furled, it looked like the flag of permanent defeat.`,
        category: 'novel',
        difficulty: 'medium',
        wordCount: 142,
        source: 'preset'
      },
      {
        title: 'The Benefits of Reading',
        content: `Reading is one of the most important skills a person can learn. It opens doors to new worlds, ideas, and perspectives. When you read regularly, you expand your vocabulary and improve your communication skills. Reading also helps reduce stress and can be a great way to relax after a long day. Many successful people attribute their achievements to being avid readers. Whether you prefer fiction or non-fiction, books have the power to transform your life. Make reading a daily habit, even if it's just for fifteen minutes. Your mind will thank you for it.`,
        category: 'technical',
        difficulty: 'easy',
        wordCount: 98,
        source: 'preset'
      },
      {
        title: 'A Short Story: The Lost Key',
        content: `Sarah woke up to a beautiful sunny morning. She had an important meeting at nine o'clock and needed to leave early. She went to grab her car keys from the usual spot on the kitchen counter, but they weren't there. Panic started to set in as she searched everywhere - under the couch, in her coat pockets, even in the refrigerator. Just as she was about to call a taxi, she felt something in her back pocket. The keys had been there the entire time. She laughed at herself and headed out the door, learning to always check her pockets first.`,
        category: 'story',
        difficulty: 'easy',
        wordCount: 107,
        source: 'preset'
      },
      {
        title: 'Steve Jobs: A Visionary Leader',
        content: `Steve Jobs was one of the most influential figures in the technology industry. Born in 1955 and adopted by a family in California, he showed an early interest in electronics. In 1976, he co-founded Apple Computer with Steve Wozniak in his parents' garage. The company revolutionized personal computing with the Apple II and Macintosh. After leaving Apple in 1985, Jobs founded NeXT and purchased Pixar, which would later produce groundbreaking animated films. He returned to Apple in 1997 and led the company to unprecedented success with products like the iPod, iPhone, and iPad. His attention to design and user experience changed how we interact with technology.`,
        category: 'biography',
        difficulty: 'medium',
        wordCount: 118,
        source: 'preset'
      },
      {
        title: 'Climate Change: A Global Challenge',
        content: `Climate change represents one of the most pressing issues facing humanity today. Rising global temperatures, caused primarily by greenhouse gas emissions from human activities, are leading to melting ice caps, rising sea levels, and more extreme weather events. Scientists worldwide agree that immediate action is necessary to limit warming to 1.5 degrees Celsius above pre-industrial levels. This requires transitioning to renewable energy sources, improving energy efficiency, and protecting natural carbon sinks like forests. While governments and corporations must lead the way, individual choices also matter. Every step toward sustainability helps secure a better future for generations to come.`,
        category: 'news',
        difficulty: 'hard',
        wordCount: 112,
        source: 'preset'
      }
    ]

    this.addArticles(defaultArticles)
    return true
  }

  // ========== 错词本相关操作 ==========

  // 获取用户的错词本
  getMistakeWords(userName: string): MistakeWord[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM mistake_words 
      WHERE user_name = ? 
      ORDER BY error_count DESC, last_practiced_at DESC
    `)

    const rows = stmt.all(userName) as Record<string, unknown>[]

    return rows.map(row => ({
      id: row.id as number,
      userName: row.user_name as string,
      word: row.word as string,
      errorCount: row.error_count as number,
      articleIds: row.article_ids as string,
      createdAt: row.created_at as string,
      lastPracticedAt: row.last_practiced_at as string | undefined
    }))
  }

  // 添加错词（如果已存在则增加错误次数）
  addMistakeWord(userName: string, word: string, articleId?: number): void {
    if (!this.db) throw new Error('Database not initialized')

    // 先检查是否已存在
    const checkStmt = this.db.prepare(`
      SELECT id, error_count, article_ids FROM mistake_words 
      WHERE user_name = ? AND word = ?
    `)
    const existing = checkStmt.get(userName, word) as { id: number; error_count: number; article_ids: string } | undefined

    if (existing) {
      // 更新错误次数和相关文章
      const articleIds = existing.article_ids ? JSON.parse(existing.article_ids) as number[] : []
      if (articleId && !articleIds.includes(articleId)) {
        articleIds.push(articleId)
      }

      const updateStmt = this.db.prepare(`
        UPDATE mistake_words 
        SET error_count = error_count + 1, 
            article_ids = ?,
            last_practiced_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      updateStmt.run(JSON.stringify(articleIds), existing.id)
    } else {
      // 新增错词
      const articleIds = articleId ? [articleId] : []
      const insertStmt = this.db.prepare(`
        INSERT INTO mistake_words (user_name, word, error_count, article_ids, last_practiced_at)
        VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
      `)
      insertStmt.run(userName, word, JSON.stringify(articleIds))
    }
  }

  // 从错词本移除
  removeMistakeWord(userName: string, word: string): boolean {
    if (!this.db) return false

    const stmt = this.db.prepare(`
      DELETE FROM mistake_words 
      WHERE user_name = ? AND word = ?
    `)
    const result = stmt.run(userName, word)
    return result.changes > 0
  }

  // 检查是否存在于错词本
  isMistakeWord(userName: string, word: string): boolean {
    if (!this.db) return false

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM mistake_words 
      WHERE user_name = ? AND word = ?
    `)
    const row = stmt.get(userName, word) as { count: number }
    return row.count > 0
  }

  // ========== 文章词汇掌握状态操作 ==========

  // 获取文章词汇掌握状态
  getArticleWordProgress(userName: string, articleId: number): ArticleWordProgress[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM article_word_progress 
      WHERE user_name = ? AND article_id = ?
    `)

    const rows = stmt.all(userName, articleId) as Record<string, unknown>[]

    return rows.map(row => ({
      id: row.id as number,
      userName: row.user_name as string,
      articleId: row.article_id as number,
      word: row.word as string,
      mastered: (row.mastered as number) === 1,
      errorCount: row.error_count as number,
      practicedAt: row.practiced_at as string | undefined
    }))
  }

  // 更新词汇掌握状态
  updateWordProgress(userName: string, articleId: number, word: string, mastered: boolean): void {
    if (!this.db) throw new Error('Database not initialized')

    const checkStmt = this.db.prepare(`
      SELECT id, error_count FROM article_word_progress 
      WHERE user_name = ? AND article_id = ? AND word = ?
    `)
    const existing = checkStmt.get(userName, articleId, word) as { id: number; error_count: number } | undefined

    if (existing) {
      // 更新
      const errorCount = mastered ? existing.error_count : existing.error_count + 1
      const updateStmt = this.db.prepare(`
        UPDATE article_word_progress 
        SET mastered = ?, error_count = ?, practiced_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      updateStmt.run(mastered ? 1 : 0, errorCount, existing.id)
    } else {
      // 新增
      const errorCount = mastered ? 0 : 1
      const insertStmt = this.db.prepare(`
        INSERT INTO article_word_progress (user_name, article_id, word, mastered, error_count)
        VALUES (?, ?, ?, ?, ?)
      `)
      insertStmt.run(userName, articleId, word, mastered ? 1 : 0, errorCount)
    }
  }

  // ========== 练习进度保存（继续练习功能）==========

  // 保存练习进度
  savePracticeProgress(
    userName: string,
    articleId: number,
    progress: {
      currentIndex: number
      correctCount: number
      incorrectCount: number
      wordCount: number
      practiceMode: string
      wordsList?: string[]
    }
  ): void {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      INSERT INTO practice_progress 
        (user_name, article_id, current_index, correct_count, incorrect_count, word_count, practice_mode, words_list, updated_at)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_name, article_id) DO UPDATE SET
        current_index = excluded.current_index,
        correct_count = excluded.correct_count,
        incorrect_count = excluded.incorrect_count,
        word_count = excluded.word_count,
        practice_mode = excluded.practice_mode,
        words_list = excluded.words_list,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(
      userName,
      articleId,
      progress.currentIndex,
      progress.correctCount,
      progress.incorrectCount,
      progress.wordCount,
      progress.practiceMode,
      progress.wordsList ? JSON.stringify(progress.wordsList) : null
    )
  }

  // 获取练习进度
  getPracticeProgress(userName: string, articleId: number): {
    currentIndex: number
    correctCount: number
    incorrectCount: number
    wordCount: number
    practiceMode: string
    wordsList?: string[]
  } | null {
    if (!this.db) return null

    const stmt = this.db.prepare(`
      SELECT * FROM practice_progress 
      WHERE user_name = ? AND article_id = ?
    `)

    const row = stmt.get(userName, articleId) as {
      current_index: number
      correct_count: number
      incorrect_count: number
      word_count: number
      practice_mode: string
      words_list: string | null
    } | undefined

    if (!row) return null

    return {
      currentIndex: row.current_index,
      correctCount: row.correct_count,
      incorrectCount: row.incorrect_count,
      wordCount: row.word_count,
      practiceMode: row.practice_mode,
      wordsList: row.words_list ? JSON.parse(row.words_list) as string[] : undefined
    }
  }

  // 清除练习进度
  clearPracticeProgress(userName: string, articleId: number): void {
    if (!this.db) return

    const stmt = this.db.prepare(`
      DELETE FROM practice_progress 
      WHERE user_name = ? AND article_id = ?
    `)

    stmt.run(userName, articleId)
  }

  // 获取需要练习的词汇列表（错词 + 未掌握的词汇）
  getWordsToPractice(userName: string, articleId: number, allWords: string[]): string[] {
    if (!this.db) return allWords

    // 1. 获取错词本中的所有词（这些词无论如何都要练习）
    const mistakeWords = this.getMistakeWords(userName).map(mw => mw.word.toLowerCase())

    // 2. 获取文章中已掌握的词汇
    const progress = this.getArticleWordProgress(userName, articleId)
    const masteredWords = new Set(
      progress.filter(p => p.mastered).map(p => p.word.toLowerCase())
    )

    // 3. 从文章中找出未掌握的词汇
    const unmasteredWords = allWords.filter(word => !masteredWords.has(word.toLowerCase()))

    // 4. 合并错词和未掌握的词（去重）
    const practiceSet = new Set([...mistakeWords, ...unmasteredWords])

    // 5. 保持原始顺序
    return allWords.filter(word => practiceSet.has(word.toLowerCase()))
  }

  // 关闭数据库
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
