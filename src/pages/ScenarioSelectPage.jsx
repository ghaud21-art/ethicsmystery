import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRegistry } from '../engine/scenarioLoader'
import Masthead from '../components/Masthead.jsx'

export default function ScenarioSelectPage() {
  const [scenarios, setScenarios] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRegistry().then(setScenarios).catch(setError)
  }, [])

  return (
    <div>
      <Masthead />

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <path d="M4 4h16v4H4z" />
          <path d="M4 12h16v8H4z" />
        </svg>
        CASE FILES
      </div>
      <h1 className="page-title">시나리오 선택</h1>
      <div className="page-title-rule" />
      <p className="dim" style={{ marginBottom: 22 }}>
        고등학교 윤리문제 탐구 수업용 온라인 딜레마 추리게임 — 모둠에서 함께 풀어볼 딜레마를 선택하세요.
      </p>

      {error && <div className="card">시나리오 목록을 불러오지 못했습니다.</div>}
      {!scenarios && !error && <div className="dim">불러오는 중...</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {scenarios?.map((s) => (
          <div className="card tape" style={{ padding: 0, overflow: 'hidden' }} key={s.scenarioId}>
            <div className="thumb">{s.title} 이미지</div>
            <div style={{ padding: 14 }} className="col">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 700 }}>
                  {s.unit}
                </div>
                <span className={`pill ${s.status === '설계 완료' ? 'pill-solid' : 'pill-muted'}`}>
                  {s.status === '설계 완료' ? '플레이 가능' : '준비 중'}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 17 }}>{s.title}</div>
              <p className="dim" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{s.themes?.join(' · ')}</p>
              <div className="row dim" style={{ fontSize: 11 }}>
                <span>{s.supportedPlayerCounts?.join('/')}인</span>
                <span>·</span>
                <span>약 {s.estimatedMinutes}분</span>
              </div>
              {s.status === '설계 완료' ? (
                <Link to={`/scenario/${s.scenarioId}/lobby`}>
                  <button className="primary" style={{ width: '100%', textAlign: 'left', marginTop: 4 }}>
                    플레이하기
                  </button>
                </Link>
              ) : (
                <button disabled style={{ width: '100%', marginTop: 4 }}>
                  준비 중
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
