import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from '../utils/api'
import './ArticlesPage.css'

type SegmentMode = 'word' | 'phrase' | 'sentence'

export function EditArticlePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'
  
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  
  // 分词相关状态
  const [showSegment, setShowSegment] = useState(false)
  const [segmentMode, setSegmentMode] = useState<SegmentMode>('word')
  const [segments, setSegments] = useState<string[]>([])
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [segmentError, setSegmentError] = useState<string | null>(null)
  
  // 编辑分词相关
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // 加载文章（编辑模式）
  useEffect(() => {
    if (!isNew && id) {
      loadArticle(parseInt(id))
    }
  }, [id, isNew])

  const loadArticle = async (articleId: number) => {
    try {
      setIsLoading(true)
      const article = await api.getArticle(articleId)
      if (article) {
        setTitle(article.title)
        setContent(article.content)
      }
    } catch (error) {
      console.error('Error loading article:', error)
      alert('加载文章失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      alert('请输入文章标题')
      return
    }
    if (!content.trim()) {
      alert('请输入文章内容')
      return
    }

    try {
      setIsSaving(true)
      
      if (isNew) {
        const newId = await api.createArticle(title, content)
        // 保存后跳转到分词页面
        navigate(`/segment/${newId}`)
      } else {
        await api.updateArticle(parseInt(id!), title, content)
        navigate('/articles')
      }
    } catch (error) {
      console.error('Error saving article:', error)
      alert('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 执行分词
  const handleSegment = async () => {
    if (!content.trim()) {
      alert('请先输入文章内容')
      return
    }

    try {
      setIsSegmenting(true)
      setSegmentError(null)
      
      const result = await api.segmentText(content, segmentMode)
      
      if (result.success) {
        setSegments(result.segments)
        setShowSegment(true)
      } else {
        setSegmentError(result.error || '分词失败')
      }
    } catch (error) {
      console.error('Segmentation error:', error)
      setSegmentError('连接分词服务失败，请确保服务器正在运行')
    } finally {
      setIsSegmenting(false)
    }
  }

  // 保存分词结果
  const handleSaveSegments = async () => {
    if (!id || isNew) {
      alert('请先保存文章')
      return
    }

    try {
      setIsSaving(true)
      await api.saveSegments(parseInt(id), segmentMode, segments)
      alert('分词保存成功！')
      navigate('/articles')
    } catch (error) {
      console.error('Error saving segments:', error)
      alert('保存分词失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 删除片段
  const handleDeleteSegment = (index: number) => {
    setSegments(segments.filter((_, i) => i !== index))
  }

  // 开始编辑片段
  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(segments[index])
  }

  // 保存编辑
  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const newSegments = [...segments]
      newSegments[editingIndex] = editValue
      setSegments(newSegments)
      setEditingIndex(null)
      setEditValue('')
    }
  }

  // 合并片段
  const handleMergeSegments = (index: number) => {
    if (index < segments.length - 1) {
      const newSegments = [...segments]
      newSegments[index] = newSegments[index] + ' ' + newSegments[index + 1]
      newSegments.splice(index + 1, 1)
      setSegments(newSegments)
    }
  }

  // 拆分片段
  const handleSplitSegment = (index: number) => {
    const segment = segments[index]
    const words = segment.split(/\s+/)
    if (words.length > 1) {
      const newSegments = [...segments]
      newSegments.splice(index, 1, ...words.filter(w => w))
      setSegments(newSegments)
    }
  }

  if (isLoading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="edit-article-page">
      <div className="page-header">
        <h1>{isNew ? '录入新文章' : '编辑文章'}</h1>
      </div>

      {!showSegment ? (
        // 文章编辑界面
        <div className="edit-form">
          <div className="form-group">
            <label htmlFor="title">文章标题</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入文章标题"
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">文章内容</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴或输入英文文章内容..."
              rows={15}
            />
          </div>

          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/articles')}
              type="button"
            >
              取消
            </button>
            
            {!isNew && (
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving}
                type="button"
              >
                {isSaving ? '保存中...' : '保存文章'}
              </button>
            )}

            {isNew ? (
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving}
                type="button"
              >
                {isSaving ? '保存中...' : '保存并分词'}
              </button>
            ) : (
              <button
                className="btn btn-success"
                onClick={() => setShowSegment(true)}
                type="button"
              >
                开始分词
              </button>
            )}
          </div>
        </div>
      ) : (
        // 分词界面
        <div className="segment-panel">
          <div className="segment-header">
            <div className="segment-mode-selector">
              <span>分词模式：</span>
              <button
                className={`mode-btn ${segmentMode === 'word' ? 'active' : ''}`}
                onClick={() => setSegmentMode('word')}
                type="button"
              >
                单词
              </button>
              <button
                className={`mode-btn ${segmentMode === 'phrase' ? 'active' : ''}`}
                onClick={() => setSegmentMode('phrase')}
                type="button"
              >
                短语
              </button>
              <button
                className={`mode-btn ${segmentMode === 'sentence' ? 'active' : ''}`}
                onClick={() => setSegmentMode('sentence')}
                type="button"
              >
                短句
              </button>
            </div>
            
            <button
              className="btn btn-primary"
              onClick={handleSegment}
              disabled={isSegmenting}
              type="button"
            >
              {isSegmenting ? '分词中...' : 'AI 分词'}
            </button>
          </div>

          {segmentError && (
            <div className="error-message">
              {segmentError}
            </div>
          )}

          <div className="segment-content">
            {/* 原文预览 */}
            <div className="original-text">
              <h3>原文</h3>
              <div className="text-content">
                {content}
              </div>
            </div>

            {/* 分词结果 */}
            <div className="segments-result">
              <h3>
                分词结果 
                <span className="count">({segments.length} 个片段)</span>
              </h3>
              
              {segments.length === 0 ? (
                <div className="empty-segments">
                  点击"AI 分词"按钮开始
                </div>
              ) : (
                <>
                  <div className="segment-search">
                    <input
                      type="text"
                      placeholder="搜索片段..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span className="search-count">
                      {searchQuery 
                        ? `${segments.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase())).length} / ${segments.length}` 
                        : ''}
                    </span>
                  </div>
                  <div className="segments-list">
                    {segments
                      .map((segment, index) => ({ segment, index }))
                      .filter(({ segment }) => 
                        !searchQuery || segment.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(({ segment, index }) => (
                    <div key={index} className="segment-item">
                      <span className="segment-index">{index + 1}</span>
                      
                      {editingIndex === index ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          autoFocus
                        />
                      ) : (
                        <span className="segment-text">{segment}</span>
                      )}
                      
                      <div className="segment-actions">
                        <button
                          className="btn-small"
                          onClick={() => handleStartEdit(index)}
                          title="编辑"
                          type="button"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-small"
                          onClick={() => handleSplitSegment(index)}
                          title="拆分"
                          type="button"
                        >
                          ✂️
                        </button>
                        <button
                          className="btn-small"
                          onClick={() => handleMergeSegments(index)}
                          title="与下一项合并"
                          type="button"
                        >
                          🔗
                        </button>
                        <button
                          className="btn-small btn-danger"
                          onClick={() => handleDeleteSegment(index)}
                          title="删除"
                          type="button"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>

          <div className="segment-footer">
            <button
              className="btn btn-secondary"
              onClick={() => setShowSegment(false)}
              type="button"
            >
              返回编辑
            </button>
            <button
              className="btn btn-success"
              onClick={handleSaveSegments}
              disabled={segments.length === 0 || isSaving}
              type="button"
            >
              {isSaving ? '保存中...' : '保存分词结果'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
