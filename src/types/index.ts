// 文章分类
export type ArticleCategory = 
  | 'novel'       // 小说
  | 'news'        // 新闻
  | 'story'       // 故事
  | 'biography'   // 传记
  | 'technical'   // 专业文章
  | 'other'       // 其他

// 文章
export interface Article {
  id?: number
  title: string
  content: string
  category: ArticleCategory
  difficulty: 'easy' | 'medium' | 'hard'
  wordCount: number
  source: string
  createdAt?: string
}

// 练习记录
export interface PracticeRecord {
  id?: number
  userName: string
  articleId: number
  articleTitle: string
  mode: 'spelling' | 'typing'
  accuracy: number
  wpm: number
  duration: number // 秒
  score: number
  createdAt?: string
}

// 爬取的文章（待入库）
export interface CrawledArticle {
  title: string
  content: string
  category: ArticleCategory
  wordCount: number
  source: string
  selected?: boolean
}

// 键盘布局配置
export interface KeyConfig {
  code: string
  label: string
  finger: 'left-pinky' | 'left-ring' | 'left-middle' | 'left-index' | 'thumb' | 'right-index' | 'right-middle' | 'right-ring' | 'right-pinky'
  row: number
  col: number
}

// 练习统计
export interface PracticeStats {
  totalChars: number
  correctChars: number
  errors: number
  startTime: number
  endTime?: number
}

// 排行榜条目
export interface LeaderboardEntry {
  userName: string
  totalScore: number
  totalPractices: number
  avgAccuracy: number
  avgWpm: number
}

// 错词本条目
export interface MistakeWord {
  id?: number
  userName: string
  word: string
  errorCount: number
  articleIds: string // JSON 字符串存储相关文章ID数组
  createdAt?: string
  lastPracticedAt?: string
}

// 文章内词汇掌握状态
export interface ArticleWordProgress {
  id?: number
  userName: string
  articleId: number
  word: string
  mastered: boolean // true = 已掌握，false = 未掌握/出错过
  errorCount: number
  practicedAt?: string
}
