import type { Article, PracticeRecord, CrawledArticle, LeaderboardEntry, MistakeWord, ArticleWordProgress } from '../types'

export interface ElectronAPI {
  // 数据库操作
  getArticles: (category?: string) => Promise<Article[]>
  getArticleById: (id: number) => Promise<Article | null>
  addArticle: (article: Article) => Promise<number>
  deleteArticle: (id: number) => Promise<boolean>
  updateArticle: (article: Article) => Promise<boolean>

  // 练习记录
  savePracticeRecord: (record: PracticeRecord) => Promise<number>
  getPracticeRecords: (userName: string) => Promise<PracticeRecord[]>
  getLeaderboard: () => Promise<LeaderboardEntry[]>

  // 错词本
  getMistakeWords: (userName: string) => Promise<MistakeWord[]>
  addMistakeWord: (userName: string, word: string, articleId?: number) => Promise<void>
  removeMistakeWord: (userName: string, word: string) => Promise<boolean>
  isMistakeWord: (userName: string, word: string) => Promise<boolean>

  // 文章词汇掌握状态
  getArticleWordProgress: (userName: string, articleId: number) => Promise<ArticleWordProgress[]>
  updateWordProgress: (userName: string, articleId: number, word: string, mastered: boolean) => Promise<void>
  getWordsToPractice: (userName: string, articleId: number, allWords: string[]) => Promise<string[]>

  // 爬虫
  fetchArticles: (category: string, customUrl?: string) => Promise<CrawledArticle[]>

  // 对话框
  importArticle: () => Promise<string | null>

  // 应用初始化
  initializeDefaultArticles: () => Promise<boolean>

  // TTS 语音合成
  speak: (text: string) => Promise<boolean>
  stopSpeaking: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
