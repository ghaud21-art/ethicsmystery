import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRegistry } from '../engine/scenarioLoader'

export default function ScenarioSelectPage() {
  const [scenarios, setScenarios] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRegistry().then(setScenarios).catch(setError)
  }, [])

  return (
    <div>
      <h1>윤리미스터리</h1>
      <p className="dim">고등학교 윤리문제 탐구 수업용 온라인 딜레마 추리게임</p>

      {error && <div className="card">시나리오 목록을 불러오지 못했습니다.</div>}
      {!scenarios && !error && <div className="dim">불러오는 중...</div>}

      {scenarios?.map((s) => (
        <div className="card" key={s.scenarioId}>
          <h3>{s.title}</h3>
          <p className="dim">{s.unit}</p>
          <p>{s.themes?.join(' · ')}</p>
          <div className="row">
            <span className="dim">{s.supportedPlayerCounts?.join('/')}인용 · 약 {s.estimatedMinutes}분</span>
            {s.status === '설계 완료' ? (
              <Link to={`/scenario/${s.scenarioId}/lobby`}>
                <button className="primary">플레이하기</button>
              </Link>
            ) : (
              <button disabled>준비 중</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
