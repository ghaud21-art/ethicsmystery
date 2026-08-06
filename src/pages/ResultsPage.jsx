import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import ResultExportButton from '../components/ResultExportButton.jsx'
import AiFeedbackView from '../components/AiFeedbackView.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { evaluateEndings, computeResolutionMetrics } from '../engine/endingEvaluator.js'
import { isClueAutoRevealed } from '../engine/visibility.js'
import { resolveAccusationOptions } from '../engine/resolutionOptions.js'
import { getPlayableCharacters, getEffectiveCharacterId } from '../engine/characterAssignment.js'
import { saveLocalResult } from '../utils/localStorageStore.js'
import { saveReflectionLog } from '../firebase/reflectionApi.js'
import { getAiFeedback } from '../firebase/functionsApi.js'

function ResultsInner({ scenario }) {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { uid, tier, studentIdentity } = useAuth()
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

  // 통합 캐릭터 3인 시나리오에서는 진범이 통합 캐릭터 쪽에 표시돼야 하므로
  // playerCount 기준의 플레이 가능 목록에서 찾는다(4인은 원본 캐릭터와 동일).
  const culprit = getPlayableCharacters(scenario, room?.meta?.playerCount).find((c) => c.isCulprit)
  const criticalClues = [...scenario.clues.phase1.items, ...scenario.clues.phase2.items].filter((c) => c.isCriticalClue)
  const accusations = room?.resolution?.accusations ?? {}
  const moralChoices = room?.resolution?.moralChoices ?? {}

  const ending = useMemo(() => {
    if (!room) return null
    const metrics = computeResolutionMetrics({ accusations, moralChoices, roomClues: room.clues ?? {}, scenario })
    const endingId = evaluateEndings(scenario, metrics, room?.meta?.playerCount)
    return scenario.endings.find((e) => e.id === endingId)
  }, [room, scenario, accusations, moralChoices])

  const myCharacterId = room?.players?.[uid]?.characterId
  const myCharacter = getPlayableCharacters(scenario, room?.meta?.playerCount).find((c) => c.id === myCharacterId)
  const myAccusedId = accusations[uid]
  const accusationOptions = resolveAccusationOptions(scenario, room?.meta?.playerCount)
  const myAccusedLabel = myAccusedId ? accusationOptions.find((o) => o.id === myAccusedId)?.label ?? myAccusedId : '미응답'
  const myMoralChoiceLabel =
    moralChoices[uid] === 'reveal_all' ? '모두 공개했다' : moralChoices[uid] === 'conceal_some' ? '일부는 덮었다' : '미응답'

  const selfReports = room?.resolution?.selfReport ?? {}

  // 두 가지 개인 에필로그 방식을 모두 지원한다:
  // 1) 자기보고형(finalReflectionCheck) — 시스템이 판정하지 않고 플레이어가 직접
  //    "밝혀졌다/끝까지 숨겼다"를 답한 값을 그대로 쓴다.
  // 2) 단서공개형(epilogueCard) — 팀이 게임 중 내 비밀 단서를 공개했거나, 결론
  //    단계에서 "모두 공개하겠다"를 선택했다면 드러난 것으로 본다.
  const myEpilogue = useMemo(() => {
    if (myCharacter?.epilogueA !== undefined && myCharacter?.epilogueB !== undefined) {
      const revealed = selfReports[uid] === 'revealed'
      return { revealed, text: revealed ? myCharacter.epilogueA : myCharacter.epilogueB }
    }
    if (!myCharacter?.epilogueCard || !myCharacter.secretRevealClueId) return null
    const publishedInGame = !!room?.clues?.[myCharacter.secretRevealClueId]?.publishedToRoom
    const choseToReveal = moralChoices[uid] === 'reveal_all'
    const revealed = publishedInGame || choseToReveal
    return { revealed, text: revealed ? myCharacter.epilogueCard.revealed : myCharacter.epilogueCard.hidden }
  }, [myCharacter, room, moralChoices, selfReports, uid])

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
    if (!studentIdentity) return setAiError('학교 인증 정보가 만료됐어요 — 새로고침 후 학교 코드를 다시 인증해주세요')
    setAiBusy(true)
    setAiError(null)
    try {
      const reflectionLogId = await saveReflectionLog({
        uid,
        studentName: studentIdentity.name,
        studentId: studentIdentity.studentId,
        scenarioId: scenario.scenarioId,
        roomCode,
        characterId: myCharacterId,
        reflectionPrompts: scenario.reflectionPrompts,
        answers,
        resultSummary: {
          endingId: ending.id,
          endingTitle: ending.title,
          accusedLabel: myAccusedLabel,
          moralChoiceLabel: myMoralChoiceLabel,
        },
      })
      const myNickname = room.players?.[uid]?.name ?? '학생'
      const { feedback } = await getAiFeedback({
        reflectionLogId,
        nickname: myNickname,
        scenarioTitle: scenario.meta.title,
        endingTitle: ending.title,
        endingMessage: ending.message,
        qaPairs: scenario.reflectionPrompts.map((q, i) => ({ question: q, answer: answers[i] ?? '' })),
      })
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
        {ending.imageDataUrl ? (
          <img
            src={ending.imageDataUrl}
            alt={ending.title}
            style={{ margin: '-26px -20px 16px', width: 'calc(100% + 40px)', height: 150, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div className="thumb" style={{ margin: '-26px -20px 16px', height: 150, borderRadius: 0 }}>{ending.title} 이미지</div>
        )}
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

      <h2 className="page-title" style={{ fontSize: 19 }}>사건의 진상</h2>
      <p className="dim" style={{ marginBottom: 16 }}>
        팀이 무엇을 밝혀냈든 상관없이, 실제로 있었던 일과 이 사건의 핵심 단서를 모두 공개합니다.
      </p>
      <div className="card col" style={{ marginBottom: 12 }}>
        <strong style={{ fontFamily: 'var(--font-head)' }}>{culprit?.name} — {culprit?.role}</strong>
        {culprit?.secretLayers?.map((layer, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{layer.content}</p>
        ))}
      </div>
      {criticalClues.length > 0 && (
        <div className="col" style={{ marginBottom: 18 }}>
          {criticalClues.map((clue) => (
            <div key={clue.id} className="card" style={{ marginBottom: 0, borderColor: 'var(--gold)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13 }}>{clue.title}</strong>
                <span className="pill pill-solid">핵심 단서</span>
              </div>
              <p className="dim" style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6 }}>{clue.content}</p>
            </div>
          ))}
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
          const pCharacter = getPlayableCharacters(scenario, room.meta?.playerCount).find((c) => c.id === p.characterId)
          const accusedId = accusations[pUid]
          const accusedLabel = accusedId ? accusationOptions.find((o) => o.id === accusedId)?.label ?? accusedId : '미응답'
          const effectiveCulpritId = getEffectiveCharacterId(scenario, culprit?.id, room.meta?.playerCount)
          const wasCorrect = accusedId && accusedId !== 'unknown' && accusedId === effectiveCulpritId
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
          const autoRevealed = isClueAutoRevealed(clue, scenario, room.meta?.playerCount)
          const statusLabel = finder ? `${finder} 발견` : autoRevealed ? '자동 공개' : '미발견'
          return (
            <div key={clue.id} className="card" style={{ marginBottom: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13 }}>{clue.title}</strong>
                <span className={`pill ${finder || autoRevealed ? 'pill-solid' : 'pill-muted'}`}>{statusLabel}</span>
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
            <p className="dim" style={{ fontSize: 12, margin: '0 0 8px' }}>AI 피드백</p>
            <AiFeedbackView feedback={aiFeedback} />
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
