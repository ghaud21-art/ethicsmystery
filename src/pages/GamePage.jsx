import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import ClueBoard from '../components/ClueBoard.jsx'
import CharacterSheet from '../components/CharacterSheet.jsx'
import SecretLayerPanel from '../components/SecretLayerPanel.jsx'
import APBar from '../components/APBar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { getPhaseApBudget } from '../engine/apEngine.js'
import { getVisibleSecretLayers } from '../engine/visibility.js'

function GameInner({ scenario }) {
  const { scenarioId, roomCode } = useParams()
  const navigate = useNavigate()
  const { uid } = useAuth()
  const { room, loading, claimClue, publishClue, advanceToPhase2, advanceToResolution } = useRoom()

  useEffect(() => {
    if (room?.meta?.phase === 'resolution') {
      navigate(`/scenario/${scenarioId}/room/${roomCode}/resolve`)
    }
  }, [room, scenarioId, roomCode, navigate])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room) return <div className="card">방을 찾을 수 없습니다.</div>

  const phase = room.meta.phase // 'phase1' | 'phase2'
  const myCharacterId = room.players?.[uid]?.characterId
  const myCharacter = scenario.characters.find((c) => c.id === myCharacterId)
  const isHost = room.meta.hostUid === uid
  const maxAp = getPhaseApBudget(scenario, phase, room.meta.playerCount)
  const myAp = room.players?.[uid]?.ap?.[phase] ?? 0

  const handleClaim = async (clueId) => {
    try {
      await claimClue(clueId, phase)
    } catch (e) {
      alert(e.message)
    }
  }
  const handlePublish = async (clueId) => {
    try {
      await publishClue(clueId)
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <h2>{phase === 'phase1' ? scenario.clues.phase1.label : scenario.clues.phase2.label}</h2>
      <APBar current={myAp} max={maxAp} />

      <CharacterSheet character={myCharacter} />
      <SecretLayerPanel layers={getVisibleSecretLayers(scenario, myCharacterId)} />

      <h3>단서</h3>
      <ClueBoard
        scenario={scenario}
        phase={phase}
        room={room}
        uid={uid}
        myCharacterId={myCharacterId}
        onClaim={handleClaim}
        onPublish={handlePublish}
      />

      {isHost && (
        <button
          className="primary"
          onClick={phase === 'phase1' ? advanceToPhase2 : advanceToResolution}
        >
          {phase === 'phase1' ? '심층 대질 단계로' : '결론으로'}
        </button>
      )}
    </div>
  )
}

export default function GamePage() {
  const { scenarioId, roomCode } = useParams()
  return (
    <RoomPageShell scenarioId={scenarioId} roomCode={roomCode}>
      {(scenario) => <GameInner scenario={scenario} />}
    </RoomPageShell>
  )
}
