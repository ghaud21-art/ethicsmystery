import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import ClueBoard from '../components/ClueBoard.jsx'
import RoleInfoTabs from '../components/RoleInfoTabs.jsx'
import NarrationScript from '../components/NarrationScript.jsx'
import APBar from '../components/APBar.jsx'
import PhaseTimer from '../components/PhaseTimer.jsx'
import MyCluesPanel from '../components/MyCluesPanel.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { getPhaseApBudget } from '../engine/apEngine.js'
import { getVisibleSecretLayers } from '../engine/visibility.js'
import { getPlayableCharacters } from '../engine/characterAssignment.js'

function BriefingScreen({ character, secretLayers, onContinue }) {
  return (
    <div className="page">
      <Masthead showBack />
      <StepProgress activeIndex={2} />

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
        </svg>
        캐릭터 브리핑
      </div>
      <h1 className="page-title">{character?.name}</h1>
      <p className="dim" style={{ marginBottom: 14 }}>{character?.role}</p>
      <div className="page-title-rule" />

      <p className="dim" style={{ fontSize: 12 }}>공개 정보</p>
      <p style={{ fontSize: 14, lineHeight: 1.75 }}>{character?.publicInfo}</p>

      <p className="dim" style={{ fontSize: 12 }}>상세 정보</p>
      <p style={{ fontSize: 14, lineHeight: 1.75 }}>{character?.detailInfo}</p>

      {secretLayers?.length > 0 && (
        <>
          <p className="dim" style={{ fontSize: 12 }}>나만 아는 비밀</p>
          <div className="col" style={{ marginBottom: 20 }}>
            {secretLayers.map((layer) => (
              <p
                key={layer.layer}
                style={{
                  margin: 0, fontSize: 14, lineHeight: 1.75, color: 'var(--gold-light)',
                  background: 'rgba(201,162,39,.14)', padding: 12, borderLeft: '2px solid var(--gold)',
                }}
              >
                {layer.content}
              </p>
            ))}
          </div>
        </>
      )}

      <button className="primary" onClick={onContinue} style={{ width: '100%', textAlign: 'left' }}>
        준비됐습니다 — 조사 시작하기 →
      </button>
    </div>
  )
}

function GameInner({ scenario }) {
  const { scenarioId, roomCode } = useParams()
  const navigate = useNavigate()
  const { uid } = useAuth()
  const {
    room, loading, claimClue, publishClue, markReady, markBriefingSeen,
    advanceToPhase2, advanceToResolution,
  } = useRoom()
  const [roleOpen, setRoleOpen] = useState(false)
  const [cluesOpen, setCluesOpen] = useState(false)
  const [castOpen, setCastOpen] = useState(false)
  const [timeUpNoticeOpen, setTimeUpNoticeOpen] = useState(false)
  const [timeUp, setTimeUp] = useState(false)

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
  const playableCharacters = getPlayableCharacters(scenario, room.meta.playerCount)
  const myCharacter = playableCharacters.find((c) => c.id === myCharacterId)
  const mySecretLayers = getVisibleSecretLayers(scenario, myCharacterId, room.meta.playerCount)

  // phase1에 처음 들어오면 캐릭터 브리핑(상세설명+비밀)을 먼저 읽게 한다.
  if (phase === 'phase1' && !room.players?.[uid]?.briefingSeen) {
    return <BriefingScreen character={myCharacter} secretLayers={mySecretLayers} onContinue={markBriefingSeen} />
  }

  const isHost = room.meta.hostUid === uid
  const maxAp = getPhaseApBudget(scenario, phase, room.meta.playerCount)
  const myAp = room.players?.[uid]?.ap?.[phase] ?? 0

  const targetPhase = phase === 'phase1' ? 'phase2' : 'resolution'
  const players = Object.keys(room.players)
  const readyMap = room.ready?.[targetPhase] ?? {}
  const readyCount = players.filter((p) => readyMap[p]).length
  const allReady = players.length > 0 && readyCount === players.length
  const iAmReady = !!readyMap[uid]
  const canAdvance = allReady || timeUp

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
  const handleTimeExpire = () => {
    setTimeUp(true)
    setTimeUpNoticeOpen(true)
  }

  return (
    <div className="page">
      <Masthead />
      <StepProgress activeIndex={2} />

      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13 }}>
          <span className="dim">{myCharacter?.role}</span> · <strong>{myCharacter?.name}</strong>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <PhaseTimer
            startedAt={room.meta.phaseStartedAt}
            durationMinutes={scenario.meta.phaseDurationMinutes?.[phase]}
            onExpire={handleTimeExpire}
          />
          <APBar current={myAp} max={maxAp} />
        </div>
      </div>

      <div className="icon-nav">
        <button className="icon-nav-button" onClick={() => setRoleOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
          </svg>
          내 역할
        </button>
        <button className="icon-nav-button" onClick={() => setCluesOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          내 단서
        </button>
        <button className="icon-nav-button" onClick={() => setCastOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          등장인물
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
          disabled={!canAdvance}
          style={{ width: '100%', textAlign: 'left', marginTop: 10 }}
        >
          {canAdvance
            ? (phase === 'phase1' ? '심층 대질 단계로 →' : '결론으로 →')
            : `모두 준비되면 진행할 수 있어요 (${readyCount}/${players.length})`}
        </button>
      )}

      {roleOpen && (
        <div className="modal-overlay" onClick={() => setRoleOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">내 역할</div>
            <RoleInfoTabs character={myCharacter} secretLayers={mySecretLayers} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setRoleOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {cluesOpen && (
        <div className="modal-overlay" onClick={() => setCluesOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">내 단서</div>
            <MyCluesPanel scenario={scenario} room={room} uid={uid} myCharacterId={myCharacterId} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setCluesOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {castOpen && (
        <div className="modal-overlay" onClick={() => setCastOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">등장인물</div>
            <div className="col">
              {playableCharacters
                .filter((c) => c.id !== myCharacterId)
                .map((c) => {
                  const playerEntry = Object.values(room.players ?? {}).find((p) => p.characterId === c.id)
                  return (
                    <div key={c.id} className="card row" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                      <div className="avatar-circle">{c.name[0]}</div>
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                          {playerEntry && <span className="pill pill-outline">{playerEntry.name}</span>}
                        </div>
                        <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>{c.role}</div>
                        <div className="dim" style={{ fontSize: 12, lineHeight: 1.5 }}>{c.publicInfo}</div>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setCastOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {timeUpNoticeOpen && (
        <div className="modal-overlay" onClick={() => setTimeUpNoticeOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">시간이 다 됐어요!</div>
            <p style={{ margin: 0, fontSize: 14 }}>
              {isHost ? '준비가 안 된 인원이 있어도 다음 단계로 진행할 수 있어요.' : '방장이 곧 다음 단계로 진행할 거예요.'}
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="primary" onClick={() => setTimeUpNoticeOpen(false)}>확인</button>
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
