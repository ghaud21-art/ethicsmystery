import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRegistry } from '../engine/scenarioLoader'
import Masthead from '../components/Masthead.jsx'
import { useSiteConfig } from '../firebase/useSiteConfig.js'
import { isLocalMode } from '../mysteryroom/store.js'
import { loadLocalRegistry } from '../mysteryroom/loader.js'

const MOODS = ['mood-1', 'mood-2', 'mood-3']
const TAG_TONES = ['pill-blue', 'pill-rose', 'pill-violet', 'pill-slate']
const TANMUN_KAKAO_LINK = 'https://open.kakao.com/me/dalpjh'

function ScenarioCard({ s, index }) {
  const isTanmun = s.contentType === 'tanmun'
  const isMystery = s.contentType === 'mysteryroom'
  const counts = s.supportedPlayerCounts ?? []
  return (
    <Link
      to={isTanmun ? `/tanmun/${s.scenarioId}` : isMystery ? `/mystery/${s.scenarioId}${isLocalMode() ? '?local=1' : ''}` : `/scenario/${s.scenarioId}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
        <div
          className={`mood-art ${MOODS[index % MOODS.length]}`}
          style={
            s.thumbnailDataUrl
              ? { backgroundImage: `url(${s.thumbnailDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {!s.thumbnailDataUrl && (
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="var(--gold-light)" strokeWidth="1" style={{ right: -20, bottom: -20 }}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          )}
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
              {isTanmun ? '1인' : isMystery ? `${Math.min(...counts)}~${Math.max(...counts)}인` : `${s.supportedPlayerCounts?.join('~')}인`}
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
  )
}

export default function ScenarioSelectPage() {
  const [scenarios, setScenarios] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('murder') // 'murder' | 'tanmun' | 'mysteryroom'
  const siteConfig = useSiteConfig()
  const heroSrc = siteConfig?.mainImageDataUrl || `${import.meta.env.BASE_URL}hero-main.webp`

  useEffect(() => {
    // 로컬 테스트 모드에서는 Firestore 대신 견본 룸만 보여 준다.
    ;(isLocalMode() ? loadLocalRegistry() : loadRegistry()).then(setScenarios).catch(setError)
  }, [])

  const visible = scenarios?.filter((s) => (tab === 'murder' ? !['tanmun', 'mysteryroom'].includes(s.contentType) : s.contentType === tab))

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

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={`tab-button ${tab === 'murder' ? 'active' : ''}`} onClick={() => setTab('murder')}>
          머더미스터리
        </button>
        <button className={`tab-button ${tab === 'tanmun' ? 'active' : ''}`} onClick={() => setTab('tanmun')}>
          탐문 수사
        </button>
        <button className={`tab-button ${tab === 'mysteryroom' ? 'active' : ''}`} onClick={() => setTab('mysteryroom')}>
          미스터리 룸
        </button>
      </div>

      <div className="row" style={{ marginBottom: 18 }}>
        <div style={{ width: 4, height: 20, background: 'var(--gold)', borderRadius: 2 }} />
        <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, margin: 0 }}>
          {{ murder: '머더미스터리', tanmun: '탐문 수사', mysteryroom: '미스터리 룸' }[tab]}
        </h2>
      </div>

      {tab === 'murder' && (
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
          머더 미스터리는 특정 사건을 해결하기 위해 다수의 플레이어가 각자가 맡은 역할을 연기하며 플레이하는
          추리 형식의 롤플레잉 게임입니다.
        </p>
      )}

      {tab === 'tanmun' && (
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
          AI 기록관에게 예/아니오 질문을 던지며 혼자 힘으로 진상에 도달하는 문답 추리입니다.
          30명 이상 학급에서의 사용 문의는{' '}
          <a href={TANMUN_KAKAO_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-light)' }}>
            카카오톡 오픈채팅
          </a>
          으로 남겨주세요.
        </p>
      )}

      {tab === 'mysteryroom' && (
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
          모둠이 같은 방에 들어가, 추리와 토론으로 문제를 해결하는 협력 게임입니다.
          역할마다 다른 관점과 자료를 가지고 있어서, 말하고 공유해야 문이 열립니다.
        </p>
      )}

      {error && <div className="card">시나리오 목록을 불러오지 못했습니다.</div>}
      {!scenarios && !error && <div className="dim">불러오는 중...</div>}
      {visible && visible.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>{tab === 'tanmun' ? '탐문 수사 시나리오를 준비 중이에요. 곧 만나볼 수 있습니다.' : tab === 'mysteryroom' ? '미스터리 룸을 준비 중이에요. 곧 만나볼 수 있습니다.' : '아직 등록된 시나리오가 없어요.'}</p>
        </div>
      )}

      <div className="scenario-grid">
        {visible?.map((s, i) => (
          <ScenarioCard key={s.scenarioId} s={s} index={i} />
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 20, marginTop: 40 }}>
        <Link to="/my-results" className="dim" style={{ fontSize: 12, textDecoration: 'none' }}>
          예전에 플레이한 결과가 궁금하신가요? →
        </Link>
        <a
          href="https://blog.naver.com/zsq123/224369789157"
          target="_blank"
          rel="noopener noreferrer"
          className="dim"
          style={{ fontSize: 12, textDecoration: 'none' }}
        >
          문의하기 →
        </a>
        <Link to="/admin" className="dim" style={{ fontSize: 12, textDecoration: 'none' }}>
          관리자이신가요? →
        </Link>
      </div>
    </div>
  )
}
