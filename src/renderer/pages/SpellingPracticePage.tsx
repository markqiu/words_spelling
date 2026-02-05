import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { Article, PracticeRecord } from '../../types'
import { VirtualKeyboard } from '../components/VirtualKeyboard'

type PracticeMode = 'all' | 'mistake'

const WORD_COUNT_OPTIONS = [10, 20, 30, 50, 100]

export function SpellingPracticePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [article, setArticle] = useState<Article | null>(null)
  const [words, setWords] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect' | 'completed'>('idle')
  const [startTime, setStartTime] = useState<number>(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })
  const [pressedKey, setPressedKey] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 错词本相关状态
  const [userName, setUserName] = useState<string>((location.state as { userName?: string })?.userName || '练习者')
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('all')
  const [wordCount, setWordCount] = useState<number>(50)
  const [isInMistakeList, setIsInMistakeList] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 检查当前单词是否在错词本中
  const checkMistakeStatus = useCallback(async (word: string) => {
    try {
      const isMistake = await window.electronAPI.isMistakeWord(userName, word)
      setIsInMistakeList(isMistake)
    } catch (error) {
      console.error('Check mistake status error:', error)
    }
  }, [userName])

  // 缓存选中的语音，确保整个练习过程中使用同一个声音
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  // 获取最佳英语语音（只选择一次并缓存）
  const getBestEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    // 如果已经有缓存的语音，直接返回
    if (selectedVoiceRef.current) {
      return selectedVoiceRef.current
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return null

    // 优先选择高质量的自然语音（优先女声）
    const preferredVoices = [
      'Samantha',           // macOS 女声（最优先）
      'Victoria',           // macOS 女声
      'Microsoft Zira',     // Windows 女声
      'Alex',               // macOS 男声
      'Daniel',             // 英式英语男声
      'Google US English',  // Google 英语
      'Microsoft David',    // Windows 男声
    ]

    // 首先尝试找到首选语音
    for (const name of preferredVoices) {
      const voice = voices.find(v => v.name.includes(name))
      if (voice) {
        selectedVoiceRef.current = voice
        return voice
      }
    }

    // 如果没有找到，选择英语语音
    const englishVoice = voices.find(v => v.lang.startsWith('en'))
    if (englishVoice) {
      selectedVoiceRef.current = englishVoice
    }
    return selectedVoiceRef.current
  }, [])

  // 初始化语音
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        // 语音列表还未加载，等待加载
        const handleVoicesChanged = () => {
          getBestEnglishVoice()
        }
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged
        return () => {
          window.speechSynthesis.onvoiceschanged = null
        }
      } else {
        getBestEnglishVoice()
      }
    }
  }, [getBestEnglishVoice])

  useEffect(() => {
    const loadArticle = async (articleId: number) => {
      try {
        setIsLoading(true)
        const art = await window.electronAPI.getArticleById(articleId)
        if (art) {
          setArticle(art)
          // 提取单词（按空格和标点分割）
          const extractedWords = art.content
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter((w: string) => w.length > 0 && /^[a-zA-Z]+$/.test(w))
            .map((w: string) => w.toLowerCase())
          // 去重
          const uniqueWords = [...new Set<string>(extractedWords)]

          // 根据练习模式获取需要练习的词汇列表
          let wordsToPractice: string[]
          if (practiceMode === 'mistake') {
            // 错词本模式：只练习错词 + 未掌握的词
            wordsToPractice = await window.electronAPI.getWordsToPractice(userName, articleId, uniqueWords)
            if (wordsToPractice.length === 0) {
              // 如果没有需要练习的词，显示提示并使用全部词汇
              alert('恭喜！您已经掌握了这篇文章的所有词汇，将使用全部词汇进行练习。')
              wordsToPractice = uniqueWords.slice(0, wordCount)
            }
          } else {
            // 全部词汇模式：使用所有单词（不过滤）
            wordsToPractice = uniqueWords.slice(0, wordCount)
          }

          setWords(wordsToPractice)
          setStartTime(Date.now())
          // 自动播放第一个单词并检查错词本状态
          const firstWord = wordsToPractice[0]
          if (firstWord) {
            checkMistakeStatus(firstWord)
            setTimeout(() => {
              window.electronAPI.speak(firstWord).catch(() => {
                // 原生 TTS 失败，使用 Web Speech API 作为备用
                if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel()
                  const utterance = new SpeechSynthesisUtterance(firstWord)
                  const voices = window.speechSynthesis.getVoices()
                  const voice = voices.find(v => v.name.includes('Samantha')) || 
                               voices.find(v => v.lang.startsWith('en')) || 
                               voices[0]
                  if (voice) utterance.voice = voice
                  utterance.lang = 'en-US'
                  utterance.rate = 0.9
                  window.speechSynthesis.speak(utterance)
                }
              })
            }, 500)
          }
        }
      } catch (error) {
        console.error('Load article error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // 确保语音已初始化并加载文章
    const initVoiceAndLoad = () => {
      getBestEnglishVoice()
      if (id) {
        loadArticle(parseInt(id))
      }
    }

    // 等待语音列表加载完成
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        // 语音列表还未加载，等待加载
        const handleVoicesChanged = () => {
          initVoiceAndLoad()
        }
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged
        return () => {
          window.speechSynthesis.onvoiceschanged = null
        }
      } else {
        // 语音列表已加载
        initVoiceAndLoad()
      }
    } else {
      // 不支持语音合成，直接加载文章
      if (id) {
        loadArticle(parseInt(id))
      }
    }
  }, [id, practiceMode, userName, checkMistakeStatus, wordCount, getBestEnglishVoice])

  // 当练习模式改变时，重新加载单词列表
  useEffect(() => {
    if (!article || !id) return

    const reloadWords = async () => {
      try {
        setIsLoading(true)
        const articleId = parseInt(id)

        // 重新提取单词
        const extractedWords = article.content
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 0 && /^[a-zA-Z]+$/.test(w))
          .map((w: string) => w.toLowerCase())
        const uniqueWords = [...new Set<string>(extractedWords)]

        // 根据练习模式获取需要练习的词汇列表
        let wordsToPractice: string[]
        if (practiceMode === 'mistake') {
          wordsToPractice = await window.electronAPI.getWordsToPractice(userName, articleId, uniqueWords)
          if (wordsToPractice.length === 0) {
            alert('恭喜！您已经掌握了这篇文章的所有词汇，将使用全部词汇进行练习。')
            wordsToPractice = uniqueWords.slice(0, wordCount)
          }
        } else {
          wordsToPractice = uniqueWords.slice(0, wordCount)
        }
        setStats({ correct: 0, incorrect: 0 })

        // 播放第一个单词
        const firstWord = wordsToPractice[0]
        if (firstWord) {
          checkMistakeStatus(firstWord)
          setTimeout(() => {
            window.electronAPI.speak(firstWord).catch(() => {
              // 原生 TTS 失败，使用 Web Speech API 作为备用
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel()
                const utterance = new SpeechSynthesisUtterance(firstWord)
                if (selectedVoiceRef.current) {
                  utterance.voice = selectedVoiceRef.current
                }
                utterance.lang = 'en-US'
                utterance.rate = 0.9
                utterance.pitch = 1.0
                utterance.volume = 1.0
                window.speechSynthesis.speak(utterance)
              }
            })
          }, 500)
        }
      } catch (error) {
        console.error('Reload words error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    reloadWords()
  }, [practiceMode, wordCount, article, id, userName, checkMistakeStatus])

  useEffect(() => {
    if (startTime > 0 && status !== 'completed') {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTime, status])

  // 统一语音播放函数 - 优先使用原生 TTS
  const speakWord = async (word: string) => {
    // 先停止之前的语音
    try {
      await window.electronAPI.stopSpeaking()
    } catch {
      // 忽略停止错误
    }

    // 优先使用原生 TTS（Electron 主进程）
    try {
      await window.electronAPI.speak(word)
      return
    } catch {
      console.log('Native TTS failed, falling back to Web Speech API')
    }

    // 备用：使用 Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()

      // 使用缓存的语音，如果没有缓存则重新选择
      if (!selectedVoiceRef.current) {
        const voices = window.speechSynthesis.getVoices()
        const preferredVoices = [
          'Samantha',           // macOS 女声（最优先）
          'Victoria',           // macOS 女声
          'Microsoft Zira',     // Windows 女声
          'Alex',               // macOS 男声
          'Daniel',             // 英式英语男声
          'Google US English',  // Google 英语
          'Microsoft David',    // Windows 男声
        ]

        for (const name of preferredVoices) {
          const voice = voices.find(v => v.name.includes(name))
          if (voice) {
            selectedVoiceRef.current = voice
            break
          }
        }

        if (!selectedVoiceRef.current) {
          selectedVoiceRef.current = voices.find(v => v.lang.startsWith('en')) || voices[0]
        }
      }

      const utterance = new SpeechSynthesisUtterance(word)
      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current
      }
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value)
    setStatus('idle')
    setShowAnswer(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    setPressedKey(e.code)
    if (e.key === 'Enter') {
      checkAnswer()
    }
  }

  const handleKeyUp = () => {
    setPressedKey('')
  }

  const checkAnswer = async () => {
    const currentWord = words[currentIndex]
    const isCorrect = userInput.trim().toLowerCase() === currentWord.toLowerCase()
    const articleId = parseInt(id || '0')

    if (isCorrect) {
      setStatus('correct')
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }))

      // 更新词汇掌握状态为已掌握
      try {
        await window.electronAPI.updateWordProgress(userName, articleId, currentWord, true)

        // 如果单词在错词本中，从错词本移除
        if (isInMistakeList) {
          await window.electronAPI.removeMistakeWord(userName, currentWord)
          setIsInMistakeList(false)
        }
      } catch (error) {
        console.error('Update progress error:', error)
      }

      setTimeout(() => {
        if (currentIndex < words.length - 1) {
          const nextIndex = currentIndex + 1
          setCurrentIndex(nextIndex)
          setUserInput('')
          setStatus('idle')
          setShowAnswer(false)
          speakWord(words[nextIndex]).catch(console.error)
          // 检查下一个单词是否在错词本中
          checkMistakeStatus(words[nextIndex])
        } else {
          completePractice()
        }
      }, 800)
    } else {
      setStatus('incorrect')
      setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))
      setShowAnswer(true)

      // 更新词汇掌握状态为未掌握
      try {
        await window.electronAPI.updateWordProgress(userName, articleId, currentWord, false)

        // 添加到错词本
        await window.electronAPI.addMistakeWord(userName, currentWord, articleId)
        setIsInMistakeList(true)
      } catch (error) {
        console.error('Add mistake word error:', error)
      }
    }
  }

  const completePractice = async () => {
    setStatus('completed')
    if (timerRef.current) clearInterval(timerRef.current)

    const totalWords = stats.correct + stats.incorrect + 1
    const accuracy = Math.round((stats.correct + 1) / totalWords * 100)
    const duration = Math.floor((Date.now() - startTime) / 1000)
    const wpm = Math.round((totalWords / duration) * 60)
    const score = Math.round((accuracy * wpm) / 10)

    if (article) {
      const record: PracticeRecord = {
        userName,
        articleId: article.id ?? 0,
        articleTitle: article.title,
        mode: 'spelling',
        accuracy,
        wpm,
        duration,
        score,
      }
      try {
        await window.electronAPI.savePracticeRecord(record)
      } catch (error) {
        console.error('Save record error:', error)
      }
    }
  }

  const handleReplay = () => {
    speakWord(words[currentIndex]).catch(console.error)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const totalAnswered = stats.correct + stats.incorrect
  const currentAccuracy = totalAnswered > 0 ? Math.round(stats.correct / totalAnswered * 100) : 100
  const wpm = elapsedTime > 0 ? Math.round((totalAnswered / elapsedTime) * 60) : 0

  if (isLoading || !article) {
    return <div style={styles.loading}>加载中...</div>
  }

  if (status === 'completed') {
    const totalWords = words.length
    const finalAccuracy = Math.round(stats.correct / totalWords * 100)
    const finalScore = Math.round((finalAccuracy * wpm) / 10)

    return (
      <div style={styles.container}>
        <div style={styles.resultCard}>
          <h2 style={styles.resultTitle}>🎉 练习完成！</h2>
          <div style={styles.resultStats}>
            <div style={styles.resultStat}>
              <div style={styles.resultStatValue}>{finalScore}</div>
              <div style={styles.resultStatLabel}>总得分</div>
            </div>
            <div style={styles.resultStat}>
              <div style={styles.resultStatValue}>{finalAccuracy}%</div>
              <div style={styles.resultStatLabel}>准确率</div>
            </div>
            <div style={styles.resultStat}>
              <div style={styles.resultStatValue}>{wpm}</div>
              <div style={styles.resultStatLabel}>WPM</div>
            </div>
            <div style={styles.resultStat}>
              <div style={styles.resultStatValue}>{formatTime(elapsedTime)}</div>
              <div style={styles.resultStatLabel}>用时</div>
            </div>
          </div>
          <div style={styles.resultActions}>
            <button type="button" onClick={() => navigate('/articles')} style={{ ...styles.btn, ...styles.btnPrimary }}>
              返回文章列表
            </button>
            <button type="button" onClick={() => window.location.reload()} style={{ ...styles.btn, ...styles.btnSecondary }}>
              再练一次
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>🎯 拼写练习</h1>
          <div style={styles.settings}>
            <div style={styles.userNameInput}>
              <span style={styles.inputLabel}>练习者：</span>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="输入你的名字"
                style={styles.smallInput}
                disabled={currentIndex > 0 || status !== 'idle'}
              />
            </div>
            <div style={styles.modeSelect}>
              <span style={styles.inputLabel}>模式：</span>
              <select
                value={practiceMode}
                onChange={(e) => setPracticeMode(e.target.value as PracticeMode)}
                style={styles.select}
                disabled={currentIndex > 0 || status !== 'idle'}
              >
                <option value="all">全部词汇</option>
                <option value="mistake">错词本模式</option>
              </select>
            </div>
            <div style={styles.modeSelect}>
              <span style={styles.inputLabel}>词数：</span>
              <select
                value={wordCount}
                onChange={(e) => setWordCount(parseInt(e.target.value))}
                style={styles.select}
                disabled={currentIndex > 0 || status !== 'idle'}
              >
                {WORD_COUNT_OPTIONS.map(count => (
                  <option key={count} value={count}>{count}个词</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>进度</span>
            <span style={styles.statValue}>{currentIndex + 1} / {words.length}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>时间</span>
            <span style={styles.statValue}>{formatTime(elapsedTime)}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>准确率</span>
            <span style={{ ...styles.statValue, color: currentAccuracy >= 80 ? 'var(--success-color)' : 'var(--warning-color)' }}>
              {currentAccuracy}%
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>WPM</span>
            <span style={styles.statValue}>{wpm}</span>
          </div>
        </div>
      </div>

      <div style={styles.practiceCard}>
        <div style={styles.wordSection}>
          <button type="button" onClick={handleReplay} style={styles.speakerBtn}>
            🔊 播放语音
          </button>
          <p style={styles.wordHint}>请听语音，拼写单词</p>
          {isInMistakeList && (
            <div style={styles.mistakeBadge}>
              ⚠️ 错词本 - 需要重点练习
            </div>
          )}
        </div>

        <div style={styles.inputSection}>
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder="输入单词..."
            style={{
              ...styles.input,
              borderColor: status === 'correct' ? 'var(--success-color)' : status === 'incorrect' ? 'var(--error-color)' : 'var(--border-color)',
              backgroundColor: status === 'correct' ? 'rgba(76, 175, 80, 0.1)' : status === 'incorrect' ? 'rgba(244, 67, 54, 0.1)' : 'var(--card-bg)',
            }}
            data-autofocus="true"
          />
          {status === 'correct' && <span style={styles.correctMark}>✓ 正确!</span>}
          {status === 'incorrect' && (
            <div style={styles.incorrectSection}>
              <span style={styles.incorrectMark}>✗ 错误</span>
              {showAnswer && (
                <div style={styles.correctAnswer}>
                  正确答案: <strong>{words[currentIndex]}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={checkAnswer}
          disabled={!userInput.trim()}
          style={{ ...styles.btn, ...styles.btnPrimary, ...(!userInput.trim() ? styles.btnDisabled : {}) }}
        >
          检查 (Enter)
        </button>
      </div>

      <div style={styles.keyboardCard}>
        <h3 style={styles.keyboardTitle}>虚拟键盘</h3>
        <VirtualKeyboard pressedKey={pressedKey} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    fontSize: '16px',
    color: 'var(--text-secondary)',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  statsBar: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap' as const,
    padding: '12px 16px',
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  practiceCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '32px',
    textAlign: 'center' as const,
    marginBottom: '20px',
  },
  wordSection: {
    marginBottom: '24px',
  },
  speakerBtn: {
    padding: '16px 32px',
    fontSize: '18px',
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  wordHint: {
    marginTop: '12px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  inputSection: {
    marginBottom: '20px',
    position: 'relative' as const,
  },
  input: {
    width: '100%',
    maxWidth: '400px',
    padding: '16px 24px',
    fontSize: '24px',
    textAlign: 'center' as const,
    border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    transition: 'all 0.2s ease',
    textTransform: 'lowercase',
  },
  correctMark: {
    display: 'block',
    marginTop: '12px',
    fontSize: '18px',
    color: 'var(--success-color)',
    fontWeight: 600,
  },
  incorrectSection: {
    marginTop: '12px',
  },
  incorrectMark: {
    fontSize: '18px',
    color: 'var(--error-color)',
    fontWeight: 600,
  },
  correctAnswer: {
    marginTop: '8px',
    fontSize: '16px',
    color: 'var(--text-secondary)',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 32px',
    borderRadius: 'var(--radius)',
    fontSize: '16px',
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
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  keyboardCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '20px',
  },
  keyboardTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '12px',
    textAlign: 'center' as const,
  },
  resultCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '48px',
    textAlign: 'center' as const,
  },
  resultTitle: {
    fontSize: '28px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '32px',
  },
  resultStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '32px',
    flexWrap: 'wrap' as const,
    marginBottom: '32px',
  },
  resultStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    padding: '20px 32px',
    background: 'var(--bg-color)',
    borderRadius: 'var(--radius)',
  },
  resultStatValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: 'var(--primary-color)',
  },
  resultStatLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  resultActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  settings: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  userNameInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modeSelect: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  inputLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  smallInput: {
    padding: '6px 12px',
    fontSize: '14px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    width: '120px',
  },
  select: {
    padding: '6px 12px',
    fontSize: '14px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  mistakeBadge: {
    marginTop: '12px',
    padding: '8px 16px',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    color: 'var(--error-color)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 500,
  },
}
