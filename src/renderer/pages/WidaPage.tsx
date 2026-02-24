import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import './WidaPage.css'

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

interface WidaHistoryRecord {
  id: number
  user_name: string
  test_type: string
  grade_level: string
  score: number
  proficiency_level: number
  accuracy: number
  total_questions: number
  correct_count: number
  duration_seconds: number
  completed_at: string
}

interface WidaComprehensiveReport {
  user_name: string
  listening_score: number | null
  listening_level: number | null
  reading_score: number | null
  reading_level: number | null
  speaking_score: number | null
  speaking_level: number | null
  writing_score: number | null
  writing_level: number | null
  oral_score: number | null
  literacy_score: number | null
  overall_score: number
  overall_level: number
  test_count: number
  last_test_date: string
}

interface ApiSettings {
  api_url: string
  api_key: string
  model: string
}

const TEST_TYPES = [
  { key: 'listening', label: '听力 Listening', icon: '🎧' },
  { key: 'reading', label: '阅读 Reading', icon: '📖' },
  { key: 'speaking', label: '口语 Speaking', icon: '🎤' },
  { key: 'writing', label: '写作 Writing', icon: '✍️' },
]

const GRADE_LEVELS = [
  { key: 'grade_1_2', label: '1-2年级 (Grade 1-2)' },
  { key: 'grade_3_5', label: '3-5年级 (Grade 3-5)' },
  { key: 'grade_6_8', label: '6-8年级 (Grade 6-8)' },
  { key: 'grade_9_12', label: '9-12年级 (Grade 9-12)' },
]

const DOMAINS = [
  { key: '', label: '全部领域 (All Domains)' },
  { key: 'social_instructional', label: '社交与教学英语' },
  { key: 'language_arts', label: '艺术语言类英语' },
  { key: 'mathematics', label: '数学英语' },
  { key: 'science', label: '科学英语' },
  { key: 'social_studies', label: '社会研究英语' },
]

const PROFICIENCY_LEVELS: Record<number, { name: string; color: string }> = {
  1: { name: 'Entering', color: '#e74c3c' },
  2: { name: 'Emerging', color: '#e67e22' },
  3: { name: 'Developing', color: '#f1c40f' },
  4: { name: 'Expanding', color: '#2ecc71' },
  5: { name: 'Bridging', color: '#3498db' },
  6: { name: 'Reaching', color: '#9b59b6' },
}

