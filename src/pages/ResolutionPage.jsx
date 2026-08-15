import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import AccusationForm from '../components/AccusationForm.jsx'
import MoralChoiceForm from '../components/MoralChoiceForm.jsx'
import RoleInfoTabs from '../components/RoleInfoTabs.jsx'
import MyCluesPanel from '../components/MyCluesPanel.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { resolveAccusationOptions } from '../engine/resolutionOptions.js'
import { getPlayableCharacters } from '../engine/characterAssignment.js'
import { getVisibleSecretLayers } from '../engine/visibility.js'

function SelfReportStep({ question, value, onChange }) {
  return (
    <>
      <hr className="divider" />
      <h2 className="page-title" style={{ fontSize: 19 }}>{question.question}</h2>
      <div className="col" style={{ marginBottom: 24, marginTop: 12 }}>
        {question.options.map((label, i) => {
          const optValue = i === 0 ? 'revealed' : 'hidden' // options[0] = "밝혀졌다" 계열, options[1] = "끝까지 숨겼다" 계열
          return (
            <button
              key={optValue}
              onClick={() => onChange(optValue)}
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                background: value === optValue ? 'rgba(201,162,39,.14)' : 'var(--panel2)',
                border: value === optValue ? '1px solid var(--gold)' : '1px solid var(--line)',
                color: 'var(--ink)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </>
  )
}

function ResolutionInner({ scenario }) {
  const { scenarioId, roomCode } = useParams()
  const navigate = useNavigate()
  const { uid } = useAuth()
  const { room, loading, submitAccusation, submitMoralChoice, submitSelfReport, finishGame } = useRoom()
  const [roleOpen, setRoleOpen] = useState(false)
  const [cluesOpen, setCluesOpen] = useState(false)
  const [castOpen, setCastOpen] = useState(false)

  useEffect(() => {
    if (room?.meta?.phase === 'ended') {
      navigate(`/scenario/${scenarioId}/room/${roomCode}/results`)
    }
  }, [room, scenarioId, roomCode, navigate])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room) return <div className="card">방을 찾을 수 없습니다.</div>

  const isHost = room.meta.hostUid === uid
  const myCharacterId = room.players?.[uid]?.characterId
  const playableCharacters = getPlayableCharacters(scenario, room.meta.playerCount)
  const myCharacter = playableCharacters.find((c) => c.id === myCharacterId)
  const mySecretLayers = getVisibleSecretLayers(scenario, myCharacterId, room.meta.playerCount)
  const accusationOptions = resolveAccusationOptions(scenario, room.meta.playerCount)

  const accusations = room.resolution?.accusations ?? {}
  const moralChoices = room.resolution?.moralChoices ?? {}
  const selfReports = room.resolution?.selfReport ?? {}

  const mySelfReportQuestion = scenario.finalReflectionCheck?.questions?.find((q) => q.characterId === myCharacterId)

  const players = Object.keys(room.players)
  const allAccused = players.every((p) => accusations[p])
  const allChose = players.every((p) => moralChoices[p])
  const allSelfReported = !scenario.finalReflectionCheck || players.every((p) => selfReports[p])
  const canFinish = allAccused && allChose && allSelfReported

  const accusationStep = scenario.resolutionPhase.steps.find((s) => s.id === 'accusation')
  const moralStep = scenario.resolutionPhase.steps.find((s) => s.id === 'moral_choice')
  const moralOptions = moralStep?.options?.every((o) => typeof o === 'object') ? moralStep.options : undefined

  return (
    <div className="page">
      <Masthead />
      <StepProgress activeIndex={3} />

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

      <h1 className="page-title">{accusationStep?.prompt ?? '범인 지목'}</h1>
      <div className="page-title-rule" />
      <p className="dim" style={{ marginBottom: 16 }}>확보한 단서를 바탕으로 진짜 책임자를 지목하세요.</p>

      <AccusationForm options={accusationOptions} value={accusations[uid]} onChange={submitAccusation} />

      <hr className="divider" />

      <MoralChoiceForm prompt={moralStep?.prompt} value={moralChoices[uid]} onChange={submitMoralChoice} options={moralOptions} />

      {mySelfReportQuestion && (
        <SelfReportStep question={mySelfReportQuestion} value={selfReports[uid]} onChange={submitSelfReport} />
      )}

      <p className="dim" style={{ fontSize: 12 }}>
        {players.filter((p) => accusations[p]).length}/{players.length}명 지목 완료 ·{' '}
        {players.filter((p) => moralChoices[p]).length}/{players.length}명 응답 완료
        {scenario.finalReflectionCheck && ` · ${players.filter((p) => selfReports[p]).length}/${players.length}명 자기 응답 완료`}
      </p>

      {isHost && (
        <button
          className="primary"
          onClick={finishGame}
          disabled={!canFinish}
          style={{ width: '100%', textAlign: 'left' }}
        >
          결과 확인하기
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
