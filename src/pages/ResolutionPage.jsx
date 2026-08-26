import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import AccusationForm from '../components/AccusationForm.jsx'
import MoralChoiceForm from '../components/MoralChoiceForm.jsx'
import RoleInfoTabs from '../components/RoleInfoTabs.jsx'
import MyCluesPanel from '../components/MyCluesPanel.jsx'
import JudgingReferenceModal from '../components/JudgingReferenceModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { resolveAccusationOptions } from '../engine/resolutionOptions.js'
import { getPlayableCharacters, getEffectiveCharacterId } from '../engine/characterAssignment.js'
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

// 정답/오답이 없는 순수 서술형 질문을 캐릭터별로 던져놓고, 학생들이 직접 입으로
// 답하도록 유도하는 스텝 — 앱이 텍스트를 수집·저장하지 않고 대본처럼 보여주기만 한다
// (기존 내레이션 스크립트와 같은 방식). questions는 부모가 캐릭터 이름까지 해석해
// 넘긴다(3인 통합 캐릭터 치환 포함).
function RoleplayQuestionsStep({ step, questions }) {
  return (
    <>
      <hr className="divider" />
      <h2 className="page-title" style={{ fontSize: 19 }}>{step.name ?? '자기보고 질문'}</h2>
      {step.note && <p className="dim" style={{ fontSize: 12, marginBottom: 12 }}>{step.note}</p>}
      <div className="col" style={{ marginBottom: 24 }}>
        {questions.map((q, i) => (
          <div key={i} className="card" style={{ marginBottom: 0 }}>
            <strong style={{ fontFamily: 'var(--font-head)', fontSize: 13 }}>{q.characterName}</strong>
            <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6 }}>{q.question}</p>
          </div>
        ))}
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
  const [referenceOpen, setReferenceOpen] = useState(false)

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
  const roleplayQuestionsStep = scenario.resolutionPhase.steps.find((s) => s.id === 'roleplay_questions')
  // 3인 통합 캐릭터로 흡수된 인물의 질문은 통합 캐릭터의 이름으로 표시한다.
  const roleplayQuestions = (roleplayQuestionsStep?.questions ?? []).map((q) => {
    const effectiveId = getEffectiveCharacterId(scenario, q.characterId, room.meta.playerCount)
    const character = playableCharacters.find((c) => c.id === effectiveId)
    return { ...q, characterName: character?.name ?? q.characterId }
  })
  // 지목 안내 문구 — 시나리오가 hint를 주면 그대로 쓰고, 없으면 기본 문구
  // (선택지가 인물이 아닌 시나리오에서 "책임자를 지목하세요"가 어긋나는 것 방지).
  const accusationHint = accusationStep?.hint ?? '확보한 단서를 바탕으로 진짜 책임자를 지목하세요.'

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
        {scenario.judgingReference && (
          <button className="icon-nav-button" onClick={() => setReferenceOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
            판정 기준
          </button>
        )}
      </div>

      <h1 className="page-title">{accusationStep?.prompt ?? '범인 지목'}</h1>
      <div className="page-title-rule" />
      <p className="dim" style={{ marginBottom: 16 }}>{accusationHint}</p>

      <AccusationForm options={accusationOptions} value={accusations[uid]} onChange={submitAccusation} />

      {roleplayQuestionsStep && <RoleplayQuestionsStep step={roleplayQuestionsStep} questions={roleplayQuestions} />}

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

      {referenceOpen && <JudgingReferenceModal reference={scenario.judgingReference} onClose={() => setReferenceOpen(false)} />}
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
