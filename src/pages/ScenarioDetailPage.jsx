import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'

const TAG_TONES = ['pill-blue', 'pill-rose', 'pill-violet', 'pill-slate']

function DetailInner({ scenario }) {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const { tier, verifySchoolCode } = useAuth()
  const { createRoom, joinRoom } = useRoom()

  const [displayName, setDisplayName] = useState('')
  const [playerCount, setPlayerCount] = useState(scenario.meta.supportedPlayerCounts[0])
  const [joinCode, setJoinCode] = useState('')
  const [schoolAuthOpen, setSchoolAuthOpen] = useState(false)
  const [schoolCode, setSchoolCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleVerifySchoolCode = async () => {
    setBusy(true)
    setError(null)
    try {
      await verifySchoolCode(schoolCode)
      setSchoolAuthOpen(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    if (!displayName) return setError('닉네임을 입력해주세요')
    setBusy(true)
    setError(null)
    try {
      const code = await createRoom(playerCount, displayName)
      navigate(`/scenario/${scenarioId}/room/${code}/wait`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (!displayName) return setError('닉네임을 입력해주세요')
    if (!joinCode) return setError('방 코드를 입력해주세요')
    setBusy(true)
    setError(null)
    try {
      await joinRoom(joinCode.toUpperCase(), displayName)
      navigate(`/scenario/${scenarioId}/room/${joinCode.toUpperCase()}/wait`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Masthead showBack />

      <div className="hero-banner">
        <svg className="hero-banner-icon" width="220" height="220" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <span className="pill pill-outline" style={{ position: 'relative', marginBottom: 10 }}>
          {scenario.meta.supportedPlayerCounts.join('/')}인용 · 약 {scenario.meta.estimatedMinutes}분
        </span>
        <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 28, margin: '0 0 8px', position: 'relative' }}>
          {scenario.meta.title}
        </h1>
        <p className="dim" style={{ margin: '0 0 12px', position: 'relative' }}>{scenario.meta.subtitle}</p>
        <div className="row" style={{ position: 'relative' }}>
          {scenario.meta.themes?.map((t, idx) => (
            <span key={t} className={`pill ${TAG_TONES[idx % TAG_TONES.length]}`}>
              <span className="pill-dot" />
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
        사건 개요
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink)', opacity: 0.9 }}>{scenario.prologue.sharedText}</p>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--gold-light)', fontStyle: 'italic' }}>
        {scenario.meta.learningObjective}
      </p>

      <div className="divider-orn">
        <span className="divider-orn-diamond" />
      </div>

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
        용의선상 인물
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 8 }}>
        {scenario.characters.map((c) => (
          <div key={c.id} className="card row" style={{ marginBottom: 0 }}>
            <div className="avatar-circle">{c.name[0]}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 14 }}>{c.name}</div>
              <div className="dim" style={{ fontSize: 12 }}>{c.role}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="divider-orn">
        <span className="divider-orn-diamond" />
      </div>

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <path d="M4 4h16v16H4z" />
        </svg>
        수사 참가하기
      </div>

      <div className="card col">
        <label className="dim" style={{ fontSize: 12 }}>닉네임</label>
        <input placeholder="이 방에서 사용할 이름" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>

      <div className="card col">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>새 방 만들기</strong>
          <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
            {scenario.meta.supportedPlayerCounts.map((n) => (
              <option key={n} value={n}>
                {n}인
              </option>
            ))}
          </select>
        </div>
        <button className="primary" onClick={handleCreate} disabled={busy} style={{ textAlign: 'left' }}>
          방 만들기
        </button>
      </div>

      <div className="card col">
        <strong>방 코드로 참가</strong>
        <div className="row">
          <input
            placeholder="예: A3F9"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            maxLength={4}
            style={{ flex: 1 }}
          />
          <button onClick={handleJoin} disabled={busy}>
            참가하기
          </button>
        </div>
      </div>

      {tier === 'homeSchoolStudent' ? (
        <p className="dim" style={{ fontSize: 12 }}>✅ 우리 학교 학생 인증 완료 — 성찰 기록 저장, AI 피드백 사용 가능</p>
      ) : schoolAuthOpen ? (
        <div className="card col">
          <label className="dim" style={{ fontSize: 12 }}>학교 코드</label>
          <div className="row">
            <input
              placeholder="학교에서 안내받은 코드"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={handleVerifySchoolCode} disabled={busy || !schoolCode}>
              인증하기
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setSchoolAuthOpen(true)}
          style={{ border: 'none', background: 'none', padding: '4px 0', fontSize: 12 }}
        >
          우리 학교 학생인가요? 학교 코드 인증하기 →
        </button>
      )}
      <p className="dim" style={{ fontSize: 12 }}>
        인증 없이도 바로 플레이할 수 있어요. 게스트는 결과가 이 기기에만 저장되고 AI 피드백은 제공되지 않습니다.
      </p>

      {error && <p style={{ color: 'var(--blood-light)' }}>{error}</p>}
    </div>
  )
}

export default function ScenarioDetailPage() {
  const { scenarioId } = useParams()
  return <RoomPageShell scenarioId={scenarioId}>{(scenario) => <DetailInner scenario={scenario} />}</RoomPageShell>
}
