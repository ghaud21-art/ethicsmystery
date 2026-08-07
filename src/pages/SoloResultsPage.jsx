import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import ResultExportButton from '../components/ResultExportButton.jsx'
import AiFeedbackView from '../components/AiFeedbackView.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { loadScenario } from '../engine/scenarioLoader.js'
import { getSoloRun, clearSoloRun } from '../utils/soloRun.js'
import { computeSoloMetrics, evaluateSoloEnding } from '../engine/soloEndingEvaluator.js'
import { saveReflectionLog } from '../firebase/reflectionApi.js'
import { getAiFeedback } from '../firebase/functionsApi.js'

export default function SoloResultsPage() {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const { uid, tier, studentIdentity } = useAuth()

  const [scenario, setScenario] = useState(null)
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)

  const exportRef = useRef(null)
  const [answers, setAnswers] = useState({})
  const [aiFeedback, setAiFeedback] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadScenario(scenarioId)
      .then((s) => {
        if (cancelled) return
        setScenario(s)
        const savedRun = getSoloRun(scenarioId)
        if (!savedRun || savedRun.step !== 'ended') {
          setError(new Error('완료된 플레이 기록을 찾을 수 없습니다'))
          return
        }
        setRun(savedRun)
      })
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [scenarioId])

  const ending = useMemo(() => {
    if (!scenario || !run) return null
    const metrics = computeSoloMetrics(scenario, run)
    const endingId = evaluateSoloEnding(scenario, metrics)
    return scenario.endings.find((e) => e.id === endingId)
  }, [scenario, run])

  if (error) return <div className="card">{error.message}</div>
  if (!scenario || !run || !ending) return <div className="dim">불러오는 중...</div>

  const accusationStep = scenario.resolutionPhase.steps.find((s) => s.id === 'accusation')
  const hasMoralStep = scenario.resolutionPhase.steps.some((s) => s.id === 'moral_choice')
  const accusedCharacter = scenario.characters.find((c) => c.id === run.accusation)
  const accusedLabel = accusedCharacter ? accusedCharacter.name : run.accusation === 'no_single_person' ? '특정 개인만의 문제는 아니다' : run.accusation
  const moralChoiceLabel = run.moralChoice === 'reveal_all' ? '모두 공개했다' : run.moralChoice === 'conceal_some' ? '일부는 덮었다' : '미응답'
  const culprit = scenario.characters.find((c) => c.isCulprit)

  // 공감 선택형 스텝(정답 없는 자유선택)의 응답과 scenario.epilogueCards[].empathyTarget이
  // 일치하는 카드를 찾는다 — 어떤 스텝이 "공감 선택"인지 이름으로 하드코딩하지 않고,
  // stepAnswers에 저장된 값들 중 실제로 매치되는 카드가 있는 것을 그대로 쓴다.
  const myEpilogue = scenario.epilogueCards?.find((card) =>
    Object.values(run.stepAnswers ?? {}).includes(card.empathyTarget),
  )

  const allClues = [...scenario.clues.phase1.items, ...scenario.clues.phase2.items]
  const criticalClues = allClues.filter((c) => c.isCriticalClue)

  const handleEndGame = () => {
    clearSoloRun(scenarioId)
    navigate('/')
  }

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
        roomCode: null,
        characterId: scenario.playerCharacter.id,
        reflectionPrompts: scenario.reflectionPrompts,
        answers,
        resultSummary: { endingId: ending.id, endingTitle: ending.title, accusedLabel, moralChoiceLabel },
      })
      const myNickname = run.playerName?.trim() || '학생'
      const { feedback } = await getAiFeedback({
        reflectionLogId,
        nickname: myNickname,
        scenarioTitle: `${scenario.meta.title} (1인용)`,
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
        <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>{ending.themeTag}</p>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="pill pill-outline">내 역할: {scenario.playerCharacter.name}</span>
          {culprit && <span className="pill pill-muted">실제 원인 제공자: {culprit.name}</span>}
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
        무엇을 밝혀냈든 상관없이, 실제로 있었던 일과 이 사건의 핵심 단서를 모두 공개합니다.
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
      <p className="dim" style={{ marginBottom: 16 }}>같은 사건도 조사 순서와 선택에 따라 다른 결말로 이어집니다.</p>
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

      <h2 className="page-title" style={{ fontSize: 19 }}>나의 결론</h2>
      <div className="card" style={{ marginBottom: 18 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13 }}>{accusationStep?.prompt}</p>
        <div className="row">
          <span className="pill pill-outline">지목: {accusedLabel}</span>
          {hasMoralStep && <span className="pill pill-outline">{moralChoiceLabel}</span>}
        </div>
      </div>

      <h2 className="page-title" style={{ fontSize: 19 }}>모든 단서</h2>
      <div className="col" style={{ marginBottom: 18 }}>
        {allClues.map((clue) => {
          const found = run.viewedClueIds.includes(clue.id)
          return (
            <div key={clue.id} className="card" style={{ marginBottom: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13 }}>{clue.title}</strong>
                <span className={`pill ${found ? 'pill-solid' : 'pill-muted'}`}>{found ? '확보함' : '미발견'}</span>
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

      <div ref={exportRef} className="card" style={{ padding: '22px 20px' }}>
        <div className="kicker" style={{ marginBottom: 4 }}>나의 플레이 기록</div>
        <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, margin: '0 0 4px' }}>{scenario.meta.title}</h2>
        <p className="dim" style={{ fontSize: 12, margin: '0 0 14px' }}>{ending.title} · {scenario.playerCharacter.name} ({scenario.playerCharacter.role})</p>

        <div className="row" style={{ marginBottom: 14 }}>
          <span className="pill pill-outline">나의 지목: {accusedLabel}</span>
          {hasMoralStep && <span className="pill pill-outline">나의 선택: {moralChoiceLabel}</span>}
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
