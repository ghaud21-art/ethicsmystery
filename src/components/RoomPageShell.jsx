import { useEffect, useState } from 'react'
import { loadScenario } from '../engine/scenarioLoader'
import { RoomProvider } from '../context/RoomContext'

// scenarioId를 불러와 RoomProvider로 감싸주는 공통 래퍼.
// wait/play/resolve/results 4개 페이지가 동일한 로딩+에러 처리를 반복하지 않도록 한다.
export default function RoomPageShell({ scenarioId, roomCode, children }) {
  const [scenario, setScenario] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadScenario(scenarioId)
      .then((s) => !cancelled && setScenario(s))
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [scenarioId])

  if (error) return <div className="card">시나리오를 불러오지 못했습니다: {error.message}</div>
  if (!scenario) return <div className="dim">불러오는 중...</div>

  return (
    <RoomProvider scenario={scenario} roomCode={roomCode}>
      {children(scenario)}
    </RoomProvider>
  )
}
