import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import AccusationForm from '../components/AccusationForm.jsx'
import MoralChoiceForm from '../components/MoralChoiceForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { resolveAccusationOptions } from '../engine/resolutionOptions.js'

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

  useEffect(() => {
    if (room?.meta?.phase === 'ended') {
      navigate(`/scenario/${scenarioId}/room/${roomCode}/results`)
    }
  }, [room, scenarioId, roomCode, navigate])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room) return <div className="card">방을 찾을 수 없습니다.</div>

  const isHost = room.meta.hostUid === uid
  const myCharacterId = room.players?.[uid]?.characterId
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
