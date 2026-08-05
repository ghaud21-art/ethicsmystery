import { Routes, Route } from 'react-router-dom'
import ScenarioSelectPage from './pages/ScenarioSelectPage.jsx'
import ScenarioDetailPage from './pages/ScenarioDetailPage.jsx'
import WaitingRoomPage from './pages/WaitingRoomPage.jsx'
import GamePage from './pages/GamePage.jsx'
import ResolutionPage from './pages/ResolutionPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ScenarioSelectPage />} />
      <Route path="/scenario/:scenarioId" element={<ScenarioDetailPage />} />
      <Route path="/scenario/:scenarioId/room/:roomCode/wait" element={<WaitingRoomPage />} />
      <Route path="/scenario/:scenarioId/room/:roomCode/play" element={<GamePage />} />
      <Route path="/scenario/:scenarioId/room/:roomCode/resolve" element={<ResolutionPage />} />
      <Route path="/scenario/:scenarioId/room/:roomCode/results" element={<ResultsPage />} />
    </Routes>
  )
}
