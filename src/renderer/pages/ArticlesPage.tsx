import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../utils/api'
import './ArticlesPage.css'

export function ArticlesPage() {
  const [articles, setArticles] = useState<api.Article[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState('练习者')
  const [segmentStatus, setSegmentStatus] = useState<Record<number, Record<string, boolean>>>({})

  const loadArticles = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await api.getArticles()
      setArticles(data)
      
      // 检查每篇文章的分词状态
      const status: Record<number, Record<string, boolean>> = {}
      for (const article of data) {
        status[article.id] = {
          word: false,
          phrase: false,
          sentence: false
        }
      }
      setSegmentStatus(status)
    } catch (error) {
      console.error('Error loading articles:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  useEffect(() => {
    localStorage.setItem('userName', userName)
  }, [userName])

  useEffect(() => {
    const saved = localStorage.getItem('userName')
    if (saved) setUserName(saved)
  }, [])

  const filteredArticles = articles.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这篇文章吗？')) return

    try {
      await api.deleteArticle(id)
      loadArticles()
    } catch (error) {
      console.error('Error deleting article:', error)
      alert('删除失败')
    }
  }

  if (isLoading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="articles-page">
      <div className="page-header">
        <h1>文章库</h1>
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索文章..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Link to="/edit/new" className="btn btn-primary">
            录入文章
          </Link>
        </div>
      </div>

      <div className="user-name-input">
        <label>练习者姓名：</label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="输入你的名字"
        />
      </div>

      <div className="articles-grid">
        {filteredArticles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>暂无文章</p>
            <Link to="/edit/new" className="btn btn-primary">
              录入第一篇文章
            </Link>
          </div>
        ) : (
          filteredArticles.map(article => (
            <div key={article.id} className="article-card">
              <div className="article-header">
                <h3 className="article-title">{article.title}</h3>
              </div>

              <p className="article-preview">
                {article.content.substring(0, 150)}...
              </p>

              <div className="article-meta">
                <span className="meta-item">
                  <span className="meta-icon">📅</span>
                  {formatDate(article.created_at)}
                </span>
              </div>

              <div className="segment-status">
                <span className={`status-badge ${segmentStatus[article.id]?.word ? 'ready' : ''}`}>
                  单词 {segmentStatus[article.id]?.word ? '✓' : '○'}
                </span>
                <span className={`status-badge ${segmentStatus[article.id]?.phrase ? 'ready' : ''}`}>
                  短语 {segmentStatus[article.id]?.phrase ? '✓' : '○'}
                </span>
                <span className={`status-badge ${segmentStatus[article.id]?.sentence ? 'ready' : ''}`}>
                  短句 {segmentStatus[article.id]?.sentence ? '✓' : '○'}
                </span>
              </div>

              <div className="article-actions">
                <Link
                  to={`/practice/${article.id}/word`}
                  className="btn btn-primary"
                  state={{ userName }}
                >
                  单词听写
                </Link>
                <Link
                  to={`/practice/${article.id}/phrase`}
                  className="btn btn-success"
                  state={{ userName }}
                >
                  短语听写
                </Link>
                <Link
                  to={`/practice/${article.id}/sentence`}
                  className="btn btn-secondary"
                  state={{ userName }}
                >
                  短句听写
                </Link>
                <Link
                  to={`/segment/${article.id}`}
                  className="btn btn-warning"
                  state={{ userName }}
                >
                  分词
                </Link>
                <button
                  className="btn btn-error btn-icon"
                  onClick={() => handleDelete(article.id)}
                  title="删除"
                  type="button"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('zh-CN')
}
