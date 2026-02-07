import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { Article, PracticeRecord } from '../../types'
import { extractPracticeItems, splitIntoChunks } from '../../utils/phraseExtractor'

export function PhrasePracticePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [article, setArticle] = useState<Article | null>(null)
  const [phrases, setPhrases] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect' | 'completed'>('idle')
  const [startTime, setStartTime] = useState<number>(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })
  const [showAnswer, setShowAnswer] = useState(false)
  const [practiceMode, setPracticeMode] = useState<'sentence' | 'phrase'>('sentence')
  const [isLoading, setIsLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const statsRef = useRef({ correct: 0, incorrect: 0 })
  const autoPlayTimerRef = useRef<number | null>(null)
  const hasCheckedProgressRef = useRef(false)
  const isRestoringProgressRef = useRef(false)
  // 世代计数器：每次 practiceMode/id 变化时递增，旧的异步回调通过比对世代号来判断自身是否已过期
  const generationRef = useRef(0)
  const checkAnswerTimerRef = useRef<number | null>(null)
  // speakPhrase 调用计数器：每次调用 speakPhrase 时递增，await 之后检查是否过期
  const speakIdRef = useRef(0)

  const [userName] = useState<string>((location.state as { userName?: string })?.userName || '练习者')

  // 缓存选中的语音
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const getBestEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (selectedVoiceRef.current) return selectedVoiceRef.current

    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return null

    const preferredVoices = ['Samantha', 'Victoria', 'Microsoft Zira', 'Alex', 'Daniel']
    for (const name of preferredVoices) {
      const voice = voices.find(v => v.name.includes(name))
      if (voice) {
        selectedVoiceRef.current = voice
        return voice
      }
    }

    const englishVoice = voices.find(v => v.lang.startsWith('en'))
    if (englishVoice) selectedVoiceRef.current = englishVoice
    return selectedVoiceRef.current
  }, [])

  const speakPhrase = useCallback(async (phrase: string) => {
    // 每次调用递增 ID，让更早的异步 speakPhrase 在 await 后能检测到自己已过期
    speakIdRef.current += 1
    const myId = speakIdRef.current

    // 同时停止两种 TTS，防止残留声音
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    try {
      await window.electronAPI.stopSpeaking()
    } catch { }

    // 等一下让 stop 生效
    await new Promise(r => setTimeout(r, 100))

    // 如果在等待期间又有新的 speak 请求或模式切换，放弃本次
    if (speakIdRef.current !== myId) return

    // 只用原生 TTS，不做 fallback 到 Web Speech（避免两种声音）
    try {
      await window.electronAPI.speak(phrase)
    } catch {
      // 再次检查是否过期
      if (speakIdRef.current !== myId) return
      // 原生 TTS 完全失败才用 Web Speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        if (!selectedVoiceRef.current) getBestEnglishVoice()
        const utterance = new SpeechSynthesisUtterance(phrase)
        if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current
        utterance.lang = 'en-US'
        utterance.rate = 0.85
        window.speechSynthesis.speak(utterance)
      }
    }
  }, [getBestEnglishVoice])

  useEffect(() => {
    // 递增世代号，让所有旧的异步回调失效
    generationRef.current += 1
    const currentGen = generationRef.current

    const loadArticle = async () => {
      if (!id) return
      // 如果正在恢复进度（setPracticeMode 触发了 effect 重执行），跳过
      if (isRestoringProgressRef.current) return
      const articleId = parseInt(id)
      // 使用负数 articleId 区分短语听写进度和拼写练习进度
      const progressKey = -articleId
      try {
        setIsLoading(true)
        const art = await window.electronAPI.getArticleById(articleId)
        if (!art) {
          setIsLoading(false)
          return
        }
        setArticle(art)

        // 提取短句/短语
        const items = practiceMode === 'sentence'
          ? splitIntoChunks(art.content, 50)
          : extractPracticeItems(art.content, 50)

        // 检查是否有保存的练习进度
        const savedProgress = await window.electronAPI.getPracticeProgress(userName, progressKey)

        if (savedProgress && savedProgress.currentIndex > 0 && savedProgress.currentIndex < savedProgress.wordCount && !hasCheckedProgressRef.current) {
          hasCheckedProgressRef.current = true
          const shouldContinue = confirm(`检测到您上次听写到第 ${savedProgress.currentIndex + 1} 项，是否继续练习？\n（选择"取消"将重新开始）`)
          if (shouldContinue && savedProgress.wordsList && savedProgress.wordsList.length > 0) {
            // 恢复进度
            isRestoringProgressRef.current = true
            const restoredItems = savedProgress.wordsList
            const restoredMode = savedProgress.practiceMode as 'sentence' | 'phrase'
            setPhrases(restoredItems)
            setCurrentIndex(savedProgress.currentIndex)
            setPracticeMode(restoredMode)
            statsRef.current = {
              correct: savedProgress.correctCount,
              incorrect: savedProgress.incorrectCount
            }
            setStats({ ...statsRef.current })
            setStartTime(Date.now())
            // 播放当前项
            const currentItem = restoredItems[savedProgress.currentIndex]
            autoPlayTimerRef.current = window.setTimeout(() => {
              if (generationRef.current !== currentGen) return
              speakPhrase(currentItem)
            }, 600)
            setTimeout(() => { isRestoringProgressRef.current = false }, 100)
            return
          } else {
            // 用户选择重新开始，清除进度
            await window.electronAPI.clearPracticeProgress(userName, progressKey)
          }
        } else if (!hasCheckedProgressRef.current) {
          hasCheckedProgressRef.current = true
        }

        // 开始新练习
        setPhrases(items)
        setCurrentIndex(0)
        statsRef.current = { correct: 0, incorrect: 0 }
        setStats({ ...statsRef.current })
        setStartTime(Date.now())
        // 自动播放第一个（世代号防止 StrictMode 双重播放）
        if (items.length > 0) {
          autoPlayTimerRef.current = window.setTimeout(() => {
            if (generationRef.current !== currentGen) return
            speakPhrase(items[0])
          }, 600)
        }
        // 保存初始进度
        try {
          await window.electronAPI.savePracticeProgress(userName, progressKey, {
            currentIndex: 0,
            correctCount: 0,
            incorrectCount: 0,
            wordCount: items.length,
            practiceMode,
            wordsList: items
          })
        } catch (e) {
          console.error('Save initial progress error:', e)
        }
      } catch (error) {
        console.error('Load article error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    hasCheckedProgressRef.current = false
    loadArticle()
    return () => {
      if (autoPlayTimerRef.current) window.clearTimeout(autoPlayTimerRef.current)
      if (checkAnswerTimerRef.current) window.clearTimeout(checkAnswerTimerRef.current)
      // 递增 speakIdRef，让任何正在 await 中的 speakPhrase 在恢复后放弃
      speakIdRef.current += 1
      // 停止所有正在播放的 TTS
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      try { window.electronAPI.stopSpeaking() } catch {}
    }
  }, [id, practiceMode])

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

  // 保存当前进度的辅助函数
  const saveProgress = useCallback(async (index: number) => {
    if (!id) return
    const progressKey = -parseInt(id)
    try {
      await window.electronAPI.savePracticeProgress(userName, progressKey, {
        currentIndex: index,
        correctCount: statsRef.current.correct,
        incorrectCount: statsRef.current.incorrect,
        wordCount: phrases.length,
        practiceMode,
        wordsList: phrases
      })
    } catch (e) {
      console.error('Save progress error:', e)
    }
  }, [id, userName, phrases, practiceMode])

  const checkAnswer = async () => {
    const currentPhrase = phrases[currentIndex]
    const isCorrect = userInput.trim().toLowerCase() === currentPhrase.toLowerCase()
    // 记录当前世代号，用于在异步回调中检测是否已过期
    const gen = generationRef.current

    if (isCorrect) {
      setStatus('correct')
      statsRef.current.correct += 1
      setStats({ ...statsRef.current })

      checkAnswerTimerRef.current = window.setTimeout(async () => {
        // 世代号已变（用户切换了模式），放弃本次操作
        if (generationRef.current !== gen) return
        if (currentIndex < phrases.length - 1) {
          const nextIndex = currentIndex + 1
          setCurrentIndex(nextIndex)
          setUserInput('')
          setStatus('idle')
          setShowAnswer(false)
          speakPhrase(phrases[nextIndex])
          // 保存进度
          await saveProgress(nextIndex)
        } else {
          completePractice()
        }
      }, 800)
    } else {
      setStatus('incorrect')
      statsRef.current.incorrect += 1
      setStats({ ...statsRef.current })
      setShowAnswer(true)
      // 答错也保存进度
      await saveProgress(currentIndex)
    }
  }

  const completePractice = async () => {
    setStatus('completed')
    if (timerRef.current) clearInterval(timerRef.current)

    const total = statsRef.current.correct + statsRef.current.incorrect
    const accuracy = Math.round((statsRef.current.correct / total) * 100)
    const duration = Math.floor((Date.now() - startTime) / 1000)
    const wpm = Math.round((total / duration) * 60)
    const score = Math.round((accuracy * wpm) / 10)

    if (article) {
      const record: PracticeRecord = {
        userName,
        articleId: article.id ?? 0,
        articleTitle: `${article.title} (${practiceMode === 'sentence' ? '短句' : '短语'}模式)`,
        mode: 'spelling',
        accuracy,
        wpm,
        duration,
        score,
      }
      try {
        await window.electronAPI.savePracticeRecord(record)
        // 练习完成，清除进度
        await window.electronAPI.clearPracticeProgress(userName, -(article.id ?? 0))
      } catch (error) {
        console.error('Save record error:', error)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') checkAnswer()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading || !article) {
    return <div style={styles.loading}>加载中...</div>
  }

  if (status === 'completed') {
    const total = phrases.length
    const accuracy = Math.round((statsRef.current.correct / total) * 100)
    const wpm = elapsedTime > 0 ? Math.round((total / elapsedTime) * 60) : 0
    const score = Math.round((accuracy * wpm) / 10)

    return (
      <div style={styles.container}>
        <div style={styles.resultCard}>
          <h2 style={styles.resultTitle}>🎉 练习完成！</h2>
          <div style={styles.resultStats}>
            <div style={styles.resultStat}>
              <div style={styles.resultStatValue}>{score}</div>
              <div style={styles.resultStatLabel}>总得分</div>
            </div>
            <div style={styles.resultStat}>
              <div style={styles.resultStatValue}>{accuracy}%</div>
              <div style={styles.resultStatLabel}>准确率</div>
            </div>
            <div style={styles.resultStat}>
              <div style={styles.resultStatValue}>{wpm}</div>
              <div style={styles.resultStatLabel}>WPM</div>
            </div>
          </div>
          <div style={styles.resultActions}>
            <button type="button" onClick={() => navigate('/articles')} style={styles.btnPrimary}>
              返回文章列表
            </button>
            <button type="button" onClick={() => window.location.reload()} style={styles.btnSecondary}>
              再练一次
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentPhrase = phrases[currentIndex]
  const totalAnswered = stats.correct + stats.incorrect
  const currentAccuracy = totalAnswered > 0 ? Math.round(stats.correct / totalAnswered * 100) : 100

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 {practiceMode === 'sentence' ? '短句' : '短语'}听写</h1>
        <div style={styles.modeToggle}>
          <button
            type="button"
            onClick={() => setPracticeMode('sentence')}
            style={practiceMode === 'sentence' ? styles.modeBtnActive : styles.modeBtn}
          >
            短句模式
          </button>
          <button
            type="button"
            onClick={() => setPracticeMode('phrase')}
            style={practiceMode === 'phrase' ? styles.modeBtnActive : styles.modeBtn}
          >
            短语模式
          </button>
        </div>
      </div>

      <div style={styles.statsBar}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>进度</span>
          <span style={styles.statValue}>{currentIndex + 1} / {phrases.length}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>时间</span>
          <span style={styles.statValue}>{formatTime(elapsedTime)}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>准确率</span>
          <span style={{ ...styles.statValue, color: currentAccuracy >= 80 ? '#4caf50' : '#ff9800' }}>
            {currentAccuracy}%
          </span>
        </div>
      </div>

      <div style={styles.practiceCard}>
        <button type="button" onClick={() => speakPhrase(currentPhrase)} style={styles.speakerBtn}>
          🔊 播放语音
        </button>
        <p style={styles.hint}>请听语音，输入听到的{practiceMode === 'sentence' ? '短句' : '短语'}</p>

        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`输入${practiceMode === 'sentence' ? '短句' : '短语'}...`}
          style={{
            ...styles.input,
            borderColor: status === 'correct' ? '#4caf50' : status === 'incorrect' ? '#f44336' : '#ddd',
            backgroundColor: status === 'correct' ? 'rgba(76, 175, 80, 0.1)' : status === 'incorrect' ? 'rgba(244, 67, 54, 0.1)' : '#fff',
          }}
        />

        {status === 'correct' && <span style={styles.correctMark}>✓ 正确!</span>}
        {status === 'incorrect' && (
          <div style={styles.incorrectSection}>
            <span style={styles.incorrectMark}>✗ 错误</span>
            {showAnswer && (
              <div style={styles.correctAnswer}>正确答案: <strong>{currentPhrase}</strong></div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={checkAnswer}
          disabled={!userInput.trim()}
          style={{ ...styles.checkBtn, opacity: !userInput.trim() ? 0.6 : 1 }}
        >
          检查 (Enter)
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '24px' },
  loading: { textAlign: 'center', padding: '48px', fontSize: '16px', color: '#666' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { fontSize: '24px', fontWeight: 600, margin: 0 },
  modeToggle: { display: 'flex', gap: '8px' },
  modeBtn: { padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer' },
  modeBtnActive: { padding: '8px 16px', border: '1px solid #2196f3', borderRadius: '6px', background: '#2196f3', color: '#fff', cursor: 'pointer' },
  statsBar: { display: 'flex', gap: '24px', padding: '12px 16px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' },
  stat: { display: 'flex', flexDirection: 'column', gap: '4px' },
  statLabel: { fontSize: '12px', color: '#666' },
  statValue: { fontSize: '18px', fontWeight: 600 },
  practiceCard: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '32px', textAlign: 'center' },
  speakerBtn: { padding: '16px 32px', fontSize: '18px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  hint: { marginTop: '12px', fontSize: '14px', color: '#666' },
  input: { width: '100%', maxWidth: '600px', padding: '16px 24px', fontSize: '20px', textAlign: 'center', border: '2px solid #ddd', borderRadius: '8px', marginTop: '20px', textTransform: 'lowercase' },
  correctMark: { display: 'block', marginTop: '12px', fontSize: '18px', color: '#4caf50', fontWeight: 600 },
  incorrectSection: { marginTop: '12px' },
  incorrectMark: { fontSize: '18px', color: '#f44336', fontWeight: 600 },
  correctAnswer: { marginTop: '8px', fontSize: '16px', color: '#666' },
  checkBtn: { marginTop: '20px', padding: '12px 32px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  resultCard: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '48px', textAlign: 'center' },
  resultTitle: { fontSize: '28px', fontWeight: 600, marginBottom: '32px' },
  resultStats: { display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '32px' },
  resultStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px 32px', background: '#f5f5f5', borderRadius: '8px' },
  resultStatValue: { fontSize: '36px', fontWeight: 700, color: '#2196f3' },
  resultStatLabel: { fontSize: '14px', color: '#666' },
  resultActions: { display: 'flex', gap: '12px', justifyContent: 'center' },
  btnPrimary: { padding: '12px 24px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  btnSecondary: { padding: '12px 24px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' },
}
