import { Outlet, Link, useLocation } from 'react-router-dom'
import './Layout.css'

export function Layout() {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/articles', label: '文章库', icon: '📚' },
    { path: '/wida', label: 'WIDA测试', icon: '📝' },
    { path: '/leaderboard', label: '排行榜', icon: '🏆' },
  ]

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">⌨️</span>
          <span className="logo-text">拼写练习</span>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
