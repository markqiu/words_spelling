import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Article } from '../../types'
import './ArticlesPage.css'

const categories = [
  { value: 'all', label: '全部', icon: '📚' },
  { value: 'novel', label: '小说', icon: '📖' },
  { value: 'news', label: '新闻', icon: '📰' },
  { value: 'story', label: '故事', icon: '📜' },
  { value: 'biography', label: '传记', icon: '👤' },
  { value: 'technical', label: '专业', icon: '🔬' },
  { value: 'other', label: '其他', icon: '📁' },
]

export function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState('练习者')

  const loadArticles = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await window.electronAPI.getArticles()
      setArticles(data)
      setFilteredArticles(data)
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
    let filtered = articles

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.content.toLowerCase().includes(query)
      )
    }

    setFilteredArticles(filtered)
  }, [selectedCategory, searchQuery, articles])

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这篇文章吗？')) return

    try {
      await window.electronAPI.deleteArticle(id)
      loadArticles()
    } catch (error) {
      console.error('Error deleting article:', error)
    }
  }

  // 文件导入功能（预留）
  // const handleImport = async () => {
  //   try {
  //     const filePath = await window.electronAPI.importArticle()
  //     if (filePath) {
  //       alert(`已选择文件: ${filePath}`)
  //     }
  //   } catch (error) {
  //     console.error('Import error:', error)
  //   }
  // }

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
          <Link to="/crawl" className="btn btn-primary">
            爬取文章
          </Link>
        </div>
      </div>

      <div className="category-filter">
        {categories.map(cat => (
          <button
            key={cat.value}
            className={`category-btn ${selectedCategory === cat.value ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.value)}
            type="button"
          >
            <span className="category-icon">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
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
            <Link to="/crawl" className="btn btn-primary">
              去爬取文章
            </Link>
          </div>
        ) : (
          filteredArticles.map(article => (
            <div key={article.id} className="article-card">
              <div className="article-header">
                <h3 className="article-title">{article.title}</h3>
                <span className={`category-badge ${article.category}`}>
                  {getCategoryLabel(article.category)}
                </span>
              </div>

              <p className="article-preview">
                {article.content.substring(0, 150)}...
              </p>

              <div className="article-meta">
                <span className="meta-item">
                  <span className="meta-icon">📝</span>
                  {article.wordCount} 词
                </span>
                <span className={`meta-item difficulty ${article.difficulty}`}>
                  {getDifficultyLabel(article.difficulty)}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">📅</span>
                  {formatDate(article.createdAt)}
                </span>
              </div>

              <div className="article-actions">
                <Link
                  to={`/spelling/${article.id}`}
                  className="btn btn-primary"
                  state={{ userName }}
                >
                  拼写练习
                </Link>
                <Link
                  to={`/phrase/${article.id}`}
                  className="btn btn-success"
                  state={{ userName }}
                >
                  短语听写
                </Link>
                <Link
                  to={`/typing/${article.id}`}
                  className="btn btn-secondary"
                  state={{ userName }}
                >
                  背诵练习
                </Link>
                <Link
                  to={`/edit/${article.id}`}
                  className="btn btn-warning btn-icon"
                  title="编辑"
                >
                  ✏️
                </Link>
                <button
                  className="btn btn-error btn-icon"
                  onClick={() => article.id !== undefined && handleDelete(article.id)}
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

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '未知'
  return new Date(dateString).toLocaleDateString('zh-CN')
}