export function WidaPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'test' | 'history' | 'report' | 'generate'>('test')
  const [selectedTestType, setSelectedTestType] = useState('listening')
  const [selectedGrade, setSelectedGrade] = useState('grade_3_5')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const [activeSessions, setActiveSessions] = useState<WidaTestSession[]>([])
  const [history, setHistory] = useState<WidaHistoryRecord[]>([])
  const [report, setReport] = useState<WidaComprehensiveReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [startingTest, setStartingTest] = useState(false)
  
  // API设置和题目生成状态
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    api_url: 'https://api.openai.com/v1',
    api_key: '',
    model: 'gpt-3.5-turbo'
  })
  const [generateGrade, setGenerateGrade] = useState('grade_3_5')
  const [generateDomain, setGenerateDomain] = useState('social_instructional')
  const [generateDifficulty, setGenerateDifficulty] = useState(3)
  const [generateCount, setGenerateCount] = useState(5)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadData()
    loadApiSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadApiSettings = async () => {
    try {
      const settings = await invoke<ApiSettings>('load_api_settings')
      setApiSettings(settings)
    } catch (error) {
      console.error('Failed to load API settings:', error)
    }
  }

  const saveApiSettingsHandler = async () => {
    try {
      await invoke('save_api_settings', { settings: apiSettings })
      alert('API设置已保存')
    } catch (error) {
      console.error('Failed to save API settings:', error)
      alert('保存API设置失败: ' + error)
    }
  }

  const generateQuestions = async (testType: string) => {
    if (!apiSettings.api_key) {
      alert('请先设置API Key')
      return
    }
    
    setGenerating(true)
    try {
      const request = {
        api_url: apiSettings.api_url,
        api_key: apiSettings.api_key,
        model: apiSettings.model,
        count: generateCount,
        grade_level: generateGrade,
        domain: generateDomain,
        difficulty: generateDifficulty,
      }
      
      let command: string
      switch (testType) {
        case 'listening':
          command = 'generate_listening_questions'
          break
        case 'reading':
          command = 'generate_reading_questions'
          break
        case 'speaking':
          command = 'generate_speaking_questions'
          break
        case 'writing':
          command = 'generate_writing_questions'
          break
        default:
          throw new Error('Unknown test type')
      }
      
      const count = await invoke<number>(command, { request })
      alert(`成功生成并保存了 ${count} 道题目`)
    } catch (error) {
      console.error('Failed to generate questions:', error)
      alert('生成题目失败: ' + error)
    } finally {
      setGenerating(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [sessions, historyData, reportData] = await Promise.all([
        invoke<WidaTestSession[]>('get_active_wida_sessions', { userName: 'default' }),
        invoke<WidaHistoryRecord[]>('get_wida_history', { userName: 'default', testType: null, limit: 20 }),
        invoke<WidaComprehensiveReport>('get_wida_comprehensive_report', { userName: 'default' }),
      ])
      setActiveSessions(sessions)
      setHistory(historyData)
      setReport(reportData)
    } catch (error) {
      console.error('Failed to load WIDA data:', error)
    } finally {
      setLoading(false)
    }
  }

  const startTest = async () => {
    setStartingTest(true)
    try {
      const session = await invoke<WidaTestSession>('start_wida_test', {
        request: {
          user_name: 'default',
          test_type: selectedTestType,
          grade_level: selectedGrade,
          domain: selectedDomain || null,
          question_count: questionCount,
        },
      })
      // Navigate to test page
      navigate(`/wida/test/${session.id}`)
    } catch (error) {
      console.error('Failed to start test:', error)
      alert('开始测试失败，请确保题库中有足够的题目: ' + error)
    } finally {
      setStartingTest(false)
    }
  }

  const continueTest = (sessionId: number) => {
    navigate(`/wida/test/${sessionId}`)
  }

  const deleteSession = async (sessionId: number) => {
    if (confirm('确定要删除这个测试会话吗？')) {
      try {
        await invoke('delete_wida_session', { sessionId })
        loadData()
      } catch (error) {
        console.error('Failed to delete session:', error)
      }
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  const getLevelName = (level: number) => {
    return PROFICIENCY_LEVELS[level]?.name || 'Unknown'
  }

  const getLevelColor = (level: number) => {
    return PROFICIENCY_LEVELS[level]?.color || '#gray'
  }

  return (
    <div className="wida-page">
      <header className="wida-header">
        <h1>WIDA 英语能力测试</h1>
        <p>World-Class Instructional Design and Assessment</p>
      </header>

      <nav className="wida-tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'test' ? 'active' : ''}`}
          onClick={() => setActiveTab('test')}
        >
          开始测试
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          测试历史
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          综合报告
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          题目生成
        </button>
      </nav>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <>
          {activeTab === 'test' && (
            <div className="test-selection">
              {activeSessions.length > 0 && (
                <div className="active-sessions">
                  <h3>进行中的测试</h3>
                  {activeSessions.map((session) => (
                    <div key={session.id} className="session-card">
                      <div className="session-info">
                        <span className="test-type">{TEST_TYPES.find(t => t.key === session.test_type)?.icon} {session.test_type}</span>
                        <span className="grade">{session.grade_level}</span>
                        <span className="progress">进度: {session.current_question}/{session.total_questions}</span>
                      </div>
                      <div className="session-actions">
                        <button type="button" className="continue-btn" onClick={() => continueTest(session.id)}>
                          继续
                        </button>
                        <button type="button" className="delete-btn" onClick={() => deleteSession(session.id)}>
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="selection-form">
                <h3>选择测试类型</h3>
                <div className="test-types">
                  {TEST_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type.key}
                      className={`test-type-btn ${selectedTestType === type.key ? 'selected' : ''}`}
                      onClick={() => setSelectedTestType(type.key)}
                    >
                      <span className="icon">{type.icon}</span>
                      <span className="label">{type.label}</span>
                    </button>
                  ))}
                </div>

                <h3>选择年级等级</h3>
                <div className="grade-levels">
                  {GRADE_LEVELS.map((grade) => (
                    <button
                      type="button"
                      key={grade.key}
                      className={`grade-btn ${selectedGrade === grade.key ? 'selected' : ''}`}
                      onClick={() => setSelectedGrade(grade.key)}
                    >
                      {grade.label}
                    </button>
                  ))}
                </div>

                <h3>选择学科领域</h3>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="domain-select"
                >
                  {DOMAINS.map((domain) => (
                    <option key={domain.key} value={domain.key}>
                      {domain.label}
                    </option>
                  ))}
                </select>

                <h3>题目数量</h3>
                <div className="question-count">
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  />
                  <span>{questionCount} 题</span>
                </div>

                <button
                  type="button"
                  className="start-test-btn"
                  onClick={startTest}
                  disabled={startingTest}
                >
                  {startingTest ? '准备中...' : '开始测试'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-section">
              {history.length === 0 ? (
                <div className="empty-state">暂无测试记录</div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>测试类型</th>
                      <th>年级</th>
                      <th>得分</th>
                      <th>等级</th>
                      <th>正确率</th>
                      <th>完成时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record) => (
                      <tr key={record.id}>
                        <td>{TEST_TYPES.find(t => t.key === record.test_type)?.icon} {record.test_type}</td>
                        <td>{record.grade_level}</td>
                        <td>{record.score.toFixed(0)}</td>
                        <td>
                          <span
                            className="level-badge"
                            style={{ backgroundColor: getLevelColor(record.proficiency_level) }}
                          >
                            Level {record.proficiency_level} - {getLevelName(record.proficiency_level)}
                          </span>
                        </td>
                        <td>{record.accuracy.toFixed(1)}%</td>
                        <td>{formatDate(record.completed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="report-section">
              {report && report.test_count > 0 ? (
                <>
                  <div className="overall-report">
                    <div className="overall-score">
                      <div
                        className="score-circle"
                        style={{ borderColor: getLevelColor(report.overall_level) }}
                      >
                        <span className="score">{report.overall_score.toFixed(0)}</span>
                        <span className="max-score">/600</span>
                      </div>
                      <div
                        className="level-label"
                        style={{ color: getLevelColor(report.overall_level) }}
                      >
                        Level {report.overall_level} - {getLevelName(report.overall_level)}
                      </div>
                    </div>
                    <div className="report-stats">
                      <div className="stat">
                        <span className="label">总测试次数</span>
                        <span className="value">{report.test_count}</span>
                      </div>
                      <div className="stat">
                        <span className="label">最近测试</span>
                        <span className="value">{formatDate(report.last_test_date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="skill-scores">
                    <h3>各项技能得分</h3>
                    <div className="skills-grid">
                      {[
                        { key: 'listening', label: '听力', score: report.listening_score, level: report.listening_level },
                        { key: 'reading', label: '阅读', score: report.reading_score, level: report.reading_level },
                        { key: 'speaking', label: '口语', score: report.speaking_score, level: report.speaking_level },
                        { key: 'writing', label: '写作', score: report.writing_score, level: report.writing_level },
                      ].map((skill) => (
                        <div key={skill.key} className="skill-card">
                          <div className="skill-header">{TEST_TYPES.find(t => t.key === skill.key)?.icon} {skill.label}</div>
                          {skill.score !== null ? (
                            <>
                              <div className="skill-score">{skill.score.toFixed(0)}</div>
                              <div
                                className="skill-level"
                                style={{ color: skill.level ? getLevelColor(skill.level) : 'gray' }}
                              >
                                Level {skill.level} - {skill.level ? getLevelName(skill.level) : 'N/A'}
                              </div>
                            </>
                          ) : (
                            <div className="skill-empty">未测试</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="composite-scores">
                    <h3>综合得分</h3>
                    <div className="composite-grid">
                      <div className="composite-card">
                        <div className="composite-label">听口综合 (Oral)</div>
                        <div className="composite-desc">50%听力 + 50%口语</div>
                        <div className="composite-score">
                          {report.oral_score ? report.oral_score.toFixed(0) : 'N/A'}
                        </div>
                      </div>
                      <div className="composite-card">
                        <div className="composite-label">读写综合 (Literacy)</div>
                        <div className="composite-desc">50%阅读 + 50%写作</div>
                        <div className="composite-score">
                          {report.literacy_score ? report.literacy_score.toFixed(0) : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="overall-formula">
                      <strong>总分计算:</strong> 30%听口 + 70%读写
                    </div>
                  </div>

                  <div className="level-guide">
                    <h3>等级说明</h3>
                    <div className="levels-list">
                      {Object.entries(PROFICIENCY_LEVELS).map(([level, info]) => (
                        <div key={level} className="level-item">
                          <span className="level-badge" style={{ backgroundColor: info.color }}>
                            Level {level}
                          </span>
                          <span className="level-name">{info.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  暂无测试数据，请先完成一些测试以生成综合报告
                </div>
              )}
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="generate-section">
              <div className="api-settings">
                <h3>API设置</h3>
                <div className="settings-form">
                  <div className="form-group">
                    <label>API URL:</label>
                    <input
                      type="text"
                      value={apiSettings.api_url}
                      onChange={(e) => setApiSettings({ ...apiSettings, api_url: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                  <div className="form-group">
                    <label>API Key:</label>
                    <input
                      type="password"
                      value={apiSettings.api_key}
                      onChange={(e) => setApiSettings({ ...apiSettings, api_key: e.target.value })}
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="form-group">
                    <label>模型:</label>
                    <input
                      type="text"
                      value={apiSettings.model}
                      onChange={(e) => setApiSettings({ ...apiSettings, model: e.target.value })}
                      placeholder="gpt-3.5-turbo"
                    />
                  </div>
                  <button type="button" className="save-btn" onClick={saveApiSettingsHandler}>
                    保存设置
                  </button>
                </div>
              </div>

              <div className="generate-controls">
                <h3>题目生成</h3>
                <div className="control-group">
                  <div className="form-group">
                    <label>年级等级:</label>
                    <select
                      value={generateGrade}
                      onChange={(e) => setGenerateGrade(e.target.value)}
                    >
                      {GRADE_LEVELS.map((grade) => (
                        <option key={grade.key} value={grade.key}>
                          {grade.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>领域:</label>
                    <select
                      value={generateDomain}
                      onChange={(e) => setGenerateDomain(e.target.value)}
                    >
                      {DOMAINS.filter(d => d.key).map((domain) => (
                        <option key={domain.key} value={domain.key}>
                          {domain.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>难度等级 (1-6):</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={generateDifficulty}
                      onChange={(e) => setGenerateDifficulty(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label>题目数量:</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={generateCount}
                      onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="generate-buttons">
                  {TEST_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type.key}
                      className="generate-btn"
                      onClick={() => generateQuestions(type.key)}
                      disabled={generating}
                    >
                      {type.icon} 生成{type.label.split(' ')[0]}题目
                    </button>
                  ))}
                </div>

                {generating && (
                  <div className="generating-status">
                    正在生成题目，请稍候...
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
