import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../utils/api'
import './PracticePage.css'

type PracticeMode = 'word' | 'phrase' | 'sentence'

interface PracticeStats {
  correct: number
  incorrect: number
}

export function PracticePage() {
  const { articleId, mode } = useParams<{ articleId: string; mode: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  
  const practiceMode = (mode as PracticeMode) || 'word'
  const userName = (location.state as { userName?: string })?.userName || '练习者'
  
  // 状态
  const [article, setArticle] = useState<api.Article | null>(null)
  const [segments, setSegments] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  
  // 练习设置
  const [practiceCount, setPracticeCount] = useState<number | null>(null) // null = 全部
  const [showSettings, setShowSettings] = useState(true)
  const [continueFromProgress, setContinueFromProgress] = useState(false)
  
  // 统计
  const statsRef = useRef<PracticeStats>({ correct: 0, incorrect: 0 })
  const [isCompleted, setIsCompleted] = useState(false)
  
  // 当前练习的片段列表
  const [practiceList, setPracticeList] = useState<string[]>([])
  
  // 输入框引用
  const inputRef = useRef<HTMLInputElement>(null)

  // 加载文章和分词
  useEffect(() => {
    if (!articleId) return
    
    const loadData = async () => {
      try {
        setIsLoading(true)
        
        // 加载文章
        const art = await api.getArticle(parseInt(articleId))
        if (!art) {
          alert('文章不存在')
          navigate('/articles')
          return
        }
        setArticle(art)
        
        // 加载分词
        const segs = await api.getSegments(parseInt(articleId), practiceMode)
        if (segs.length === 0) {
          alert('请先对文章进行分词')
          navigate(`/segment/${articleId}`)
          return
        }
        setSegments(segs.map(s => s.content))
        
        // 检查是否有保存的进度
        const progress = await api.getProgress(userName, parseInt(articleId), practiceMode)
        if (progress && progress.current_index > 0) {
          setContinueFromProgress(true)
          // 暂时不自动加载，等用户选择
        }
        
      } catch (error) {
        console.error('Error loading data:', error)
        alert('加载数据失败')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [articleId, practiceMode, userName, navigate])
  
  // 自动聚焦输入框
  useEffect(() => {
    if (!showSettings && !isCompleted && !showResult && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, showSettings, isCompleted, showResult])

  // 开始练习
  const startPractice = useCallback(async (continuePractice: boolean) => {
    let list = [...segments]
    let savedProgress = null
    
    // 如果继续练习，加载进度
    if (continuePractice) {
      savedProgress = await api.getProgress(userName, parseInt(articleId!), practiceMode)
      if (savedProgress) {
        try {
          const savedList = JSON.parse(savedProgress.words_list)
          if (savedList.length > 0) {
            list = savedList
            setCurrentIndex(savedProgress.current_index)
            statsRef.current = {
              correct: savedProgress.correct_count,
              incorrect: savedProgress.incorrect_count
            }
          }
        } catch {
          // 解析失败，使用完整列表
        }
      }
    } else {
      // 清除旧进度
      await api.clearProgress(userName, parseInt(articleId!), practiceMode)
      statsRef.current = { correct: 0, incorrect: 0 }
    }
    
    // 应用数量限制
    if (practiceCount && practiceCount < list.length) {
      list = list.slice(0, practiceCount)
    }
    
    setPracticeList(list)
    setShowSettings(false)
    
    // 只有在新练习时才重置为0，继续练习时保持之前的进度
    if (!continuePractice) {
      setCurrentIndex(0)
    }
    
    // 播放当前索引的音频
    const currentIdx = continuePractice ? (savedProgress?.current_index || 0) : 0
    if (list.length > 0 && list[currentIdx]) {
      // 延迟一点播放，确保UI已更新
      setTimeout(() => playAudio(list[currentIdx]), 100)
    }
  }, [segments, practiceCount, userName, articleId, practiceMode])

  // 播放音频
  const playAudio = async (text: string) => {
    if (isPlaying) return
    
    try {
      setIsPlaying(true)
      await api.speak(text, 175)
    } catch (error) {
      console.error('TTS error:', error)
      // 回退到 Web Speech API
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'en-US'
        utterance.rate = 175 / 150 // 转换语速
        speechSynthesis.speak(utterance)
      }
    } finally {
      // 延迟重置状态，确保音频播放完成
      setTimeout(() => setIsPlaying(false), 500)
    }
  }

  // 重新播放
  const handleReplay = () => {
    if (practiceList[currentIndex]) {
      playAudio(practiceList[currentIndex])
    }
  }

  // 检查答案
  const checkAnswer = async () => {
    if (!userInput.trim()) return
    
    const correctAnswer = practiceList[currentIndex]
    const normalizedInput = userInput.trim().toLowerCase()
    const normalizedAnswer = correctAnswer.toLowerCase()
    
    const correct = normalizedInput === normalizedAnswer
    setIsCorrect(correct)
    setShowResult(true)
    
    // 更新统计
    if (correct) {
      statsRef.current.correct++
    } else {
      statsRef.current.incorrect++
      
      // 添加到错词本
      try {
        // 注意：这里需要 segment_id，暂时用 0 代替
        // 实际应该从数据库查询 segment id
        await api.addMistake(userName, 0, correctAnswer, practiceMode)
      } catch (error) {
        console.error('Error adding mistake:', error)
      }
    }
    
    // 保存进度
    await saveProgress()
  }

  // 保存进度
  const saveProgress = async () => {
    try {
      await api.saveProgress(
        userName,
        parseInt(articleId!),
        practiceMode,
        currentIndex + 1, // 保存下一个位置
        practiceList,
        statsRef.current.correct,
        statsRef.current.incorrect
      )
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  // 下一个
  const handleNext = () => {
    setShowResult(false)
    setUserInput('')
    
    if (currentIndex + 1 >= practiceList.length) {
      // 完成
      completePractice()
    } else {
      setCurrentIndex(prev => prev + 1)
      playAudio(practiceList[currentIndex + 1])
    }
  }

  // 完成练习
  const completePractice = async () => {
    setIsCompleted(true)
    
    // 清除进度
    await api.clearProgress(userName, parseInt(articleId!), practiceMode)
    
    // 计算得分
    const total = statsRef.current.correct + statsRef.current.incorrect
    const accuracy = total > 0 ? (statsRef.current.correct / total) * 100 : 0
    const score = accuracy // 可以加入速度因素
    
    // 保存记录
    try {
      await api.saveRecord(
        userName,
        parseInt(articleId!),
        practiceMode,
        score,
        accuracy,
        0 // WPM 暂时为 0
      )
    } catch (error) {
      console.error('Error saving record:', error)
    }
  }

  // 重新开始
  const handleRestart = () => {
    setIsCompleted(false)
    setShowSettings(true)
    setCurrentIndex(0)
    statsRef.current = { correct: 0, incorrect: 0 }
  }

  // 返回文章列表
  const handleBack = () => {
    navigate('/articles')
  }
  
  // 使用 ref 存储最新的键盘处理函数，避免闭包陈旧问题
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {})
  
  keyHandlerRef.current = (e: KeyboardEvent) => {
    // 设置界面
    if (showSettings) {
      if (e.key === 'Enter') {
        e.preventDefault()
        startPractice(false)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        navigate('/articles')
      }
      return
    }
    
    // 完成界面
    if (isCompleted) {
      if (e.key === 'Enter') {
        e.preventDefault()
        setIsCompleted(false)
        setShowSettings(true)
        setCurrentIndex(0)
        statsRef.current = { correct: 0, incorrect: 0 }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        navigate('/articles')
      }
      return
    }
    
    // 练习界面
    if (e.key === 'Escape') {
      e.preventDefault()
      navigate('/articles')
      return
    }
    
    // 输入中：Tab 键重新播放音频
    if (!showResult && e.key === 'Tab') {
      e.preventDefault()
      handleReplay()
    }
    // 注意：Enter 键由 input 的 onKeyDown 处理，这里不处理
  }
  
  // 全局键盘事件监听 - 只注册一次，通过 ref 始终调用最新的处理函数
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyHandlerRef.current(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (isLoading) {
    return <div className="loading">加载中...</div>
  }

  // 完成界面
  if (isCompleted) {
    const total = statsRef.current.correct + statsRef.current.incorrect
    const accuracy = total > 0 ? Math.round((statsRef.current.correct / total) * 100) : 0
    
    return (
      <div className="practice-page completed">
        <div className="completion-card">
          <h1>🎉 练习完成！</h1>
          
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{statsRef.current.correct}</span>
              <span className="stat-label">正确</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statsRef.current.incorrect}</span>
              <span className="stat-label">错误</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{accuracy}%</span>
              <span className="stat-label">正确率</span>
            </div>
          </div>
          
          <div className="completion-actions">
            <button className="btn btn-primary" onClick={handleRestart} type="button">
              重新练习 (Enter)
            </button>
            <button className="btn btn-secondary" onClick={handleBack} type="button">
              返回文章列表 (Esc)
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 设置界面
  if (showSettings) {
    return (
      <div className="practice-page settings">
        <div className="settings-card">
          <h1>{getModeTitle(practiceMode)}</h1>
          <h2>{article?.title}</h2>
          
          <p className="segment-count">
            共 {segments.length} 个{getModeUnit(practiceMode)}
          </p>
          
          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="count">练习数量</label>
              <select
                id="count"
                value={practiceCount || 'all'}
                onChange={(e) => setPracticeCount(e.target.value === 'all' ? null : parseInt(e.target.value))}
              >
                <option value="all">全部 ({segments.length}个)</option>
                <option value="10">前10个</option>
                <option value="20">前20个</option>
                <option value="50">前50个</option>
              </select>
            </div>
          </div>
          
          <div className="settings-actions">
            {continueFromProgress && (
              <button
                className="btn btn-success"
                onClick={() => startPractice(true)}
                type="button"
              >
                继续上次练习
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => startPractice(false)}
              type="button"
            >
              从头开始 (Enter)
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleBack}
              type="button"
            >
              返回 (Esc)
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 练习界面
  return (
    <div className="practice-page">
      <div className="practice-header">
        <h1>{getModeTitle(practiceMode)}</h1>
        <div className="progress-info">
          <span>{currentIndex + 1} / {practiceList.length}</span>
          <span className="stats">
            ✓ {statsRef.current.correct} ✗ {statsRef.current.incorrect}
          </span>
        </div>
        <div className="keyboard-hints">
          <span className="hint">Tab: 重播</span>
          <span className="hint">Enter: {showResult ? '继续' : '提交'}</span>
        </div>
      </div>

      <div className="practice-content">
        <div className="audio-section">
          <button
            className="btn-play"
            onClick={handleReplay}
            disabled={isPlaying}
            type="button"
          >
            {isPlaying ? '🔊 播放中...' : '🔊 再听一遍 (Tab)'}
          </button>
        </div>

        <div className="input-section">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                if (!showResult) {
                  checkAnswer()
                } else {
                  handleNext()
                }
              }
            }}
            placeholder={`输入你听到的${getModeUnit(practiceMode)}...`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          
          {!showResult ? (
            <button
              className="btn btn-primary"
              onClick={checkAnswer}
              disabled={!userInput.trim()}
              type="button"
            >
              确认 (Enter)
            </button>
          ) : (
            <div className="result-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setUserInput('')
                  setShowResult(false)
                  inputRef.current?.focus()
                }}
                type="button"
              >
                重试
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNext}
                type="button"
              >
                {currentIndex + 1 >= practiceList.length ? '完成 (Enter)' : '下一个 (Enter)'}
              </button>
            </div>
          )}
        </div>

        {showResult && (
          <div className={`result-section ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="result-status">
              {isCorrect ? '✅ 正确！' : '❌ 错误'}
            </div>
            {!isCorrect && (
              <div className="diff-comparison">
                <div className="diff-row">
                  <span className="diff-label">你的输入：</span>
                  <DiffDisplay 
                    display={diffChars(userInput, practiceList[currentIndex]).userDisplay} 
                    type="user"
                  />
                </div>
                <div className="diff-row">
                  <span className="diff-label">正确答案：</span>
                  <DiffDisplay 
                    display={diffChars(userInput, practiceList[currentIndex]).answerDisplay} 
                    type="answer"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getModeTitle(mode: PracticeMode): string {
  const titles = {
    word: '单词听写',
    phrase: '短语听写',
    sentence: '短句听写'
  }
  return titles[mode] || '听写练习'
}

function getModeUnit(mode: PracticeMode): string {
  const units = {
    word: '单词',
    phrase: '短语',
    sentence: '短句'
  }
  return units[mode] || '项'
}

/**
 * 对比用户输入和正确答案，返回字符级别的差异
 */
function diffChars(input: string, answer: string): { 
  userDisplay: { char: string; status: 'correct' | 'wrong' | 'missing' }[]
  answerDisplay: { char: string; status: 'correct' | 'wrong' | 'extra' }[]
} {
  const inputLower = input.toLowerCase()
  const answerLower = answer.toLowerCase()
  
  const userDisplay: { char: string; status: 'correct' | 'wrong' | 'missing' }[] = []
  const answerDisplay: { char: string; status: 'correct' | 'wrong' | 'extra' }[] = []
  
  const maxLen = Math.max(inputLower.length, answerLower.length)
  
  for (let i = 0; i < maxLen; i++) {
    const inputChar = inputLower[i]
    const answerChar = answerLower[i]
    
    if (i < inputLower.length && i < answerLower.length) {
      if (inputChar === answerChar) {
        userDisplay.push({ char: input[i], status: 'correct' })
        answerDisplay.push({ char: answer[i], status: 'correct' })
      } else {
        userDisplay.push({ char: input[i], status: 'wrong' })
        answerDisplay.push({ char: answer[i], status: 'wrong' })
      }
    } else if (i >= inputLower.length) {
      // 用户缺少的字符
      userDisplay.push({ char: '·', status: 'missing' })
      answerDisplay.push({ char: answer[i], status: 'wrong' })
    } else {
      // 用户多余的字符
      userDisplay.push({ char: input[i], status: 'wrong' })
      answerDisplay.push({ char: '·', status: 'extra' })
    }
  }
  
  return { userDisplay, answerDisplay }
}

/**
 * 显示差异的组件
 */
function DiffDisplay({ 
  display, 
  type 
}: { 
  display: { char: string; status: string }[]
  type: 'user' | 'answer'
}) {
  return (
    <span className={`diff-text ${type}`}>
      {display.map((item, index) => (
        <span 
          key={index} 
          className={`diff-char ${item.status}`}
        >
          {item.char === ' ' ? '\u00A0' : item.char}
        </span>
      ))}
    </span>
  )
}
