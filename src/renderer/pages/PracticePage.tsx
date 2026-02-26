import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../utils/api'
import './PracticePage.css'

type PracticeMode = 'word' | 'phrase' | 'sentence'

interface PracticeStats {
  correct: number
  incorrect: number
}

// 智能练习列表项（包含 segment_id）
interface PracticeItem {
  segmentId: number
  content: string
  segmentType: string
  masteryLevel: number
  isNew: boolean
}

// 练习进度保存接口
interface PracticeProgress {
  userName: string
  articleId: number
  practiceMode: PracticeMode
  practiceLimit: number
  practiceList: PracticeItem[]
  currentIndex: number
  stats: PracticeStats
  startTime: number
  savedAt: number
}

// 获取进度存储 key
const getProgressKey = (userName: string, articleId: string, mode: string) => 
  `practice_progress_${userName}_${articleId}_${mode}`

// 保存进度到 localStorage
const saveProgress = (progress: PracticeProgress) => {
  try {
    const key = getProgressKey(progress.userName, String(progress.articleId), progress.practiceMode)
    localStorage.setItem(key, JSON.stringify(progress))
  } catch (e) {
    console.error('Failed to save progress:', e)
  }
}

// 加载进度
const loadProgress = (userName: string, articleId: string, mode: string): PracticeProgress | null => {
  try {
    const key = getProgressKey(userName, articleId, mode)
    const data = localStorage.getItem(key)
    if (data) {
      return JSON.parse(data) as PracticeProgress
    }
  } catch (e) {
    console.error('Failed to load progress:', e)
  }
  return null
}

