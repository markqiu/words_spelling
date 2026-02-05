import { useState, useEffect } from 'react'
import type { ArticleCategory, CrawledArticle } from '../../types'

const categories: { value: ArticleCategory; label: string }[] = [
  { value: 'novel', label: '小说' },
  { value: 'news', label: '新闻' },
  { value: 'story', label: '故事' },
  { value: 'biography', label: '传记' },
  { value: 'technical', label: '专业' },
  { value: 'other', label: '其他' },
]

export function CrawlPage() {
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory>('novel')
  const [customUrl, setCustomUrl] = useState('')
  const [articles, setArticles] = useState<CrawledArticle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualArticle, setManualArticle] = useState({
    title: '',
    content: '',
    category: 'novel' as ArticleCategory,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard'
  })

  // 当选择分类时自动爬取
  useEffect(() => {
    const autoCrawl = async () => {
      setIsLoading(true)
      try {
        const crawledArticles = await window.electronAPI.fetchArticles(selectedCategory)
        setArticles(crawledArticles.map(a => ({ ...a, selected: false })))
      } catch (error) {
        console.error('Auto crawl error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    autoCrawl()
  }, [selectedCategory])

  const handleCrawl = async () => {
    // URL 为空时使用自动爬取（不传入 URL）
    const url = customUrl.trim() || undefined

    setIsLoading(true)
    try {
      const crawledArticles = await window.electronAPI.fetchArticles(selectedCategory, url)
      setArticles(crawledArticles.map(a => ({ ...a, selected: false })))
      if (url) {
        alert(`成功从 ${url} 爬取 ${crawledArticles.length} 篇文章！`)
      }
    } catch (error) {
      console.error('Crawl error:', error)
      alert(url ? '爬取失败，请检查URL是否正确' : '自动爬取失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualAdd = async () => {
    if (!manualArticle.title.trim() || !manualArticle.content.trim()) {
      alert('请填写标题和内容')
      return
    }

    setIsLoading(true)
    try {
      await window.electronAPI.addArticle({
        title: manualArticle.title,
        content: manualArticle.content,
        category: manualArticle.category,
        difficulty: manualArticle.difficulty,
        wordCount: manualArticle.content.split(/\s+/).length,
        source: 'manual'
      })
      alert('文章添加成功！')
      setManualArticle({ title: '', content: '', category: 'novel', difficulty: 'medium' })
      setShowManualAdd(false)
    } catch (error) {
      console.error('Add article error:', error)
      alert('添加失败')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSelection = (index: number) => {
    setArticles(prev =>
      prev.map((article, i) =>
        i === index ? { ...article, selected: !article.selected } : article
      )
    )
  }

  const selectAll = () => {
    setArticles(prev => prev.map(a => ({ ...a, selected: true })))
  }

  const deselectAll = () => {
    setArticles(prev => prev.map(a => ({ ...a, selected: false })))
  }

  const handleImport = async () => {
    const selectedArticles = articles.filter(a => a.selected)
    if (selectedArticles.length === 0) {
      alert('请先选择要导入的文章')
      return
    }

    // 获取现有文章列表用于查重
    const existingArticles = await window.electronAPI.getArticles()
    const existingTitles = new Set(existingArticles.map(a => a.title.toLowerCase().trim()))

    // 检查是否有重复
    const duplicates: string[] = []
    const newArticles = selectedArticles.filter(article => {
      const isDuplicate = existingTitles.has(article.title.toLowerCase().trim())
      if (isDuplicate) {
        duplicates.push(article.title)
      }
      return !isDuplicate
    })

    if (newArticles.length === 0) {
      alert(`选中的 ${selectedArticles.length} 篇文章都已存在于库中，无需导入。`)
      setArticles(prev => prev.map(a => ({ ...a, selected: false })))
      return
    }

    if (duplicates.length > 0) {
      const confirmImport = confirm(
        `以下 ${duplicates.length} 篇文章已存在于库中，将跳过：\n${duplicates.slice(0, 5).join('\n')}${duplicates.length > 5 ? '\n...等' : ''}\n\n是否继续导入其余 ${newArticles.length} 篇新文章？`
      )
      if (!confirmImport) {
        return
      }
    }

    setIsLoading(true)
    let successCount = 0
    let failCount = 0

    for (const article of newArticles) {
      try {
        await window.electronAPI.addArticle({
          title: article.title,
          content: article.content,
          category: article.category,
          difficulty: 'medium',
          wordCount: article.wordCount,
          source: article.source,
        })
        successCount++
      } catch (error) {
        console.error('Import error:', error)
        failCount++
      }
    }

    setIsLoading(false)
    
    let message = `导入完成！\n成功：${successCount} 篇`
    if (duplicates.length > 0) {
      message += `\n跳过（已存在）：${duplicates.length} 篇`
    }
    if (failCount > 0) {
      message += `\n失败：${failCount} 篇`
    }
    alert(message)
    
    setArticles(prev => prev.map(a => ({ ...a, selected: false })))
  }

  const selectedCount = articles.filter(a => a.selected).length

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📡 文章爬取</h1>
        <p style={styles.subtitle}>从网页爬取文章添加到练习库</p>
      </div>

      <div style={styles.card}>
        <div style={styles.formGroup}>
          <label htmlFor="category-select" style={styles.label}>选择分类（自动爬取）</label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ArticleCategory)}
            style={styles.select}
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <p style={styles.hint}>💡 选择分类后将自动从预设源爬取文章</p>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="url-input" style={styles.label}>自定义 URL（可选）</label>
          <div style={styles.urlInputGroup}>
            <input
              id="url-input"
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://example.com/article"
              style={styles.urlInput}
            />
            <button
              type="button"
              onClick={handleCrawl}
              disabled={isLoading}
              style={{ ...styles.btn, ...styles.btnPrimary, ...(isLoading ? styles.btnDisabled : {}) }}
            >
              {isLoading ? '⏳ 爬取中...' : '🔍 爬取'}
            </button>
          </div>
        </div>

        <div style={styles.divider} />

        <button
          type="button"
          onClick={() => setShowManualAdd(!showManualAdd)}
          style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnFullWidth }}
        >
          {showManualAdd ? '❌ 取消' : '✏️ 手动添加文章'}
        </button>
      </div>

      {showManualAdd && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>✏️ 手动添加文章</h3>
          
          <div style={styles.formGroup}>
            <label htmlFor="manual-title" style={styles.label}>文章标题 *</label>
            <input
              id="manual-title"
              type="text"
              value={manualArticle.title}
              onChange={(e) => setManualArticle(prev => ({ ...prev, title: e.target.value }))}
              placeholder="输入文章标题"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="manual-category" style={styles.label}>分类</label>
            <select
              id="manual-category"
              value={manualArticle.category}
              onChange={(e) => setManualArticle(prev => ({ ...prev, category: e.target.value as ArticleCategory }))}
              style={styles.select}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="manual-difficulty" style={styles.label}>难度</label>
            <select
              id="manual-difficulty"
              value={manualArticle.difficulty}
              onChange={(e) => setManualArticle(prev => ({ ...prev, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
              style={styles.select}
            >
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="manual-content" style={styles.label}>文章内容 *</label>
            <textarea
              id="manual-content"
              value={manualArticle.content}
              onChange={(e) => setManualArticle(prev => ({ ...prev, content: e.target.value }))}
              placeholder="粘贴或输入文章内容..."
              style={styles.textarea}
              rows={10}
            />
            <p style={styles.hint}>📊 字数: {manualArticle.content.split(/\s+/).filter(w => w.length > 0).length}</p>
          </div>

          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={handleManualAdd}
              disabled={isLoading || !manualArticle.title.trim() || !manualArticle.content.trim()}
              style={{
                ...styles.btn,
                ...styles.btnPrimary,
                ...styles.btnFullWidth,
                ...(isLoading || !manualArticle.title.trim() || !manualArticle.content.trim() ? styles.btnDisabled : {})
              }}
            >
              {isLoading ? '⏳ 添加中...' : '✅ 添加文章'}
            </button>
          </div>
        </div>
      )}

      {articles.length > 0 && (
        <div style={styles.card}>
          <div style={styles.resultsHeader}>
            <h3 style={styles.resultsTitle}>爬取结果 ({articles.length} 篇)</h3>
            <div style={styles.resultsActions}>
              <button type="button" onClick={selectAll} style={{ ...styles.btn, ...styles.btnSecondary }}>
                全选
              </button>
              <button type="button" onClick={deselectAll} style={{ ...styles.btn, ...styles.btnSecondary }}>
                取消全选
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0 || isLoading}
                style={{
                  ...styles.btn,
                  ...styles.btnSuccess,
                  ...((selectedCount === 0 || isLoading) ? styles.btnDisabled : {})
                }}
              >
                {isLoading ? '⏳ 导入中...' : `📥 导入选中 (${selectedCount})`}
              </button>
            </div>
          </div>

          <div style={styles.articlesList}>
            {articles.map((article, idx) => (
              <label
                key={`${article.title}-${idx}`}
                htmlFor={`article-${idx}`}
                style={{
                  ...styles.articleItem,
                  ...(article.selected ? styles.articleItemSelected : {}),
                  cursor: 'pointer'
                }}
              >
                <input
                  id={`article-${idx}`}
                  type="checkbox"
                  checked={article.selected || false}
                  onChange={() => toggleSelection(idx)}
                  style={styles.checkbox}
                />
                <div style={styles.articleContent}>
                  <h4 style={styles.articleTitle}>{article.title}</h4>
                  <p style={styles.articleMeta}>
                    <span style={styles.categoryBadge}>{categories.find(c => c.value === article.category)?.label}</span>
                    <span>📝 {article.wordCount} 字</span>
                    <span style={styles.sourceText}>🔗 {article.source}</span>
                  </p>
                  <p style={styles.articleExcerpt}>
                    {article.content.slice(0, 150)}...
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  card: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '24px',
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  select: {
    width: '100%',
    maxWidth: '300px',
    padding: '10px 14px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-primary)',
  },
  urlInputGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  urlInput: {
    flex: 1,
    minWidth: '300px',
    padding: '10px 14px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnPrimary: {
    backgroundColor: 'var(--primary-color)',
    color: 'white',
  },
  btnSecondary: {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
  },
  btnSuccess: {
    backgroundColor: 'var(--success-color)',
    color: 'white',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  resultsTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  resultsActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  articlesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  articleItem: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: 'var(--card-bg)',
  },
  articleItemSelected: {
    borderColor: 'var(--primary-color)',
    backgroundColor: 'rgba(74, 144, 217, 0.05)',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    marginTop: '2px',
    cursor: 'pointer',
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  articleMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    flexWrap: 'wrap' as const,
  },
  categoryBadge: {
    padding: '2px 8px',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
  },
  sourceText: {
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  articleExcerpt: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  hint: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '20px 0',
  },
  btnFullWidth: {
    width: '100%',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
}
