import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ArticlesPage } from './pages/ArticlesPage'
import { EditArticlePage } from './pages/EditArticlePage'
import { PracticePage } from './pages/PracticePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { WidaPage } from './pages/WidaPage'
import { WidaTestPage } from './pages/WidaTestPage'
import './styles/App.css'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="edit/:id" element={<EditArticlePage />} />
          <Route path="segment/:id" element={<EditArticlePage />} />
          <Route path="practice/:articleId/:mode" element={<PracticePage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="wida" element={<WidaPage />} />
        </Route>
        <Route path="/wida/test/:sessionId" element={<WidaTestPage />} />
      </Routes>
    </div>
  )
}

export default App
