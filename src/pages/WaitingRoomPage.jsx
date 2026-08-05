import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import NarrationScript from '../components/NarrationScript.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'

function WaitingRoomInner({ scenario }) {
  const { scenarioId, roomCode } = useParams()
  const navigate = useNavigate()
  const { uid } = useAuth()
  const { room, loading, startGame } = useRoom()

  useEffect(() => {
    if (room?.meta?.phase === 'phase1') {
      navigate(`/scenario/${scenarioId}/room/${roomCode}/play`)
    }
  }, [room, scenarioId, roomCode, navigate])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room) return <div className="card">방을 찾을 수 없습니다.</div>

  const players = Object.entries(room.players ?? {})
  const isHost = room.meta.hostUid === uid
  const canStart = players.length === room.meta.playerCount

  return (
    <div className="page">
      <Masthead showBack />
      <StepProgress activeIndex={1} />

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
        PARTY ROSTER
      </div>
      <h1 className="page-title">모둠 준비 확인</h1>
      <div className="page-title-rule" />
      <p className="dim" style={{ marginBottom: 20 }}>
        방 코드 <strong style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>{roomCode}</strong>를 다른 플레이어에게 알려주세요 ({room.meta.playerCount}인용)
      </p>

      <div className="card col">
        {players.map(([pUid, p]) => (
          <div key={pUid} className="row" style={{ justifyContent: 'space-between', padding: '8px 10px', background: 'var(--panel2)', borderRadius: 3 }}>
            <div className="row">
              <div
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(201,162,39,.16)', color: 'var(--gold-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 12,
                }}
              >
                {p.name?.[0] ?? '?'}
              </div>
              <strong>{p.name}</strong>
            </div>
            <span className="pill pill-outline">
              {pUid === room.meta.hostUid ? '방장' : '참가자'}{pUid === uid ? ' · 나' : ''}
            </span>
          </div>
        ))}
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>
          {players.length}/{room.meta.playerCount}명 모임
        </p>
      </div>

      {scenario.narration?.opening && (
        <NarrationScript title="오프닝 내레이션" lines={scenario.narration.opening} characters={scenario.characters} />
      )}

      {isHost ? (
        <button className="primary" onClick={startGame} disabled={!canStart} style={{ width: '100%', textAlign: 'left' }}>
          {canStart ? '게임 시작' : `인원이 다 모이면 시작할 수 있어요 (${players.length}/${room.meta.playerCount})`}
        </button>
      ) : (
        <p className="dim">방장이 시작하기를 기다리는 중...</p>
      )}
    </div>
  )
}

export default function WaitingRoomPage() {
  const { scenarioId, roomCode } = useParams()
  return (
    <RoomPageShell scenarioId={scenarioId} roomCode={roomCode}>
      {(scenario) => <WaitingRoomInner scenario={scenario} />}
    </RoomPageShell>
  )
}