// 清除进度
const clearProgress = (userName: string, articleId: string, mode: string) => {
  try {
    const key = getProgressKey(userName, articleId, mode)
    localStorage.removeItem(key)
  } catch (e) {
    console.error('Failed to clear progress:', e)
  }
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
  const [practiceLimit, setPracticeLimit] = useState(20) // 每次练习的单词数量
  const [showSettings, setShowSettings] = useState(true)
  
  // 统计
  const statsRef = useRef<PracticeStats>({ correct: 0, incorrect: 0 })
  const [isCompleted, setIsCompleted] = useState(false)
  
  // 强制重试模式：当还没有错误时，答错必须改对才能继续
  const [mustRetryMode, setMustRetryMode] = useState(false)
  const startTimeRef = useRef<number>(0) // 记录开始时间
  const [elapsedTime, setElapsedTime] = useState(0) // 经过的时间（秒）
  
  // 当前练习的片段列表（智能调度）
  const [practiceList, setPracticeList] = useState<PracticeItem[]>([])
  
  // 保存的进度（用于显示继续选项）
  const [savedProgress, setSavedProgress] = useState<PracticeProgress | null>(null)
  
  // 输入框引用
  const inputRef = useRef<HTMLInputElement>(null)

  // 加载文章和分词，同时检查是否有保存的进度
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
        
        // 检查是否有保存的进度（24小时内有效）
        const progress = loadProgress(userName, articleId, practiceMode)
        if (progress && Date.now() - progress.savedAt < 24 * 60 * 60 * 1000) {
          setSavedProgress(progress)
        } else if (progress) {
          // 超过24小时，清除旧进度
          clearProgress(userName, articleId, practiceMode)
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
  
  // 当答对时，确保退出强制重试模式
  useEffect(() => {
    if (isCorrect && mustRetryMode) {
      setMustRetryMode(false)
    }
  }, [isCorrect, mustRetryMode])

  // 计时器
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    
    // 只有在练习中（不在设置界面、完成界面、结果界面）才计时
    if (!showSettings && !isCompleted && !showResult) {
      intervalId = setInterval(() => {
        if (startTimeRef.current > 0) {
          setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }
      }, 1000)
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [showSettings, isCompleted, showResult])

  // 开始练习（智能调度模式）
  const startPractice = useCallback(async () => {
    if (!articleId) return
    
    const numId = parseInt(articleId)
    
    try {
      // 获取所有单词（limit=0 表示全部），按记忆曲线排序
      const response = await api.getScheduledWords(userName, numId, practiceMode, 0)
      
      if (response.words.length === 0) {
        alert('该文章没有可练习的单词，请先进行分词')
        return
      }
      
      // 转换为 PracticeItem 格式
      const allWords: PracticeItem[] = response.words.map(w => ({
        segmentId: w.segment_id,
        content: w.content,
        segmentType: w.segment_type,
        masteryLevel: w.mastery_level,
        isNew: w.is_new
      }))
      
      // 根据选择的数量截取（0 表示全部）
      const list = practiceLimit === 0 ? allWords : allWords.slice(0, practiceLimit)
      
      setPracticeList(list)
      setShowSettings(false)
      setCurrentIndex(0)
      statsRef.current = { correct: 0, incorrect: 0 }
      setMustRetryMode(false)
      startTimeRef.current = Date.now() // 记录开始时间
      
      // 播放第一个单词
      if (list.length > 0) {
        setTimeout(() => playAudio(list[0].content), 100)
      }
    } catch (error) {
      console.error('Error starting practice:', error)
      alert('加载练习内容失败')
    }
  }, [userName, articleId, practiceMode, practiceLimit])

  // 继续练习（恢复保存的进度）
  const resumePractice = useCallback(() => {
    if (!savedProgress) return
    
    setPracticeList(savedProgress.practiceList)
    setPracticeLimit(savedProgress.practiceLimit)
    setShowSettings(false)
    setCurrentIndex(savedProgress.currentIndex)
    statsRef.current = savedProgress.stats
    startTimeRef.current = savedProgress.startTime
    setMustRetryMode(false)
    setSavedProgress(null)
    
    // 播放当前单词
    if (savedProgress.practiceList.length > savedProgress.currentIndex) {
      setTimeout(() => playAudio(savedProgress.practiceList[savedProgress.currentIndex].content), 100)
    }
  }, [savedProgress])

  // 播放音频
  const playAudio = async (text: string) => {
    // 停止任何正在播放的
    try {
      await api.stopSpeaking()
    } catch (e) {
      // 忽略错误
    }
    speechSynthesis.cancel()
    
    setIsPlaying(true)
    
    try {
      console.log('Playing audio:', text)
      await api.speak(text, 175)
      console.log('Audio finished:', text)
    } catch (error) {
      console.error('TTS error, falling back to Web Speech API:', error)
      // 回退到 Web Speech API
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 1.0
      speechSynthesis.speak(utterance)
    }
    
    // 延迟重置播放状态
    setTimeout(() => {
      setIsPlaying(false)
    }, 1000)
  }

  // 重新播放
  const handleReplay = () => {
    if (practiceList[currentIndex]) {
      playAudio(practiceList[currentIndex].content)
    }
  }

  // 检查答案
  const checkAnswer = async () => {
    if (!userInput.trim() || !articleId) return
    
    const currentItem = practiceList[currentIndex]
    const correctAnswer = currentItem.content
    const normalizedInput = userInput.trim().toLowerCase()
    const normalizedAnswer = correctAnswer.toLowerCase()
    
    const correct = normalizedInput === normalizedAnswer
    setIsCorrect(correct)
    setShowResult(true)
    
    // 更新统计
    if (correct) {
      statsRef.current.correct++
      // 答对了，退出强制重试模式（useEffect 也会确保这一点）
      setMustRetryMode(false)
    } else {
      statsRef.current.incorrect++
      // 答错了，进入强制重试模式（必须改对才能继续）
      setMustRetryMode(true)
    }
    
    // 更新单词熟练度（SM-2 算法）
    try {
      await api.updateWordMastery(
        userName,
        currentItem.segmentId,
        currentItem.content,
        currentItem.segmentType,
        correct
      )
    } catch (error) {
      console.error('Error updating mastery:', error)
    }
  }
  
  // 重试当前单词（不清空输入，让用户可以修改）
  const handleRetry = () => {
    // 不清空输入，让用户可以在原答案基础上修改
    setShowResult(false)
    inputRef.current?.focus()
    // 选中全部文本，方便用户直接重新输入
    inputRef.current?.select()
  }

  // 下一个
  const handleNext = () => {
    setShowResult(false)
    setUserInput('')
    setMustRetryMode(false) // 进入下一个单词时重置强制重试状态
    
    if (currentIndex + 1 >= practiceList.length) {
      // 完成
      completePractice()
    } else {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      playAudio(practiceList[nextIndex].content)
      
      // 保存进度
      if (articleId) {
        saveProgress({
          userName,
          articleId: parseInt(articleId),
          practiceMode,
          practiceLimit,
          practiceList,
          currentIndex: nextIndex,
          stats: { ...statsRef.current },
          startTime: startTimeRef.current,
          savedAt: Date.now()
        })
      }
    }
  }

  // 完成练习
  const completePractice = async () => {
    if (!articleId) return
    
    // 清除保存的进度
    clearProgress(userName, articleId, practiceMode)
    
    setIsCompleted(true)
    
    // 计算得分和时长
    const total = statsRef.current.correct + statsRef.current.incorrect
    const accuracy = total > 0 ? (statsRef.current.correct / total) * 100 : 0
    const score = accuracy
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    
    // 保存记录（排行榜）
    try {
      await api.saveRecord(
        userName,
        parseInt(articleId),
        practiceMode,
        score,
        accuracy,
        0
      )
      
      // 保存练习历史（包含WPM）
      await api.savePracticeHistory(
        userName,
        parseInt(articleId),
        practiceMode,
        statsRef.current.correct,
        statsRef.current.incorrect,
        durationSeconds
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
        startPractice()
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
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    const wpm = durationSeconds > 0 ? ((total / durationSeconds) * 60).toFixed(1) : '0.0'
    
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
            <div className="stat-item">
              <span className="stat-value">{wpm}</span>
              <span className="stat-label">单词/分钟</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{Math.floor(durationSeconds / 60)}:{(durationSeconds % 60).toString().padStart(2, '0')}</span>
              <span className="stat-label">用时</span>
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
          
          {/* 显示继续练习选项 */}
          {savedProgress && (
            <div className="resume-prompt">
              <div className="resume-info">
                <span className="resume-icon">📝</span>
                <span>检测到未完成的练习</span>
                <span className="resume-detail">
                  第 {savedProgress.currentIndex + 1} / {savedProgress.practiceList.length} 个
                  （已答对 {savedProgress.stats.correct} 个）
                </span>
              </div>
              <div className="resume-actions">
                <button
                  className="btn btn-primary resume-btn"
                  onClick={resumePractice}
                  type="button"
                >
                  继续练习
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (articleId) {
                      clearProgress(userName, articleId, practiceMode)
                    }
                    setSavedProgress(null)
                  }}
                  type="button"
                >
                  重新开始
                </button>
              </div>
            </div>
          )}
          
          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="limit">本次练习数量</label>
              <select
                id="limit"
                value={practiceLimit}
                onChange={(e) => setPracticeLimit(parseInt(e.target.value))}
              >
                <option value="0">全部</option>
                <option value="10">10个</option>
                <option value="20">20个</option>
                <option value="30">30个</option>
                <option value="50">50个</option>
                <option value="60">60个</option>
                <option value="80">80个</option>
                <option value="100">100个</option>
                <option value="120">120个</option>
                <option value="150">150个</option>
                <option value="180">180个</option>
                <option value="200">200个</option>
              </select>
            </div>
            <p className="hint-text">
              系统会对所有单词按记忆曲线排序，优先练习最需要复习的单词
            </p>
          </div>
          
          <div className="settings-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                if (savedProgress && articleId) {
                  clearProgress(userName, articleId, practiceMode)
                  setSavedProgress(null)
                }
                startPractice()
              }}
              type="button"
            >
              {savedProgress ? '重新开始练习' : '开始练习'} (Enter)
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
          <span className="timer">
            ⏱️ {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
          </span>
          <span className="wpm-stats">
            ⚡ {elapsedTime > 0 ? ((statsRef.current.correct + statsRef.current.incorrect) / elapsedTime * 60).toFixed(1) : '0.0'} WPM
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
                } else if (mustRetryMode && !isCorrect) {
                  // 强制重试模式且错误时，按 Enter 重试
                  handleRetry()
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
                onClick={handleRetry}
                type="button"
              >
                重试
              </button>
              {/* 只有在强制重试模式且错误时，不显示"下一个"按钮 */}
              {!(mustRetryMode && !isCorrect) && (
                <button
                  className="btn btn-primary"
                  onClick={handleNext}
                  type="button"
                >
                  {currentIndex + 1 >= practiceList.length ? '完成 (Enter)' : '下一个 (Enter)'}
                </button>
              )}
            </div>
          )}
        </div>

        {showResult && (
          <div className={`result-section ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="result-status">
              {isCorrect ? '✅ 正确！' : '❌ 错误'}
            </div>
            {!isCorrect && (
              <>
                <div className="diff-comparison">
                  <div className="diff-row">
                    <span className="diff-label">你的输入：</span>
                    <DiffDisplay 
                      display={diffChars(userInput, practiceList[currentIndex].content).userDisplay} 
                      type="user"
                    />
                  </div>
                  <div className="diff-row">
                    <span className="diff-label">正确答案：</span>
                    <DiffDisplay 
                      display={diffChars(userInput, practiceList[currentIndex].content).answerDisplay} 
                      type="answer"
                    />
                  </div>
                </div>
                {mustRetryMode && (
                  <div className="must-retry-hint">
                    💪 答错了，请修改正确后继续！
                  </div>
                )}
              </>
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
