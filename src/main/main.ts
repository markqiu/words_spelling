import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { DatabaseManager } from './database/DatabaseManager'
import { ArticleCrawler } from './crawler/ArticleCrawler'
import type { ArticleCategory } from '../types'
import say from 'say'

let mainWindow: BrowserWindow | null = null
const dbManager = new DatabaseManager()
const crawler = new ArticleCrawler()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  // 加载应用
  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools() // 开发工具已禁用
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用生命周期
app.whenReady().then(() => {
  // 初始化数据库
  dbManager.initialize()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 处理 - 数据库操作
ipcMain.handle('db:getArticles', (_, category?: string) => {
  return dbManager.getArticles(category)
})

ipcMain.handle('db:getArticleById', (_, id: number) => {
  return dbManager.getArticleById(id)
})

ipcMain.handle('db:addArticle', (_, article) => {
  return dbManager.addArticle(article)
})

ipcMain.handle('db:deleteArticle', (_, id: number) => {
  return dbManager.deleteArticle(id)
})

ipcMain.handle('db:updateArticle', (_, article) => {
  return dbManager.updateArticle(article)
})

ipcMain.handle('db:savePracticeRecord', (_, record) => {
  return dbManager.savePracticeRecord(record)
})

ipcMain.handle('db:getPracticeRecords', (_, userName: string) => {
  return dbManager.getPracticeRecords(userName)
})

ipcMain.handle('db:getLeaderboard', () => {
  return dbManager.getLeaderboard()
})

// IPC 处理 - 错词本
ipcMain.handle('db:getMistakeWords', (_, userName: string) => {
  return dbManager.getMistakeWords(userName)
})

ipcMain.handle('db:addMistakeWord', (_, userName: string, word: string, articleId?: number) => {
  return dbManager.addMistakeWord(userName, word, articleId)
})

ipcMain.handle('db:removeMistakeWord', (_, userName: string, word: string) => {
  return dbManager.removeMistakeWord(userName, word)
})

ipcMain.handle('db:isMistakeWord', (_, userName: string, word: string) => {
  return dbManager.isMistakeWord(userName, word)
})

// IPC 处理 - 文章词汇掌握状态
ipcMain.handle('db:getArticleWordProgress', (_, userName: string, articleId: number) => {
  return dbManager.getArticleWordProgress(userName, articleId)
})

ipcMain.handle('db:updateWordProgress', (_, userName: string, articleId: number, word: string, mastered: boolean) => {
  return dbManager.updateWordProgress(userName, articleId, word, mastered)
})

ipcMain.handle('db:getWordsToPractice', (_, userName: string, articleId: number, allWords: string[]) => {
  return dbManager.getWordsToPractice(userName, articleId, allWords)
})

// IPC 处理 - 练习进度
ipcMain.handle('db:savePracticeProgress', (_, userName: string, articleId: number, progress) => {
  return dbManager.savePracticeProgress(userName, articleId, progress)
})

ipcMain.handle('db:getPracticeProgress', (_, userName: string, articleId: number) => {
  return dbManager.getPracticeProgress(userName, articleId)
})

ipcMain.handle('db:clearPracticeProgress', (_, userName: string, articleId: number) => {
  return dbManager.clearPracticeProgress(userName, articleId)
})

// IPC 处理 - 语音播放
ipcMain.handle('tts:speak', async (_, text: string) => {
  return new Promise((resolve, reject) => {
    say.speak(text, 'Samantha', 0.9, (err) => {
      if (err) {
        // 忽略 SIGTERM 错误（由 say.stop() 触发，属于正常中断）
        if (err.message && err.message.includes('SIGTERM')) {
          resolve(false)
          return
        }
        console.error('TTS error:', err)
        reject(err)
      } else {
        resolve(true)
      }
    })
  })
})

ipcMain.handle('tts:stop', () => {
  say.stop()
})

// IPC 处理 - 爬虫
ipcMain.handle('crawler:fetchArticles', async (_, category: string, customUrl?: string) => {
  try {
    return await crawler.fetchArticles(category as ArticleCategory, customUrl)
  } catch (error) {
    console.error('Crawl error:', error)
    throw error
  }
})

// IPC 处理 - 导入文章
ipcMain.handle('dialog:importArticle', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '文本文件', extensions: ['txt', 'md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// 初始化预设文章
ipcMain.handle('app:initializeDefaultArticles', () => {
  return dbManager.initializeDefaultArticles()
})
