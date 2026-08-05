import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'

function WaitingRoomInner() {
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
    <div>
      <h2>방 코드: {roomCode}</h2>
      <p className="dim">다른 플레이어에게 이 코드를 알려주세요 ({room.meta.playerCount}인용)</p>

      <div className="card col">
        <h4>참가자 ({players.length}/{room.meta.playerCount})</h4>
        {players.map(([pUid, p]) => (
          <div key={pUid} className="row">
            <span>{p.name}</span>
            {pUid === room.meta.hostUid && <span className="dim">(방장)</span>}
            {pUid === uid && <span className="dim">(나)</span>}
          </div>
        ))}
      </div>

      {isHost ? (
        <button className="primary" onClick={startGame} disabled={!canStart}>
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
      {() => <WaitingRoomInner />}
    </RoomPageShell>
  )
}
