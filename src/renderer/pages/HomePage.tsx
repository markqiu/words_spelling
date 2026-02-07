import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Article, PracticeRecord } from '../../types'
import './HomePage.css'

export function HomePage() {
  const [recentArticles, setRecentArticles] = useState<Article[]>([])
  const [stats, setStats] = useState({
    totalArticles: 0,
    totalPractices: 0,
    avgAccuracy: 0,
    avgWpm: 0
  })
  const [userName] = useState('练习者')
  const [isInitializing, setIsInitializing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // 初始化默认文章
      await window.electronAPI.initializeDefaultArticles()

      // 加载文章
      const articles = await window.electronAPI.getArticles()
      setRecentArticles(articles.slice(0, 5))
      setStats(prev => ({ ...prev, totalArticles: articles.length }))

      // 加载练习记录
      const records = await window.electronAPI.getPracticeRecords(userName)
      if (records.length > 0) {
        const totalAccuracy = records.reduce((sum: number, r: PracticeRecord) => sum + r.accuracy, 0)
        const totalWpm = records.reduce((sum: number, r: PracticeRecord) => sum + r.wpm, 0)
        setStats({
          totalArticles: articles.length,
          totalPractices: records.length,
          avgAccuracy: Math.round((totalAccuracy / records.length) * 100) / 100,
          avgWpm: Math.round(totalWpm / records.length)
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleInitialize = async () => {
    setIsInitializing(true)
    try {
      const result = await window.electronAPI.initializeDefaultArticles()
      if (result) {
        alert('默认文章库已初始化！')
        loadData()
      } else {
        alert('文章库已存在，无需重复初始化。')
      }
    } catch (error) {
      console.error('Initialize error:', error)
      alert('初始化失败')
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>欢迎来到单词拼写练习</h1>
        <p className="subtitle">提升你的英语拼写和打字技能</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-value">{stats.totalArticles}</div>
          <div className="stat-label">文章总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-value">{stats.totalPractices}</div>
          <div className="stat-label">练习次数</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.avgAccuracy}%</div>
          <div className="stat-label">平均准确率</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{stats.avgWpm}</div>
          <div className="stat-label">平均速度 (WPM)</div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>快速开始</h2>
        <div className="action-cards">
          <Link to="/articles" className="action-card">
            <div className="action-icon">📝</div>
            <div className="action-title">选择文章练习</div>
            <div className="action-desc">从文章库中选择一篇文章开始练习</div>
          </Link>
          <Link to="/crawl" className="action-card">
            <div className="action-icon">🕷️</div>
            <div className="action-title">爬取新文章</div>
            <div className="action-desc">从网络爬取新的文章添加到库中</div>
          </Link>
          <Link to="/leaderboard" className="action-card">
            <div className="action-icon">🏆</div>
            <div className="action-title">查看排行榜</div>
            <div className="action-desc">查看练习成绩排行榜</div>
          </Link>
        </div>
      </div>

      {recentArticles.length > 0 && (
        <div className="recent-articles">
          <h2>最新文章</h2>
          <div className="article-list">
            {recentArticles.map((article) => (
              <div key={article.id} className="article-item">
                <div className="article-info">
                  <div className="article-title">{article.title}</div>
                  <div className="article-meta">
                    <span className={`category-tag ${article.category}`}>
                      {getCategoryLabel(article.category)}
                    </span>
                    <span className="word-count">{article.wordCount} 词</span>
                    <span className={`difficulty-badge ${article.difficulty}`}>
                      {getDifficultyLabel(article.difficulty)}
                    </span>
                  </div>
                </div>
                <div className="article-actions">
                  {article.id && (
                    <>
                      <Link to={`/spelling/${article.id}`} className="btn btn-primary btn-sm">
                        拼写练习
                      </Link>
                      <Link to={`/typing/${article.id}`} className="btn btn-secondary btn-sm">
                        背诵练习
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="init-section">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleInitialize}
          disabled={isInitializing}
        >
          {isInitializing ? '初始化中...' : '重置默认文章库'}
        </button>
      </div>
    </div>
  )
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    novel: '小说',
    news: '新闻',
    story: '故事',
    biography: '传记',
    technical: '专业',
    other: '其他'
  }
  return labels[category] || category
}

function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  }
  return labels[difficulty] || difficulty
}
