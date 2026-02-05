import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from '../../types'

export function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await window.electronAPI.getLeaderboard()
        // 确保数据按总分排序
        const sortedData = data.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.totalScore - a.totalScore)
        setLeaderboard(sortedData)
      } catch (error) {
        console.error('Load leaderboard error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLeaderboard()
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇'
      case 2:
        return '🥈'
      case 3:
        return '🥉'
      default:
        return `${rank}`
    }
  }

  const getRankStyle = (rank: number): React.CSSProperties => {
    switch (rank) {
      case 1:
        return { backgroundColor: 'rgba(255, 215, 0, 0.2)', borderColor: '#FFD700' }
      case 2:
        return { backgroundColor: 'rgba(192, 192, 192, 0.2)', borderColor: '#C0C0C0' }
      case 3:
        return { backgroundColor: 'rgba(205, 127, 50, 0.2)', borderColor: '#CD7F32' }
      default:
        return {}
    }
  }

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>加载中...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🏆 排行榜</h1>
        <p style={styles.subtitle}>看看谁是单词拼写达人</p>
      </div>

      {leaderboard.length === 0 ? (
        <div style={styles.emptyCard}>
          <div style={styles.emptyIcon}>📊</div>
          <h3 style={styles.emptyTitle}>暂无数据</h3>
          <p style={styles.emptyText}>还没有练习记录，快去练习吧！</p>
        </div>
      ) : (
        <>
          {/* 前三名展示 */}
          {leaderboard.length > 0 && (
            <div style={styles.topThree}>
              {leaderboard.slice(0, 3).map((entry, index) => (
                <div
                  key={entry.userName}
                  style={{ ...styles.topCard, ...getRankStyle(index + 1) }}
                >
                  <div style={styles.topRank}>{getRankIcon(index + 1)}</div>
                  <div style={styles.topName}>{entry.userName}</div>
                  <div style={styles.topScore}>{entry.totalScore} 分</div>
                  <div style={styles.topStats}>
                    <span>{entry.totalPractices} 次练习</span>
                    <span>{entry.avgAccuracy}% 准确率</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 完整列表 */}
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>排名</th>
                  <th style={styles.th}>用户名</th>
                  <th style={styles.th}>总分</th>
                  <th style={styles.th}>练习次数</th>
                  <th style={styles.th}>平均准确率</th>
                  <th style={styles.th}>平均WPM</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr
                    key={entry.userName}
                    style={{
                      ...styles.tableRow,
                      ...(index < 3 ? getRankStyle(index + 1) : {}),
                    }}
                  >
                    <td style={styles.td}>
                      <span style={styles.rankBadge}>{getRankIcon(index + 1)}</span>
                    </td>
                    <td style={styles.td}>
                      <strong style={styles.userName}>{entry.userName}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.scoreValue}>{entry.totalScore}</span>
                    </td>
                    <td style={styles.td}>{entry.totalPractices}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.accuracyBadge,
                          backgroundColor:
                            entry.avgAccuracy >= 90
                              ? 'rgba(76, 175, 80, 0.2)'
                              : entry.avgAccuracy >= 70
                              ? 'rgba(255, 152, 0, 0.2)'
                              : 'rgba(244, 67, 54, 0.2)',
                          color:
                            entry.avgAccuracy >= 90
                              ? 'var(--success-color)'
                              : entry.avgAccuracy >= 70
                              ? 'var(--warning-color)'
                              : 'var(--error-color)',
                        }}
                      >
                        {entry.avgAccuracy}%
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.wpmValue}>{entry.avgWpm}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 统计摘要 */}
          <div style={styles.summaryCard}>
            <h3 style={styles.summaryTitle}>📈 练习统计</h3>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <div style={styles.summaryValue}>
                  {leaderboard.reduce((sum, e) => sum + e.totalPractices, 0)}
                </div>
                <div style={styles.summaryLabel}>总练习次数</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={styles.summaryValue}>
                  {leaderboard.length}
                </div>
                <div style={styles.summaryLabel}>参与人数</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={styles.summaryValue}>
                  {Math.round(
                    leaderboard.reduce((sum, e) => sum + e.avgAccuracy, 0) /
                      leaderboard.length
                  )}%
                </div>
                <div style={styles.summaryLabel}>平均准确率</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={styles.summaryValue}>
                  {Math.round(
                    leaderboard.reduce((sum, e) => sum + e.avgWpm, 0) /
                      leaderboard.length
                  )}
                </div>
                <div style={styles.summaryLabel}>平均WPM</div>
              </div>
            </div>
          </div>
        </>
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
  loading: {
    textAlign: 'center',
    padding: '48px',
    fontSize: '16px',
    color: 'var(--text-secondary)',
  },
  header: {
    marginBottom: '24px',
    textAlign: 'center' as const,
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
  emptyCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '48px',
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  topThree: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
  },
  topCard: {
    flex: 1,
    minWidth: '200px',
    maxWidth: '280px',
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '24px',
    textAlign: 'center' as const,
    border: '2px solid transparent',
    transition: 'transform 0.2s ease',
  },
  topRank: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  topName: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  topScore: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--primary-color)',
    marginBottom: '12px',
  },
  topStats: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  tableCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    backgroundColor: 'var(--bg-color)',
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left' as const,
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tableRow: {
    borderBottom: '1px solid var(--border-color)',
    transition: 'background-color 0.2s ease',
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: 'var(--text-primary)',
  },
  rankBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    fontSize: '14px',
    fontWeight: 600,
  },
  userName: {
    color: 'var(--text-primary)',
  },
  scoreValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--primary-color)',
  },
  accuracyBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 500,
  },
  wpmValue: {
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  summaryCard: {
    background: 'var(--card-bg)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '24px',
  },
  summaryTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  summaryItem: {
    textAlign: 'center' as const,
    padding: '16px',
    background: 'var(--bg-color)',
    borderRadius: 'var(--radius)',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--primary-color)',
    marginBottom: '4px',
  },
  summaryLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
}
