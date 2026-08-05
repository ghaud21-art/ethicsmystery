import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRegistry } from '../engine/scenarioLoader'
import Masthead from '../components/Masthead.jsx'
import { useSiteConfig } from '../firebase/useSiteConfig.js'

const MOODS = ['mood-1', 'mood-2', 'mood-3']
const TAG_TONES = ['pill-blue', 'pill-rose', 'pill-violet', 'pill-slate']

export default function ScenarioSelectPage() {
  const [scenarios, setScenarios] = useState(null)
  const [error, setError] = useState(null)
  const siteConfig = useSiteConfig()
  const heroSrc = siteConfig?.mainImageDataUrl || `${import.meta.env.BASE_URL}hero-main.webp`

  useEffect(() => {
    loadRegistry().then(setScenarios).catch(setError)
  }, [])

  return (
    <div className="page-wide">
      <Masthead />

      <div style={{ textAlign: 'center', padding: '18px 0 34px' }}>
        <img
          src={heroSrc}
          alt="윤리미스터리"
          style={{
            width: '100%', maxWidth: 900, borderRadius: 'var(--radius)',
            boxShadow: 'var(--glow)', border: '1px solid var(--line)',
          }}
        />
      </div>

      <div className="row" style={{ marginBottom: 18 }}>
        <div style={{ width: 4, height: 20, background: 'var(--gold)', borderRadius: 2 }} />
        <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, margin: 0 }}>
          현재 경험 가능한 시나리오
        </h2>
      </div>

      {error && <div className="card">시나리오 목록을 불러오지 못했습니다.</div>}
      {!scenarios && !error && <div className="dim">불러오는 중...</div>}

      <div className="scenario-grid">
        {scenarios?.map((s, i) => (
          <Link
            to={`/scenario/${s.scenarioId}`}
            key={s.scenarioId}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
              <div className={`mood-art ${MOODS[i % MOODS.length]}`}>
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="var(--gold-light)" strokeWidth="1" style={{ right: -20, bottom: -20 }}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <div className="badge-stack">
                  <span className="corner-badge">{s.published ? '플레이 가능' : '준비 중'}</span>
                </div>
                <span className="free-badge">무료</span>
                <span className="mood-art-label">{s.unit}</span>
              </div>
              <div style={{ padding: 16 }} className="col">
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 19 }}>{s.title}</div>
                <div className="row" style={{ gap: 12 }}>
                  <span className="stat-chip">
                    <span className="pill-dot" style={{ background: 'var(--gold)' }} />
                    {s.difficulty}
                  </span>
                  <span className="stat-chip">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
                    {s.estimatedMinutes}분
                  </span>
                  <span className="stat-chip">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                    {s.supportedPlayerCounts?.join('/')}인
                  </span>
                </div>
                <div className="row" style={{ marginTop: 4 }}>
                  {s.themes?.map((t, idx) => (
                    <span key={t} className={`pill ${TAG_TONES[idx % TAG_TONES.length]}`}>
                      <span className="pill-dot" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
