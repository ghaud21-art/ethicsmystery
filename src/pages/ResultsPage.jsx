import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import ResultExportButton from '../components/ResultExportButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { evaluateEndings, computeResolutionMetrics } from '../engine/endingEvaluator.js'
import { saveLocalResult } from '../utils/localStorageStore.js'
import { saveReflectionLog } from '../firebase/reflectionApi.js'
import { getAiFeedback } from '../firebase/functionsApi.js'

function ResultsInner({ scenario }) {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { uid, tier } = useAuth()
  const { room, loading, leaveAndCleanupRoom } = useRoom()

  const handleEndGame = async () => {
    await leaveAndCleanupRoom()
    navigate('/')
  }

  const exportRef = useRef(null)
  const [answers, setAnswers] = useState({})
  const [aiFeedback, setAiFeedback] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [saved, setSaved] = useState(false)

  const culprit = scenario.characters.find((c) => c.isCulprit)
  const accusations = room?.resolution?.accusations ?? {}
  const moralChoices = room?.resolution?.moralChoices ?? {}

  const ending = useMemo(() => {
    if (!room) return null
    const metrics = computeResolutionMetrics({ accusations, moralChoices, roomClues: room.clues ?? {} })
    const endingId = evaluateEndings(scenario, metrics)
    return scenario.endings.find((e) => e.id === endingId)
  }, [room, scenario, accusations, moralChoices])

  const myCharacterId = room?.players?.[uid]?.characterId
  const myCharacter = scenario.characters.find((c) => c.id === myCharacterId)
  const myAccusedId = accusations[uid]
  const myAccusedCharacter = scenario.characters.find((c) => c.id === myAccusedId)
  const myAccusedLabel = myAccusedId === 'unknown' ? '모르겠다' : myAccusedId ? myAccusedCharacter?.name : '미응답'
  const myMoralChoiceLabel =
    moralChoices[uid] === 'reveal_all' ? '모두 공개했다' : moralChoices[uid] === 'conceal_some' ? '일부는 덮었다' : '미응답'

  const myEpilogue = useMemo(() => {
    if (!myCharacter?.epilogueCard || !myCharacter.secretRevealClueId) return null
    const revealed = !!room?.clues?.[myCharacter.secretRevealClueId]?.publishedToRoom
    return { revealed, text: revealed ? myCharacter.epilogueCard.revealed : myCharacter.epilogueCard.hidden }
  }, [myCharacter, room])

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
        '',
        '위 성찰 답변을 읽고 윤리 교사 관점에서 학생에게 줄 피드백을 한국어로 작성해줘. 다음 세 가지를 자연스러운 문단으로 포함해줘(소제목 없이):',
        '1) 답변에서 구체적으로 칭찬할 점 — 학생이 실제로 쓴 표현을 인용하며 무엇이 좋았는지',
        '2) 더 깊이 생각해보면 좋을 점 — 다그치지 않고 다음에 고민해볼 질문 형태로',
        '3) 이 학생이 앞으로 더 성장했을 때에 대한 기대와 격려의 말',
        '전체 5~6문장, 따뜻하고 진심 어린 톤으로.',
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
    <div className="page">
      <Masthead />
      <StepProgress activeIndex={4} />

      <div className="card" style={{ borderTop: '2px solid var(--gold)', position: 'relative', padding: '26px 20px' }}>
        <div className="thumb" style={{ margin: '-26px -20px 16px', height: 150, borderRadius: 0 }}>{ending.title} 이미지</div>
        <span className="stamp" style={{ position: 'absolute', top: 20, right: 20 }}>수사 종결</span>
        <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-light)', marginBottom: 10 }}>
          수사 종결
        </div>
        <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 23, margin: '0 0 12px' }}>{ending.title}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink-dim)', margin: 0 }}>{ending.message}</p>
        {ending.insight && (
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--gold-light)', margin: '12px 0 0', fontStyle: 'italic' }}>
            {ending.insight}
          </p>
        )}
        <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>{ending.themeTag}</p>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="pill pill-outline">내 캐릭터: {myCharacter?.name}</span>
          <span className="pill pill-muted">진범: {culprit?.name}</span>
        </div>
      </div>

      {myEpilogue && (
        <div className="card" style={{ borderLeft: '2px solid var(--gold)' }}>
          <div className="kicker" style={{ marginBottom: 6 }}>나만 보는 개인 에필로그</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{myEpilogue.text}</p>
        </div>
      )}

      <div className="divider-orn"><span className="divider-orn-diamond" /></div>

      <h2 className="page-title" style={{ fontSize: 19 }}>다른 결말들</h2>
      <p className="dim" style={{ marginBottom: 16 }}>같은 사건도 선택에 따라 다른 결말로 이어집니다.</p>
      <div className="col" style={{ marginBottom: 8 }}>
        {scenario.endings.map((e) => (
          <div
            key={e.id}
            className="card"
            style={
              e.id === ending.id
                ? { borderColor: 'var(--gold)', boxShadow: '0 0 0 1px var(--gold), var(--glow)' }
                : { opacity: 0.75 }
            }
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong style={{ fontFamily: 'var(--font-head)' }}>{e.title}</strong>
              {e.id === ending.id && <span className="pill pill-solid">이번 결말</span>}
            </div>
            <p className="dim" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6 }}>{e.message}</p>
            <span className="dim" style={{ fontSize: 11 }}>{e.themeTag}</span>
          </div>
        ))}
      </div>

      <div className="divider-orn"><span className="divider-orn-diamond" /></div>

      <h2 className="page-title" style={{ fontSize: 19 }}>참가자들의 선택</h2>
      <div className="col" style={{ marginBottom: 8 }}>
        {Object.entries(room.players ?? {}).map(([pUid, p]) => {
          const pCharacter = scenario.characters.find((c) => c.id === p.characterId)
          const accusedId = accusations[pUid]
          const accusedCharacter = scenario.characters.find((c) => c.id === accusedId)
          const accusedLabel = accusedId === 'unknown' ? '모르겠다' : accusedId ? accusedCharacter?.name : '미응답'
          const wasCorrect = accusedId && accusedId !== 'unknown' && accusedId === culprit?.id
          return (
            <div key={pUid} className="card row" style={{ justifyContent: 'space-between' }}>
              <div className="row">
                <div className="avatar-circle" style={{ width: 40, height: 40, fontSize: 14 }}>{p.name?.[0] ?? '?'}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.name} {pUid === uid && <span className="dim">(나)</span>}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{pCharacter?.name} · {pCharacter?.role}</div>
                </div>
              </div>
              <div className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
                <span className={`pill ${wasCorrect ? 'pill-solid' : 'pill-muted'}`}>지목: {accusedLabel}</span>
                <span className="pill pill-outline">
                  {moralChoices[pUid] === 'reveal_all' ? '모두 공개' : moralChoices[pUid] === 'conceal_some' ? '일부 은폐' : '미응답'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="divider-orn"><span className="divider-orn-diamond" /></div>

      <h2 className="page-title" style={{ fontSize: 19 }}>모든 단서</h2>
      <div className="col" style={{ marginBottom: 18 }}>
        {[...scenario.clues.phase1.items, ...scenario.clues.phase2.items].map((clue) => {
          const clueState = room.clues?.[clue.id]
          const finder = clueState?.claimedBy ? room.players?.[clueState.claimedBy]?.name : null
          return (
            <div key={clue.id} className="card" style={{ marginBottom: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13 }}>{clue.title}</strong>
                <span className={`pill ${finder ? 'pill-solid' : 'pill-muted'}`}>{finder ? `${finder} 발견` : '미발견'}</span>
              </div>
              <p className="dim" style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6 }}>{clue.content}</p>
            </div>
          )
        })}
      </div>

      <hr className="divider" />

      <h2 className="page-title" style={{ fontSize: 19 }}>성찰 기록</h2>
      <p className="dim" style={{ marginBottom: 16 }}>오늘의 딜레마를 돌아보며 답해보세요. 작성한 내용은 아래 "나의 플레이 기록"에 자동으로 반영됩니다.</p>

      <div className="col" style={{ marginBottom: 18 }}>
        {scenario.reflectionPrompts.map((q, i) => (
          <div key={i} className="col" style={{ gap: 5 }}>
            <label className="dim" style={{ fontSize: 12 }}>{q}</label>
            <textarea
              rows={2}
              value={answers[i] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {tier === 'homeSchoolStudent' ? (
        <button className="primary" onClick={handleReflectionSubmit} disabled={aiBusy} style={{ width: '100%', textAlign: 'left', marginBottom: 18 }}>
          {aiBusy ? 'AI 피드백 생성 중...' : '성찰 기록 제출하기'}
        </button>
      ) : (
        <p className="dim" style={{ fontSize: 12, marginBottom: 18 }}>게스트 모드에서는 이 기기에만 결과가 저장되며 AI 피드백은 제공되지 않습니다.</p>
      )}
      {aiError && <p style={{ color: 'var(--blood-light)' }}>{aiError}</p>}

      <div className="divider-orn"><span className="divider-orn-diamond" /></div>

      {/* html2canvas는 <textarea>/<input> 내부 값을 그리지 못하므로, 저장용 요약은
          별도의 일반 텍스트 블록으로 렌더링한다(입력 폼과 분리). */}
      <div ref={exportRef} className="card" style={{ padding: '22px 20px' }}>
        <div className="kicker" style={{ marginBottom: 4 }}>나의 플레이 기록</div>
        <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, margin: '0 0 4px' }}>{scenario.meta.title}</h2>
        <p className="dim" style={{ fontSize: 12, margin: '0 0 14px' }}>{ending.title} · {myCharacter?.name} ({myCharacter?.role})</p>

        <div className="row" style={{ marginBottom: 14 }}>
          <span className="pill pill-outline">나의 지목: {myAccusedLabel}</span>
          <span className="pill pill-outline">나의 선택: {myMoralChoiceLabel}</span>
        </div>

        <div className="col">
          {scenario.reflectionPrompts.map((q, i) => (
            <div key={i}>
              <p className="dim" style={{ fontSize: 12, margin: '0 0 3px' }}>{q}</p>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{answers[i] || '(무응답)'}</p>
            </div>
          ))}
        </div>

        {aiFeedback && (
          <>
            <hr className="divider" style={{ margin: '16px 0' }} />
            <p className="dim" style={{ fontSize: 12, margin: '0 0 3px' }}>AI 피드백</p>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{aiFeedback}</p>
          </>
        )}
      </div>

      <div style={{ marginTop: 12, marginBottom: 18 }}>
        <ResultExportButton targetRef={exportRef} filename={`${scenario.scenarioId}-my-record.png`} />
      </div>

      <hr className="divider" />
      <button onClick={handleEndGame}>게임 종료 (메인 화면으로)</button>
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
