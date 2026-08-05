import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'

function LobbyInner({ scenario }) {
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
    if (!displayName) return setError('이름을 입력해주세요')
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
    if (!displayName) return setError('이름을 입력해주세요')
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
    <div>
      <Masthead showBack />

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
        </svg>
        PARTY SETUP
      </div>
      <h1 className="page-title">{scenario.meta.title}</h1>
      <div className="page-title-rule" />
      <p className="dim" style={{ marginBottom: 20 }}>{scenario.meta.subtitle}</p>

      <div className="card col">
        <label className="dim" style={{ fontSize: 12 }}>내 이름</label>
        <input placeholder="닉네임" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
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
          <label className="dim" style={{ fontSize: 12 }}>학교 코드 (선택)</label>
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

export default function LobbyPage() {
  const { scenarioId } = useParams()
  return <RoomPageShell scenarioId={scenarioId}>{(scenario) => <LobbyInner scenario={scenario} />}</RoomPageShell>
}
