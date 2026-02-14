import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../utils/api'
import './HomePage.css'

export function HomePage() {
  const [recentArticles, setRecentArticles] = useState<api.Article[]>([])
  const [stats, setStats] = useState({
    totalArticles: 0,
    totalPractices: 0,
    avgAccuracy: 0
  })
  const [userName] = useState('练习者')

  useEffect(() => {
    loadData()
    
    // 从 localStorage 读取用户名
    const saved = localStorage.getItem('userName')
    if (saved) {
      // 这里不设置 userName 因为它是 const，需要在 ArticlesPage 设置
    }
  }, [])

  const loadData = async () => {
    try {
      // 加载文章
      const articles = await api.getArticles()
      setRecentArticles(articles.slice(0, 5))
      setStats(prev => ({ ...prev, totalArticles: articles.length }))

      // 加载排行榜统计
      const leaderboard = await api.getLeaderboard(undefined, undefined, 100)
      if (leaderboard.length > 0) {
        const totalAccuracy = leaderboard.reduce((sum, r) => sum + r.accuracy, 0)
        setStats({
          totalArticles: articles.length,
          totalPractices: leaderboard.length,
          avgAccuracy: Math.round((totalAccuracy / leaderboard.length) * 100) / 100
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>单词拼写练习</h1>
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
          <div className="stat-label">平均正确率</div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>快速开始</h2>
        <div className="action-cards">
          <Link to="/edit/new" className="action-card primary">
            <div className="action-icon">📝</div>
            <div className="action-title">录入文章</div>
            <div className="action-desc">粘贴或输入英文文章，AI 智能分词</div>
          </Link>
          <Link to="/articles" className="action-card">
            <div className="action-icon">📖</div>
            <div className="action-title">开始听写</div>
            <div className="action-desc">选择文章进行单词、短语或短句听写</div>
          </Link>
          <Link to="/leaderboard" className="action-card">
            <div className="action-icon">🏆</div>
            <div className="action-title">排行榜</div>
            <div className="action-desc">查看练习成绩排行</div>
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
                    <span className="date">{formatDate(article.created_at)}</span>
                  </div>
                </div>
                <div className="article-actions">
                  <Link to={`/practice/${article.id}/word`} className="btn btn-primary btn-sm" state={{ userName }}>
                    单词
                  </Link>
                  <Link to={`/practice/${article.id}/phrase`} className="btn btn-success btn-sm" state={{ userName }}>
                    短语
                  </Link>
                  <Link to={`/practice/${article.id}/sentence`} className="btn btn-secondary btn-sm" state={{ userName }}>
                    短句
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('zh-CN')
}
