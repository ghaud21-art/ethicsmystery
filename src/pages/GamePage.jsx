import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import ClueBoard from '../components/ClueBoard.jsx'
import RoleInfoTabs from '../components/RoleInfoTabs.jsx'
import NarrationScript from '../components/NarrationScript.jsx'
import APBar from '../components/APBar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { getPhaseApBudget } from '../engine/apEngine.js'
import { getVisibleSecretLayers } from '../engine/visibility.js'

function GameInner({ scenario }) {
  const { scenarioId, roomCode } = useParams()
  const navigate = useNavigate()
  const { uid } = useAuth()
  const { room, loading, claimClue, publishClue, markReady, advanceToPhase2, advanceToResolution } = useRoom()
  const [roleOpen, setRoleOpen] = useState(false)

  useEffect(() => {
    if (room?.meta?.phase === 'resolution') {
      navigate(`/scenario/${scenarioId}/room/${roomCode}/resolve`)
    }
  }, [room, scenarioId, roomCode, navigate])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room) return <div className="card">방을 찾을 수 없습니다.</div>

  const phase = room.meta.phase // 'phase1' | 'phase2' — 다른 값(예: 전환 중 'resolution')이면 아래에서 렌더 없이 대기
  if (phase !== 'phase1' && phase !== 'phase2') {
    return <div className="page dim">다음 단계로 이동 중...</div>
  }

  const myCharacterId = room.players?.[uid]?.characterId
  const myCharacter = scenario.characters.find((c) => c.id === myCharacterId)
  const isHost = room.meta.hostUid === uid
  const maxAp = getPhaseApBudget(scenario, phase, room.meta.playerCount)
  const myAp = room.players?.[uid]?.ap?.[phase] ?? 0

  const targetPhase = phase === 'phase1' ? 'phase2' : 'resolution'
  const players = Object.keys(room.players)
  const readyMap = room.ready?.[targetPhase] ?? {}
  const readyCount = players.filter((p) => readyMap[p]).length
  const allReady = players.length > 0 && readyCount === players.length
  const iAmReady = !!readyMap[uid]

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
  const handleAdvance = phase === 'phase1' ? advanceToPhase2 : advanceToResolution

  return (
    <div className="page">
      <Masthead />
      <StepProgress activeIndex={2} />

      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13 }}>
          <span className="dim">{myCharacter?.role}</span> · <strong>{myCharacter?.name}</strong>
        </div>
        <APBar current={myAp} max={maxAp} />
      </div>

      <div className="icon-nav">
        <button className="icon-nav-button" onClick={() => setRoleOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
          </svg>
          내 역할
        </button>
      </div>

      <h2 className="page-title" style={{ fontSize: 20 }}>
        {phase === 'phase1' ? scenario.clues.phase1.label : scenario.clues.phase2.label}
      </h2>
      <div className="page-title-rule" />

      {phase === 'phase1' && scenario.narration?.phase1Intro && (
        <NarrationScript
          title={scenario.narration.phase1Intro.title}
          lines={scenario.narration.phase1Intro.lines}
          characters={scenario.characters}
        />
      )}
      {phase === 'phase2' && scenario.narration?.phase2Intro && (
        <NarrationScript
          title={scenario.narration.phase2Intro.title}
          lines={scenario.narration.phase2Intro.lines}
          characters={scenario.characters}
        />
      )}

      <ClueBoard
        scenario={scenario}
        phase={phase}
        room={room}
        uid={uid}
        myCharacterId={myCharacterId}
        onClaim={handleClaim}
        onPublish={handlePublish}
      />

      <div className="card row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
        <span className="dim" style={{ fontSize: 12 }}>
          {phase === 'phase1' ? '심층 대질' : '결론'} 준비: {readyCount}/{players.length}명
        </span>
        <button onClick={() => markReady(targetPhase)} disabled={iAmReady}>
          {iAmReady ? '준비 완료함' : '나도 준비 완료'}
        </button>
      </div>

      {isHost && (
        <button
          className="primary"
          onClick={handleAdvance}
          disabled={!allReady}
          style={{ width: '100%', textAlign: 'left', marginTop: 10 }}
        >
          {allReady
            ? (phase === 'phase1' ? '심층 대질 단계로 →' : '결론으로 →')
            : `모두 준비되면 진행할 수 있어요 (${readyCount}/${players.length})`}
        </button>
      )}

      {roleOpen && (
        <div className="modal-overlay" onClick={() => setRoleOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">내 역할</div>
            <RoleInfoTabs character={myCharacter} secretLayers={getVisibleSecretLayers(scenario, myCharacterId)} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setRoleOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
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
