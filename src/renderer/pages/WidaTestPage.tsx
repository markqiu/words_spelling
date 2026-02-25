import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import './WidaTestPage.css'

interface WidaTestSession {
  id: number
  user_name: string
  test_type: string
  grade_level: string
  domain: string | null
  status: string
  current_question: number
  total_questions: number
  score: number | null
  proficiency_level: number | null
  started_at: string
  completed_at: string | null
}

interface WidaListeningQuestion {
  id: number
  grade_level: string
  domain: string
  difficulty: number
  audio_text: string
  image_url: string | null
  question_text: string
  options: string[]
  correct_answer: number
  explanation: string | null
}

interface WidaReadingQuestion {
  id: number
  grade_level: string
  domain: string
  difficulty: number
  passage: string
  question_text: string
  question_type: string
  options: string[]
  correct_answer: number
  explanation: string | null
}

interface WidaSpeakingQuestion {
  id: number
  grade_level: string
  domain: string
  difficulty: number
  prompt_type: string
  prompt_text: string
  image_url: string | null
  audio_text: string | null
  sample_answer: string
  rubric: string[]
}

interface WidaWritingQuestion {
  id: number
  grade_level: string
  domain: string
  difficulty: number
  task_type: string
  prompt: string
  image_url: string | null
  word_limit_min: number
  word_limit_max: number
  rubric: string[]
  sample_answer: string | null
}

interface WidaTestReport {
  session: WidaTestSession
  correct_count: number
  total_count: number
  accuracy: number
  overall_score: number
  proficiency_level: number
  proficiency_level_name: string
}

type Question = WidaListeningQuestion | WidaReadingQuestion | WidaSpeakingQuestion | WidaWritingQuestion

const PROFICIENCY_LEVELS: Record<number, { name: string; color: string }> = {
  1: { name: 'Entering', color: '#e74c3c' },
  2: { name: 'Emerging', color: '#e67e22' },
  3: { name: 'Developing', color: '#f1c40f' },
  4: { name: 'Expanding', color: '#2ecc71' },
  5: { name: 'Bridging', color: '#3498db' },
  6: { name: 'Reaching', color: '#9b59b6' },
}

