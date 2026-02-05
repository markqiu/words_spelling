import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Article } from '../../types'
import { VirtualKeyboard } from '../components/VirtualKeyboard'

export function TypingPracticePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [startTime, setStartTime] = useState<number>(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })
  const [pressedKey, setPressedKey] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [, setConsecutiveErrors] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const loadArticle = async (articleId: number) => {
      try {
        const art = await window.electronAPI.getArticleById(articleId)
        if (art) {
          setArticle(art)
          setStartTime(Date.now())
        }
      } catch (error) {
        console.error('Load article error:', error)
      }
    }

    if (id) {
      loadArticle(parseInt(id))
    }
  }, [id])

  useEffect(() => {
    if (startTime > 0 && !isCompleted) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTime, isCompleted])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return
      setPressedKey(e.code)

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        if (!article) return
        const targetChar = article.content[currentIndex]
        // 归一化引号字符（智能引号转直引号）
        const normalizeChar = (char: string): string => {
          // 将各种智能引号转为直引号
          const code = char.charCodeAt(0)
          // U+2018 和 U+2019: 左右单引号 -> 直单引号
          if (code === 0x2018 || code === 0x2019) return "'"
          // U+201C 和 U+201D: 左右双引号 -> 直双引号
          if (code === 0x201C || code === 0x201D) return '"'
          return char
        }
        const normalizedInput = normalizeChar(e.key)
        const normalizedTarget = normalizeChar(targetChar)
        if (normalizedInput === normalizedTarget) {
          setStats(prev => ({ ...prev, correct: prev.correct + 1 }))
          setUserInput(prev => prev + e.key)
          setConsecutiveErrors(0)
          setShowHint(false)
          if (currentIndex < article.content.length - 1) {
            setCurrentIndex(prev => prev + 1)
          } else {
            setIsCompleted(true)
            if (timerRef.current) clearInterval(timerRef.current)
          }
        } else {
          setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))
          setConsecutiveErrors(prev => {
            const newCount = prev + 1
            if (newCount >= 3) {
              setShowHint(true)
            }
            return newCount
          })
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        if (userInput.length > 0) {
          setUserInput(prev => prev.slice(0, -1))
          setCurrentIndex(prev => prev - 1)
        }
      }
    }

    const handleKeyUp = () => {
      setPressedKey('')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isCompleted, currentIndex, userInput, article])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const totalChars = stats.correct + stats.incorrect
  const accuracy = totalChars > 0 ? Math.round(stats.correct / totalChars * 100) : 100
  const wpm = elapsedTime > 0 ? Math.round((stats.correct / 5) / (elapsedTime / 60)) : 0
  const progress = article ? Math.round((currentIndex / article.content.length) * 100) : 0

  // 背诵模式：只显示已输入的内容，完全不显示待输入字符
  const renderText = () => {
    if (!article) return null

    const chars = article.content.split('')
    // 只显示已输入的字符，完全不显示下一个字符
    const visibleEnd = Math.min(userInput.length, chars.length)
    const visibleChars = chars.slice(0, visibleEnd)

    return (
      <>
        {/* 显示已输入的正确内容 */}
        {visibleChars.map((char, index) => {
          const uniqueKey = `char-${article.id}-${index}-${char}`

          // 处理换行
          if (char === '\n') {
            return <br key={uniqueKey} />
          }

          return (
            <span key={uniqueKey} style={styles.charCorrect}>
              {char}
            </span>
          )
        })}
        {/* 提示：连续输错3次后显示当前字符 */}
        {showHint && currentIndex < chars.length && (
          <span style={styles.hintBox}>
            提示：下一个字符是 "{chars[currentIndex] === '\n' ? '回车' : chars[currentIndex]}"
          </span>
        )}
        {/* 光标位置（不显示字符，只显示光标提示） */}
        {currentIndex < chars.length && (
          <span style={styles.charCursor}>|</span>
        )}
        {/* 显示未显示部分的提示 */}
        {visibleEnd < chars.length && (
          <span style={styles.moreIndicator}>...（剩余 {chars.length - visibleEnd} 字符）</span>
        )}
      </>
    )
  }

  if (!article) {
    return <div style={styles.loading}>加载中...</div>
  }

  if (isCompleted) {
    const finalAccuracy = Math.round((stats.correct + 1) / (stats.correct + stats.incorrect + 1) * 100)
    const finalWpm = elapsedTime > 0 ? Math.round(((stats.correct + 1) / 5) / (elapsedTime / 60)) : 0
    const finalScore = Math.round((finalAccuracy * finalWpm) / 10)

    return (
      <div style={styles.container}>
        <div style={styles.resultCard}>
          <h2 style={styles.resultTitle}>🎉 背诵完成！</h2>
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
              <div style={styles.resultStatValue}>{finalWpm}</div>
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
        <h1 style={styles.title}>⌨️ 背诵练习: {article.title}</h1>
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>进度</span>
            <span style={styles.statValue}>{progress}%</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>时间</span>
            <span style={styles.statValue}>{formatTime(elapsedTime)}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>准确率</span>
            <span style={{ ...styles.statValue, color: accuracy >= 80 ? 'var(--success-color)' : 'var(--warning-color)' }}>
              {accuracy}%
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>WPM</span>
            <span style={styles.statValue}>{wpm}</span>
          </div>
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
      </div>

      <div ref={containerRef} style={styles.textCard}>
        <div style={styles.textContainer}>
          {renderText()}
        </div>
      </div>

      <div style={styles.keyboardCard}>
        <h3 style={styles.keyboardTitle}>虚拟键盘</h3>
        <VirtualKeyboard pressedKey={pressedKey} />
      </div>

      <div style={styles.tipCard}>
        <p style={styles.tipText}>
          💡 背诵模式: 文章内容会随着输入逐步显示。请根据已显示的内容和记忆继续输入，按退格键可删除错误输入
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
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
    marginBottom: '20px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  statsBar: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap' as const,
    marginBottom: '12px',
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
  progressBar: {
    height: '6px',
    backgroundColor: 'var(--border-color)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--primary-color)',
    transition: 'width 0.2s ease',
  },
  textCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '24px',
    marginBottom: '20px',
    minHeight: '300px',
    maxHeight: '400px',
    overflow: 'auto',
    outline: 'none',
  },
  textContainer: {
    fontSize: '18px',
    lineHeight: 1.8,
    fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word' as const,
  },
  charCorrect: {
    color: 'var(--success-color)',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  charCursor: {
    color: 'var(--primary-color)',
    fontWeight: 'bold',
  },
  moreIndicator: {
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    marginLeft: '8px',
    opacity: 0.7,
  },
  hintBox: {
    display: 'inline-block',
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    marginTop: '12px',
    border: '1px solid #ffc107',
  },
  keyboardCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '20px',
    marginBottom: '16px',
  },
  keyboardTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '12px',
    textAlign: 'center' as const,
  },
  tipCard: {
    background: 'rgba(74, 144, 217, 0.1)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    borderLeft: '4px solid var(--primary-color)',
  },
  tipText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
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
}
