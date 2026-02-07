import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Article, ArticleCategory } from '../../types'
import './ArticlesPage.css'

const categories: { value: ArticleCategory; label: string }[] = [
  { value: 'novel', label: '小说' },
  { value: 'news', label: '新闻' },
  { value: 'story', label: '故事' },
  { value: 'biography', label: '传记' },
  { value: 'technical', label: '专业' },
  { value: 'other', label: '其他' },
]

export function EditArticlePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<ArticleCategory>('other')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadArticle = async () => {
      if (!id) return
      try {
        const art = await window.electronAPI.getArticleById(parseInt(id))
        if (art) {
          setArticle(art)
          setTitle(art.title)
          setContent(art.content)
          setCategory(art.category)
          setDifficulty(art.difficulty)
        }
      } catch (error) {
        console.error('Error loading article:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadArticle()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!article?.id) return

    setIsSaving(true)
    try {
      const updatedArticle: Article = {
        ...article,
        title: title.trim(),
        content: content.trim(),
        category,
        difficulty,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
      }

      const success = await window.electronAPI.updateArticle(updatedArticle)
      if (success) {
        alert('文章更新成功！')
        navigate('/articles')
      } else {
        alert('更新失败，请重试')
      }
    } catch (error) {
      console.error('Error updating article:', error)
      alert('更新失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="loading">加载中...</div>
  }

  if (!article) {
    return <div className="error">文章不存在</div>
  }

  return (
    <div className="crawl-page">
      <div className="page-header">
        <h1>编辑文章</h1>
        <p className="subtitle">修改文章内容（练习记录将保留）</p>
      </div>

      <form onSubmit={handleSubmit} className="manual-form">
        <div className="form-group">
          <label htmlFor="title">文章标题</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文章标题"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">分类</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ArticleCategory)}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="difficulty">难度</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
            >
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="content">
            文章内容
            <span className="hint">（支持自动提取短句/短语进行听写练习）</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="粘贴或输入英文文章内容..."
            rows={15}
            required
          />
          <div className="word-count">
            约 {content.split(/\s+/).filter(w => w.length > 0).length} 词
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/articles')}
            disabled={isSaving}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving || !title.trim() || !content.trim()}
          >
            {isSaving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </form>
    </div>
  )
}
