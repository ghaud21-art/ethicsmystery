import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import AccusationForm from '../components/AccusationForm.jsx'
import MoralChoiceForm from '../components/MoralChoiceForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { getPlayableCharacters } from '../engine/characterAssignment.js'

function ResolutionInner({ scenario }) {
  const { scenarioId, roomCode } = useParams()
  const navigate = useNavigate()
  const { uid } = useAuth()
  const { room, loading, submitAccusation, submitMoralChoice, triggerSelfConfess, finishGame } = useRoom()

  useEffect(() => {
    if (room?.meta?.phase === 'ended') {
      navigate(`/scenario/${scenarioId}/room/${roomCode}/results`)
    }
  }, [room, scenarioId, roomCode, navigate])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room) return <div className="card">방을 찾을 수 없습니다.</div>

  const isHost = room.meta.hostUid === uid
  const myCharacterId = room.players?.[uid]?.characterId
  const myCharacter = scenario.characters.find((c) => c.id === myCharacterId)
  const characters = getPlayableCharacters(scenario, room.meta.playerCount)

  const accusations = room.resolution?.accusations ?? {}
  const moralChoices = room.resolution?.moralChoices ?? {}
  const selfConfess = room.resolution?.selfConfess ?? {}

  const players = Object.keys(room.players)
  const allAccused = players.every((p) => accusations[p])
  const allChose = players.every((p) => moralChoices[p])
  const canFinish = allAccused && allChose

  const accusationStep = scenario.resolutionPhase.steps.find((s) => s.id === 'accusation')
  const moralStep = scenario.resolutionPhase.steps.find((s) => s.id === 'moral_choice')

  return (
    <div>
      <h2>결론</h2>

      <AccusationForm
        characters={characters}
        value={accusations[uid]}
        onChange={submitAccusation}
        disabled={!!selfConfess[uid]}
      />
      <p className="dim">{accusationStep?.prompt}</p>

      <MoralChoiceForm prompt={moralStep?.prompt} value={moralChoices[uid]} onChange={submitMoralChoice} />

      {myCharacter?.isCulprit && !selfConfess[uid] && (
        <div className="card">
          <p>당신은 진범입니다. 아직 들키지 않았다면, 스스로 밝힐 수도 있습니다.</p>
          <button onClick={triggerSelfConfess}>자백하기</button>
        </div>
      )}

      <p className="dim">
        {players.filter((p) => accusations[p]).length}/{players.length}명 지목 완료 ·{' '}
        {players.filter((p) => moralChoices[p]).length}/{players.length}명 응답 완료
      </p>

      {isHost && (
        <button className="primary" onClick={finishGame} disabled={!canFinish}>
          결과 확인하기
        </button>
      )}
    </div>
  )
}

export default function ResolutionPage() {
  const { scenarioId, roomCode } = useParams()
  return (
    <RoomPageShell scenarioId={scenarioId} roomCode={roomCode}>
      {(scenario) => <ResolutionInner scenario={scenario} />}
    </RoomPageShell>
  )
}
