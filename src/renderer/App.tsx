import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ArticlesPage } from './pages/ArticlesPage'
import { CrawlPage } from './pages/CrawlPage'
import { SpellingPracticePage } from './pages/SpellingPracticePage'
import { TypingPracticePage } from './pages/TypingPracticePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import './styles/App.css'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="crawl" element={<CrawlPage />} />
          <Route path="spelling/:id" element={<SpellingPracticePage />} />
          <Route path="typing/:id" element={<TypingPracticePage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App
