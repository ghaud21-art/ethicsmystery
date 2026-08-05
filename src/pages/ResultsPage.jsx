import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import ResultExportButton from '../components/ResultExportButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { evaluateScenarioEndings } from '../engine/endingRules/index.js'
import { saveLocalResult } from '../utils/localStorageStore.js'
import { saveReflectionLog } from '../firebase/reflectionApi.js'
import { getAiFeedback } from '../firebase/functionsApi.js'

function ResultsInner({ scenario }) {
  const { roomCode } = useParams()
  const { uid, tier } = useAuth()
  const { room, loading, leaveAndCleanupRoom } = useRoom()

  const exportRef = useRef(null)
  const [answers, setAnswers] = useState({})
  const [aiFeedback, setAiFeedback] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [saved, setSaved] = useState(false)

  const culprit = scenario.characters.find((c) => c.isCulprit)
  const accusations = room?.resolution?.accusations ?? {}
  const moralChoices = room?.resolution?.moralChoices ?? {}
  const selfConfess = room?.resolution?.selfConfess ?? {}

  const ending = useMemo(() => {
    if (!room) return null
    const accusationValues = Object.values(accusations)
    const metrics = {
      accusationCorrect: accusationValues[0] === culprit?.id,
      accusations,
      moralChoices,
      selfConfessTriggeredBy: Object.keys(selfConfess)[0] ?? null,
    }
    const endingId = evaluateScenarioEndings(scenario.scenarioId, metrics)
    return scenario.endings.find((e) => e.id === endingId)
  }, [room, scenario, culprit])

  const myCharacterId = room?.players?.[uid]?.characterId
  const myCharacter = scenario.characters.find((c) => c.id === myCharacterId)

  useEffect(() => {
    if (!room || !ending || saved) return
    saveLocalResult({
      scenarioId: scenario.scenarioId,
      roomCode,
      characterId: myCharacterId,
      endingId: ending.id,
      endingTitle: ending.title,
    })
    setSaved(true)
  }, [room, ending, saved, scenario, roomCode, myCharacterId])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room || !ending) return <div className="card">결과를 불러올 수 없습니다.</div>

  const handleReflectionSubmit = async () => {
    if (tier !== 'homeSchoolStudent') return
    setAiBusy(true)
    setAiError(null)
    try {
      const reflectionLogId = await saveReflectionLog({
        uid,
        scenarioId: scenario.scenarioId,
        roomCode,
        characterId: myCharacterId,
        answers,
        resultSummary: { endingId: ending.id, endingTitle: ending.title },
      })
      const prompt = [
        `시나리오: ${scenario.meta.title}`,
        `내 캐릭터: ${myCharacter?.name} (${myCharacter?.role})`,
        `결말: ${ending.title} — ${ending.message}`,
        '학생의 성찰 답변:',
        ...scenario.reflectionPrompts.map((q, i) => `Q${i + 1}. ${q}\nA${i + 1}. ${answers[i] ?? '(무응답)'}`),
        '위 성찰 답변에 대해 윤리 교사 관점에서 따뜻하고 구체적인 피드백을 3~4문장으로 한국어로 작성해줘.',
      ].join('\n')
      const { feedback } = await getAiFeedback({ reflectionLogId, prompt })
      setAiFeedback(feedback)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div ref={exportRef}>
      <h2>{ending.title}</h2>
      <p>{ending.message}</p>
      <p className="dim">{ending.themeTag}</p>

      <div className="card">
        <h4>내 캐릭터: {myCharacter?.name}</h4>
        <p className="dim">진범: {culprit?.name}</p>
      </div>

      <div className="card col">
        <h4>성찰</h4>
        {scenario.reflectionPrompts.map((q, i) => (
          <div key={i} className="col">
            <label>{q}</label>
            <textarea
              rows={2}
              value={answers[i] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
            />
          </div>
        ))}

        {tier === 'homeSchoolStudent' ? (
          <button className="primary" onClick={handleReflectionSubmit} disabled={aiBusy}>
            {aiBusy ? 'AI 피드백 생성 중...' : '성찰 저장 + AI 피드백 받기'}
          </button>
        ) : (
          <p className="dim">게스트 모드에서는 이 기기에만 결과가 저장되며 AI 피드백은 제공되지 않습니다.</p>
        )}
        {aiError && <p style={{ color: 'var(--warn)' }}>{aiError}</p>}
        {aiFeedback && (
          <div className="card">
            <strong>AI 피드백</strong>
            <p>{aiFeedback}</p>
          </div>
        )}
      </div>

      <div className="row">
        <ResultExportButton targetRef={exportRef} filename={`${scenario.scenarioId}-result.png`} />
        <button onClick={leaveAndCleanupRoom}>게임 종료 (방 삭제)</button>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const { scenarioId, roomCode } = useParams()
  return (
    <RoomPageShell scenarioId={scenarioId} roomCode={roomCode}>
      {(scenario) => <ResultsInner scenario={scenario} />}
    </RoomPageShell>
  )
}
