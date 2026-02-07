import { contextBridge, ipcRenderer } from 'electron'
import type { Article, PracticeRecord } from '../types'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库操作
  getArticles: (category?: string) => ipcRenderer.invoke('db:getArticles', category),
  getArticleById: (id: number) => ipcRenderer.invoke('db:getArticleById', id),
  addArticle: (article: Article) => ipcRenderer.invoke('db:addArticle', article),
  deleteArticle: (id: number) => ipcRenderer.invoke('db:deleteArticle', id),
  updateArticle: (article: Article) => ipcRenderer.invoke('db:updateArticle', article),

  // 练习记录
  savePracticeRecord: (record: PracticeRecord) => ipcRenderer.invoke('db:savePracticeRecord', record),
  getPracticeRecords: (userName: string) => ipcRenderer.invoke('db:getPracticeRecords', userName),
  getLeaderboard: () => ipcRenderer.invoke('db:getLeaderboard'),

  // 错词本
  getMistakeWords: (userName: string) => ipcRenderer.invoke('db:getMistakeWords', userName),
  addMistakeWord: (userName: string, word: string, articleId?: number) => ipcRenderer.invoke('db:addMistakeWord', userName, word, articleId),
  removeMistakeWord: (userName: string, word: string) => ipcRenderer.invoke('db:removeMistakeWord', userName, word),
  isMistakeWord: (userName: string, word: string) => ipcRenderer.invoke('db:isMistakeWord', userName, word),

  // 文章词汇掌握状态
  getArticleWordProgress: (userName: string, articleId: number) => ipcRenderer.invoke('db:getArticleWordProgress', userName, articleId),
  updateWordProgress: (userName: string, articleId: number, word: string, mastered: boolean) => ipcRenderer.invoke('db:updateWordProgress', userName, articleId, word, mastered),
  getWordsToPractice: (userName: string, articleId: number, allWords: string[]) => ipcRenderer.invoke('db:getWordsToPractice', userName, articleId, allWords),

  // 练习进度（继续练习功能）
  savePracticeProgress: (userName: string, articleId: number, progress: { currentIndex: number, correctCount: number, incorrectCount: number, wordCount: number, practiceMode: string, wordsList?: string[] }) => ipcRenderer.invoke('db:savePracticeProgress', userName, articleId, progress),
  getPracticeProgress: (userName: string, articleId: number) => ipcRenderer.invoke('db:getPracticeProgress', userName, articleId),
  clearPracticeProgress: (userName: string, articleId: number) => ipcRenderer.invoke('db:clearPracticeProgress', userName, articleId),

  // 爬虫
  fetchArticles: (category: string, customUrl?: string) => ipcRenderer.invoke('crawler:fetchArticles', category, customUrl),

  // 对话框
  importArticle: () => ipcRenderer.invoke('dialog:importArticle'),

  // 应用初始化
  initializeDefaultArticles: () => ipcRenderer.invoke('app:initializeDefaultArticles'),

  // TTS 语音合成
  speak: (text: string) => ipcRenderer.invoke('tts:speak', text),
  stopSpeaking: () => ipcRenderer.invoke('tts:stop'),
})