export function WidaTestPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  
  const [session, setSession] = useState<WidaTestSession | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [writingAnswer, setWritingAnswer] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [report, setReport] = useState<WidaTestReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [answered, setAnswered] = useState<Record<number, boolean>>({})
  
  // 录音相关状态
  const [isRecording, setIsRecording] = useState(false)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  useEffect(() => {
    loadTestData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTestData = async () => {
    if (!sessionId) return
    
    try {
      setLoading(true)
      const sessionData = await invoke<WidaTestSession | null>('get_wida_test_session', { 
        sessionId: parseInt(sessionId) 
      })
      
      if (!sessionData) {
        alert('测试会话不存在')
        navigate('/wida')
        return
      }
      
      setSession(sessionData)
      setCurrentQuestionIndex(sessionData.current_question)
      
      const questionsData = await invoke<Question[]>('get_wida_test_questions', { 
        sessionId: parseInt(sessionId) 
      })
      
      console.log('Loaded questions:', questionsData)
      setQuestions(Array.isArray(questionsData) ? questionsData : [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load test data:', error)
      alert('加载测试失败: ' + error)
      navigate('/wida')
    }
  }

  const playAudio = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      utterance.onstart = () => setIsPlaying(true)
      utterance.onend = () => setIsPlaying(false)
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  // 开始录音
  const startRecording = useCallback(async () => {
    // 检查浏览器支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('您的浏览器不支持录音功能，请使用最新版本的 Chrome、Firefox 或 Safari')
      return
    }

    if (!window.MediaRecorder) {
      alert('您的浏览器不支持 MediaRecorder API')
      return
    }

    try {
      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      console.log('Microphone access granted')
      
      // 获取支持的 mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : 'audio/ogg'
      
      console.log('Using mime type:', mimeType)
      
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: BlobPart[] = []
      
      recorder.ondataavailable = (e) => {
        console.log('Data available:', e.data.size)
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }
      
      recorder.onstop = () => {
        console.log('Recording stopped, chunks:', chunks.length)
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType })
          const url = URL.createObjectURL(blob)
          setAudioURL(url)
          console.log('Audio URL created:', url)
        }
        stream.getTracks().forEach(track => track.stop())
      }
      
      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e)
        alert('录音出现错误，请重试')
      }
      
      // 每 100ms 收集一次数据
      recorder.start(100)
      setMediaRecorder(recorder)
      setIsRecording(true)
      setAudioURL(null) // 清除之前的录音
      console.log('Recording started')
    } catch (error) {
      console.error('Failed to start recording:', error)
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          alert('麦克风权限被拒绝。请检查系统设置，允许此应用访问麦克风。')
        } else if (error.name === 'NotFoundError') {
          alert('未找到麦克风设备，请确保麦克风已连接')
        } else {
          alert(`无法访问麦克风: ${error.name} - ${error.message}`)
        }
      } else {
        alert('无法访问麦克风，请确保已授予麦克风权限')
      }
    }
  }, [])

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }, [mediaRecorder])

  // 清除录音
  const clearRecording = useCallback(() => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
    }
    setAudioURL(null)
  }, [audioURL])

  const submitAnswer = async () => {
    if (!session || !questions[currentQuestionIndex]) return
    
    const currentQuestion = questions[currentQuestionIndex]
    const answer = session.test_type === 'writing' ? writingAnswer : selectedAnswer
    
    if (!answer && session.test_type !== 'speaking') {
      alert('请选择或输入答案')
      return
    }
    
    const timeSpent = Math.floor((Date.now() - startTime) / 1000)
    
    try {
      await invoke('submit_wida_answer', {
        request: {
          session_id: session.id,
          question_id: currentQuestion.id,
          answer: answer,
          time_spent_seconds: timeSpent,
        }
      })
      
      setAnswered(prev => ({
        ...prev,
        [currentQuestionIndex]: true
      }))
      
      // Move to next question or complete test
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1)
        setSelectedAnswer('')
        setWritingAnswer('')
        setStartTime(Date.now())
        // 清除录音
        clearRecording()
      } else {
        completeTest()
      }
    } catch (error) {
      console.error('Failed to submit answer:', error)
      alert('提交答案失败')
    }
  }

  const completeTest = async () => {
    if (!session) return
    
    try {
      const reportData = await invoke<WidaTestReport>('complete_wida_test', {
        request: {
          session_id: session.id,
        }
      })
      
      setReport(reportData)
      setShowResult(true)
    } catch (error) {
      console.error('Failed to complete test:', error)
      alert('完成测试失败')
    }
  }

  const getLevelColor = (level: number) => {
    return PROFICIENCY_LEVELS[level]?.color || '#gray'
  }

  const renderQuestion = () => {
    if (questions.length === 0) return <div className="no-questions">没有题目</div>
    
    const question = questions[currentQuestionIndex]
    const testType = session?.test_type
    
    switch (testType) {
      case 'listening':
        return renderListeningQuestion(question as WidaListeningQuestion)
      case 'reading':
        return renderReadingQuestion(question as WidaReadingQuestion)
      case 'speaking':
        return renderSpeakingQuestion(question as WidaSpeakingQuestion)
      case 'writing':
        return renderWritingQuestion(question as WidaWritingQuestion)
      default:
        return <div>未知测试类型</div>
    }
  }

  const renderListeningQuestion = (question: WidaListeningQuestion) => (
    <div className="question-container">
      <div className="audio-section">
        <button 
          type="button"
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={() => playAudio(question.audio_text)}
          disabled={isPlaying}
        >
          {isPlaying ? '🔊 播放中...' : '▶️ 播放音频'}
        </button>
      </div>
      
      {question.image_url && (
        <div className="image-section">
          <img src={question.image_url} alt="Question" />
        </div>
      )}
      
      <div className="question-text">{question.question_text}</div>
      
      <div className="options">
        {question.options.map((option, index) => (
          <button
            type="button"
            key={index}
            className={`option ${selectedAnswer === index.toString() ? 'selected' : ''}`}
            onClick={() => setSelectedAnswer(index.toString())}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderReadingQuestion = (question: WidaReadingQuestion) => (
    <div className="question-container">
      <div className="passage-section">
        <div className="passage-label">阅读文章:</div>
        <div className="passage-text">{question.passage}</div>
      </div>
      
      <div className="question-text">{question.question_text}</div>
      
      <div className="options">
        {question.options.map((option, index) => (
          <button
            type="button"
            key={index}
            className={`option ${selectedAnswer === index.toString() ? 'selected' : ''}`}
            onClick={() => setSelectedAnswer(index.toString())}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderSpeakingQuestion = (question: WidaSpeakingQuestion) => (
    <div className="question-container speaking-question">
      <div className="prompt-section">
        <div className="prompt-text">{question.prompt_text}</div>
        
        {question.image_url && (
          <div className="image-section">
            <img src={question.image_url} alt="Prompt" />
          </div>
        )}
      </div>
      
      {question.audio_text && (
        <button 
          type="button"
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={() => playAudio(question.audio_text as string)}
          disabled={isPlaying}
        >
          {isPlaying ? '🔊 播放中...' : '▶️ 播放提示音频'}
        </button>
      )}
      
      <div className="rubric-section">
        <div className="rubric-title">评分标准:</div>
        <ul className="rubric-list">
          {question.rubric.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
      
      {/* 录音控制区域 */}
      <div className="recording-section">
        <div className="recording-controls">
          {!isRecording ? (
            <button 
              type="button"
              className="record-button"
              onClick={startRecording}
            >
              🎤 开始录音
            </button>
          ) : (
            <button 
              type="button"
              className="record-button recording"
              onClick={stopRecording}
            >
              ⏹️ 停止录音
            </button>
          )}
          
          {audioURL && (
            <>
              <button 
                type="button"
                className="clear-button"
                onClick={clearRecording}
              >
                🗑️ 清除录音
              </button>
            </>
          )}
        </div>
        
        {isRecording && (
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            录音中...
          </div>
        )}
        
        {audioURL && (
          <div className="audio-playback">
            <div className="playback-label">你的回答:</div>
            <audio controls src={audioURL} className="audio-player">
              <track kind="captions" label="English" />
            </audio>
          </div>
        )}
      </div>
      
      <div className="speaking-instructions">
        <p>🎤 请大声回答问题，练习你的口语表达能力</p>
        <p>你可以录音后回放检查，或向老师展示你的答案</p>
      </div>
      
      <div className="sample-answer">
        <div className="sample-label">示范回答 (点击显示):</div>
        <details>
          <summary>查看示范回答</summary>
          <div className="sample-text">{question.sample_answer}</div>
        </details>
      </div>
    </div>
  )

  const renderWritingQuestion = (question: WidaWritingQuestion) => (
    <div className="question-container writing-question">
      <div className="prompt-section">
        <div className="task-type">{question.task_type}</div>
        <div className="prompt-text">{question.prompt}</div>
        
        {question.image_url && (
          <div className="image-section">
            <img src={question.image_url} alt="Prompt" />
          </div>
        )}
      </div>
      
      <div className="word-limit">
        字数要求: {question.word_limit_min} - {question.word_limit_max} 字
      </div>
      
      <div className="rubric-section">
        <div className="rubric-title">评分标准:</div>
        <ul className="rubric-list">
          {question.rubric.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
      
      <textarea
        className="writing-input"
        value={writingAnswer}
        onChange={(e) => setWritingAnswer(e.target.value)}
        placeholder="在此输入你的答案..."
        rows={10}
      />
      
      <div className="word-count">
        当前字数: {writingAnswer.split(/\s+/).filter(w => w.length > 0).length}
      </div>
      
      {question.sample_answer && (
        <div className="sample-answer">
          <div className="sample-label">示范回答 (点击显示):</div>
          <details>
            <summary>查看示范回答</summary>
            <div className="sample-text">{question.sample_answer}</div>
          </details>
        </div>
      )}
    </div>
  )

  const renderResult = () => {
    if (!report) return null
    
    return (
      <div className="test-result">
        <h2>测试完成！</h2>
        
        <div className="score-display">
          <div 
            className="score-circle"
            style={{ borderColor: getLevelColor(report.proficiency_level) }}
          >
            <span className="score">{report.overall_score.toFixed(0)}</span>
            <span className="max-score">/600</span>
          </div>
          
          <div 
            className="level-display"
            style={{ color: getLevelColor(report.proficiency_level) }}
          >
            Level {report.proficiency_level} - {report.proficiency_level_name}
          </div>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{report.correct_count}/{report.total_count}</div>
            <div className="stat-label">正确/总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{report.accuracy.toFixed(1)}%</div>
            <div className="stat-label">正确率</div>
          </div>
        </div>
        
        <button 
          type="button"
          className="back-button"
          onClick={() => navigate('/wida')}
        >
          返回WIDA主页
        </button>
      </div>
    )
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  if (showResult) {
    return renderResult()
  }

  return (
    <div className="wida-test-page">
      <header className="test-header">
        <button type="button" className="exit-button" onClick={() => navigate('/wida')}>
          ✕ 退出
        </button>
        <div className="test-info">
          <span className="test-type">
            {session?.test_type === 'listening' && '🎧 听力测试'}
            {session?.test_type === 'reading' && '📖 阅读测试'}
            {session?.test_type === 'speaking' && '🎤 口语测试'}
            {session?.test_type === 'writing' && '✍️ 写作测试'}
          </span>
          <span className="grade-level">{session?.grade_level}</span>
        </div>
        <div className="progress">
          <div className="progress-text">
            {currentQuestionIndex + 1} / {questions.length}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </header>
      
      <main className="test-content">
        {renderQuestion()}
      </main>
      
      <footer className="test-footer">
        <button
          type="button"
          className="submit-button"
          onClick={submitAnswer}
          disabled={answered[currentQuestionIndex]}
        >
          {currentQuestionIndex < questions.length - 1 ? '下一题' : '完成测试'}
        </button>
      </footer>
    </div>
  )
}
