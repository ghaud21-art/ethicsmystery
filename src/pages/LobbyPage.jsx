import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
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
  const [schoolCode, setSchoolCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleVerifySchoolCode = async () => {
    setBusy(true)
    setError(null)
    try {
      await verifySchoolCode(schoolCode)
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
      <h2>{scenario.meta.title}</h2>
      <p className="dim">{scenario.meta.subtitle}</p>

      <div className="card">
        <h4>등급</h4>
        {tier === 'homeSchoolStudent' ? (
          <p>✅ 우리 학교 학생 인증 완료 — 성찰 기록 저장, AI 피드백 사용 가능</p>
        ) : (
          <div className="row">
            <input
              placeholder="학교 코드 (선택)"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
            />
            <button onClick={handleVerifySchoolCode} disabled={busy || !schoolCode}>
              인증하기
            </button>
            <span className="dim">입력하지 않으면 게스트로 진행됩니다 (기록은 이 기기에만 저장)</span>
          </div>
        )}
      </div>

      <div className="card col">
        <h4>내 이름</h4>
        <input placeholder="닉네임" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>

      <div className="card col">
        <h4>새 방 만들기</h4>
        <div className="row">
          <label>인원수</label>
          <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
            {scenario.meta.supportedPlayerCounts.map((n) => (
              <option key={n} value={n}>
                {n}인
              </option>
            ))}
          </select>
          <button className="primary" onClick={handleCreate} disabled={busy}>
            방 만들기
          </button>
        </div>
      </div>

      <div className="card col">
        <h4>방 코드로 참가</h4>
        <div className="row">
          <input
            placeholder="예: A3F9"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            maxLength={4}
          />
          <button onClick={handleJoin} disabled={busy}>
            참가하기
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--warn)' }}>{error}</p>}
    </div>
  )
}

export default function LobbyPage() {
  const { scenarioId } = useParams()
  return <RoomPageShell scenarioId={scenarioId}>{(scenario) => <LobbyInner scenario={scenario} />}</RoomPageShell>
}
