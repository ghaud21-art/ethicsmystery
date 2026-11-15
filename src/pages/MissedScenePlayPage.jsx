import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import ResultExportButton from '../components/ResultExportButton.jsx'
import AiFeedbackView from '../components/AiFeedbackView.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { loadScenario } from '../engine/scenarioLoader.js'
import { getAiFeedback } from '../firebase/functionsApi.js'
import { saveReflectionLog } from '../firebase/reflectionApi.js'
import { exportElementAsImage } from '../utils/html2canvasExport.js'
import {
  newMissedSceneRun, newSceneRecord, saveMissedSceneRun, getMissedSceneRun, clearMissedSceneRun,
  getInspectLimit, getReasonMaxLength, isChoiceUnlocked, findChoice, findVariableFact, buildInspectSpots, spotCenter,
} from '../utils/missedSceneRun.js'

const KAKAO_LINK = 'https://open.kakao.com/me/dalpjh'

// window.confirm()은 홈 화면에 설치한 PWA(standalone)에서 조용히 차단되는 경우가 있어
// 앱 자체 확인 모달을 쓴다 (탐문 수사와 동일한 이유).
function ConfirmModal({ request, onCancel }) {
  if (!request) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{request.message}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>취소</button>
          <button
            className="primary"
            onClick={() => {
              request.action()
              onCancel()
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

// 영상·음성·이미지가 아직 준비되지 않은 시나리오도 돌아가야 하므로(텍스트 모드),
// 파일을 불러오지 못하면 요소를 조용히 숨기고 아래의 text만 남긴다.
function Media({ kind, src, poster }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) return null
  const frame = { width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'block' }
  if (kind === 'video') {
    return <video controls playsInline preload="metadata" src={src} poster={poster ?? undefined} onError={() => setFailed(true)} style={{ ...frame, background: '#000' }} />
  }
  if (kind === 'audio') {
    return <audio controls preload="metadata" src={src} onError={() => setFailed(true)} style={{ width: '100%' }} />
  }
  return <img src={src} alt="" onError={() => setFailed(true)} style={frame} />
}

// 영상·이미지 위에 띄우는 돋보기 마커 — 편집 화면에서 좌표를 찍은 조사 지점만 이걸로 나온다.
function SpotMarker({ spot, inspected, isFact, disabled, onClick }) {
  const c = spotCenter(spot)
  if (!c) return null
  return (
    <button
      onClick={onClick}
      disabled={disabled && !inspected}
      title={inspected ? spot.label : '조사하기'}
      style={{
        position: 'absolute', left: `${c.cx * 100}%`, top: `${c.cy * 100}%`,
        transform: 'translate(-50%, -50%)', width: 34, height: 34, borderRadius: '50%', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: inspected ? (isFact ? 'rgba(201,162,39,.92)' : 'rgba(30,26,18,.88)') : 'rgba(20,16,8,.6)',
        border: `2px solid ${inspected ? (isFact ? 'var(--gold-light)' : 'var(--line)') : 'var(--gold)'}`,
        color: inspected ? (isFact ? '#1a1510' : 'var(--ink-dim)') : 'var(--gold-light)',
        fontSize: 16, lineHeight: 1, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.5)',
      }}
    >
      {inspected ? (isFact ? '✓' : '×') : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      )}
    </button>
  )
}

function FactCard({ fact, mediaUrl, compact }) {
  return (
    <div className="card col" style={{ marginBottom: 0, borderColor: 'var(--gold)', gap: 6 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>{fact.title}</strong>
        <span className="pill pill-solid">사실</span>
      </div>
      <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>{fact.text}</p>
      {!compact && fact.card?.src && (
        <Media kind={fact.card.type === 'audio' ? 'audio' : 'image'} src={mediaUrl(fact.card.src)} />
      )}
    </div>
  )
}

function MissedSceneInner({ scenario }) {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const { uid, tier, studentIdentity } = useAuth()

  const scenes = useMemo(() => [...(scenario.scenes ?? [])].sort((a, b) => a.order - b.order), [scenario])
  const ui = scenario.ui ?? {}
  const inspectLimit = getInspectLimit(scenario)
  const reasonMax = getReasonMaxLength(scenario)
  const mediaBase = (scenario.settings?.mediaBasePath ?? '').replace(/^\//, '')
  // 관리자가 편집 화면에서 올린 파일(mediaUrls)이 우선, 없으면 public 폴더의 정적 경로.
  const mediaUrl = (file) => (file ? scenario.mediaUrls?.[file] ?? `${import.meta.env.BASE_URL}${mediaBase}${file}` : null)

  const [run, setRunState] = useState(() => getMissedSceneRun(scenarioId))
  const [nickname, setNickname] = useState('')
  const [confirmRequest, setConfirmRequest] = useState(null)

  // 단계별 입력의 임시 상태 — 확정 시 run.records에 저장된다
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [reason, setReason] = useState('')
  const [guess, setGuess] = useState({ A: null, B: null })
  const [revealSubmitted, setRevealSubmitted] = useState(false)

  // 결과 화면(성찰/AI 피드백/이미지 저장)
  const exportRef = useRef(null)
  const [answers, setAnswers] = useState({})
  const [aiFeedback, setAiFeedback] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [autoExportPending, setAutoExportPending] = useState(false)

  const setRun = (updater) => {
    setRunState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next) saveMissedSceneRun(scenarioId, next)
      return next
    })
  }

  const scene = run && run.step === 'play' ? scenes[run.sceneIndex] : null
  const rec = scene ? (run.records[scene.id] ?? newSceneRecord()) : null

  const patchRecord = (sceneId, patch) =>
    setRun((prev) => ({
      ...prev,
      records: { ...prev.records, [sceneId]: { ...(prev.records[sceneId] ?? newSceneRecord()), ...patch } },
    }))

  const gotoPhase = (phase) => setRun((prev) => ({ ...prev, phase }))

  // 장면/단계가 바뀌면 임시 입력을 기록에서 복원한다 — 변수 단계에서 결정으로
  // 돌아왔을 때 이전 선택과 이유가 그대로 남아 있어야 한다.
  useEffect(() => {
    if (!run || run.step !== 'play') return
    const currentScene = scenes[run.sceneIndex]
    const r = run.records[currentScene?.id] ?? newSceneRecord()
    setSelectedChoice(r.finalChoice ?? r.initialChoice ?? null)
    setReason(r.reason ?? '')
    setGuess(r.revealGuess ?? { A: null, B: null })
    setRevealSubmitted(!!r.revealGuess)
    window.scrollTo({ top: 0 })
  }, [run?.sceneIndex, run?.phase, run?.step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoExportPending && exportRef.current) {
      exportElementAsImage(exportRef.current, `${scenario.scenarioId}-record.jpg`)
      setAutoExportPending(false)
    }
  }, [autoExportPending, scenario.scenarioId])

  const handleRestart = () => {
    setConfirmRequest({
      message: '처음부터 다시 시작할까요? 다섯 장면의 기록이 모두 사라집니다.',
      action: () => {
        clearMissedSceneRun(scenarioId)
        setRunState(null)
        setAnswers({})
        setAiFeedback(null)
      },
    })
  }

  const handleEndGame = () => {
    clearMissedSceneRun(scenarioId)
    navigate('/')
  }

  // ---------- 인트로 (게임 시작 전) ----------
  if (!run) {
    return (
      <div className="page">
        <Masthead showBack />
        <div className="kicker">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M10 9l5 3-5 3z" />
          </svg>
          {scenario.series?.title ?? '놓친 장면'}
        </div>
        <h1 className="page-title">{scenario.meta.title}</h1>
        <p className="dim" style={{ marginBottom: 14 }}>{scenario.series?.tagline ?? scenario.meta.subtitle}</p>
        <div className="page-title-rule" />

        <div className="card col" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kicker" style={{ marginBottom: 2 }}>어떤 게임인가요</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85 }}>{scenario.description}</p>
          {scenario.fictionNotice && <p className="dim" style={{ margin: 0, fontSize: 11 }}>{scenario.fictionNotice}</p>}
        </div>

        <div className="card col">
          <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>진행 방법</strong>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
            <li>다섯 직업인의 하루를 차례로 살아봅니다. 장면마다 <strong>숨은 사실이 {scenario.settings?.factsPerScene ?? 3}개</strong> 있습니다.</li>
            <li>수상한 곳을 지목해 조사하세요 — 지목은 장면당 <strong>{inspectLimit}번</strong>까지. 헛짚으면 기회만 사라집니다.</li>
            <li>두 동료의 설득을 듣고 결정합니다. <strong>찾은 사실만 가지고</strong> 판단해야 합니다.</li>
            <li>사실 셋을 모두 찾으면 <strong>세 번째 선택지</strong>가 열립니다. 하지만 어느 선택에도 잃는 것이 있습니다.</li>
            <li>결정한 이유를 한 문장으로 적습니다. 결과와 <strong>1년 뒤</strong>는 선택에 따라 달라집니다.</li>
            <li>마지막에 두 동료가 각각 <strong>어떤 도덕 원리</strong>로 말했는지 맞혀 봅니다.</li>
          </ul>
        </div>

        <div className="card col">
          <label className="dim" style={{ fontSize: 12 }}>닉네임 (선택)</label>
          <input placeholder="결과 기록에 표시할 이름" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <button
            className="primary"
            onClick={() => setRun(newMissedSceneRun(scenarioId, nickname.trim()))}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            첫 번째 장면 시작하기 →
          </button>
        </div>

        <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
          게임 사용 문의:{' '}
          <a href={KAKAO_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-light)' }}>
            카카오톡 오픈채팅 →
          </a>
        </p>
      </div>
    )
  }

  // ---------- 1년 뒤 (에필로그) ----------
  if (run.step === 'epilogue') {
    return (
      <div className="page">
        <Masthead />
        <div className="kicker">{ui.epilogueTitle ?? '1년 뒤'}</div>
        <h1 className="page-title">{scenario.ending?.epilogueIntroText ?? '당신의 선택은 1년 뒤 어떤 모습이 되었을까요?'}</h1>
        <div className="page-title-rule" />
        <div className="col" style={{ marginBottom: 18 }}>
          {scenes.map((sc) => {
            const r = run.records[sc.id] ?? newSceneRecord()
            const choice = findChoice(sc, r.finalChoice)
            if (!choice) return null
            return (
              <div key={sc.id} className="card col" style={{ marginBottom: 0 }}>
                <div className="kicker" style={{ marginBottom: 0 }}>장면 {sc.order} · {sc.job} — {sc.title}</div>
                <p className="dim" style={{ margin: 0, fontSize: 12 }}>나의 선택: {choice.label}</p>
                <Media kind="video" src={mediaUrl(choice.epilogue?.video)} />
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85 }}>{choice.epilogue?.text}</p>
              </div>
            )
          })}
        </div>
        <button className="primary" onClick={() => setRun((prev) => ({ ...prev, step: 'ended' }))} style={{ width: '100%', textAlign: 'left' }}>
          나의 다섯 번의 결정 돌아보기 →
        </button>
      </div>
    )
  }

  // ---------- 결과 화면 ----------
  if (run.step === 'ended') {
    const resultScreen = scenario.ending?.resultScreen ?? {}
    const choiceSummary = scenes.map((sc) => run.records[sc.id]?.finalChoice ?? '-').join(' · ')

    const sceneRows = scenes.map((sc) => {
      const r = run.records[sc.id] ?? newSceneRecord()
      const choice = findChoice(sc, r.finalChoice)
      const variableFact = findVariableFact(sc)
      const variableFound = variableFact && r.foundFactIds.includes(variableFact.id)
      const variableLabel = !variableFound ? '변수를 찾지 못함' : r.changedAfterVariable ? '변수를 알고 결정을 바꿈' : '변수를 알고도 결정 유지'
      const correctA = r.revealGuess?.A === sc.reveal.answer.A
      const correctB = r.revealGuess?.B === sc.reveal.answer.B
      return { sc, r, choice, variableLabel, revealScore: (correctA ? 1 : 0) + (correctB ? 1 : 0) }
    })

    const handleReflectionSubmit = async () => {
      if (tier !== 'homeSchoolStudent') return
      if (!studentIdentity) return setAiError('학교 인증 정보가 만료됐어요 — 새로고침 후 학교 코드를 다시 인증해주세요')
      setAiBusy(true)
      setAiError(null)
      const endingTitle = `다섯 번의 결정 (${choiceSummary})`
      let reflectionLogId
      try {
        reflectionLogId = await saveReflectionLog({
          uid,
          studentName: studentIdentity.name,
          studentId: studentIdentity.studentId,
          scenarioId: scenario.scenarioId,
          roomCode: null,
          characterId: 'missed_scene_player',
          reflectionPrompts: scenario.reflectionPrompts,
          answers,
          resultSummary: {
            endingId: 'completed',
            endingTitle,
            accusedLabel: null,
            moralChoiceLabel: choiceSummary,
          },
        })
      } catch (e) {
        setAiError(e.message)
        setAiBusy(false)
        return
      }
      try {
        const decisionLines = sceneRows
          .map(({ sc, r, choice }) => `${sc.job} 장면에서 "${choice?.label ?? '-'}"를 골랐고, 이유로 "${r.reason || '(무응답)'}"라고 적었다.`)
          .join(' ')
        const { feedback } = await getAiFeedback({
          reflectionLogId,
          nickname: run.playerName?.trim() || studentIdentity.name,
          scenarioTitle: `${scenario.meta.title} (놓친 장면)`,
          endingTitle,
          endingMessage: `학생이 다섯 직업 장면에서 도덕 원리가 대립하는 결정을 내렸다. ${decisionLines}`,
          qaPairs: scenario.reflectionPrompts.map((q, i) => ({ question: q, answer: answers[i] ?? '' })),
        })
        setAiFeedback(feedback)
      } catch (e) {
        setAiError(e.message)
      } finally {
        setAiBusy(false)
        setAutoExportPending(true)
      }
    }

    return (
      <div className="page">
        <Masthead />
        <div className="card" style={{ borderTop: '2px solid var(--gold)', position: 'relative', padding: '26px 20px' }}>
          <span className="stamp" style={{ position: 'absolute', top: 20, right: 20 }}>5 / 5</span>
          <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-light)', marginBottom: 10 }}>
            {scenario.meta.title}
            {run.playerName?.trim() && ` · ${run.playerName.trim()}`}
          </div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 26, margin: '0 0 10px' }}>
            {resultScreen.title ?? '나의 다섯 번의 결정'}
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ink-dim)', margin: 0 }}>{resultScreen.notice}</p>
        </div>

        <div className="col" style={{ marginBottom: 18 }}>
          {sceneRows.map(({ sc, r, choice, variableLabel, revealScore }) => (
            <div key={sc.id} className="card col" style={{ marginBottom: 0, gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>장면 {sc.order} · {sc.job} — {sc.title}</strong>
                <span className="pill pill-solid">선택 {r.finalChoice ?? '-'}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{choice?.label}</p>
              {r.reason && <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>이유: {r.reason}</p>}
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="stat-chip">사실 {r.foundFactIds.length}/{sc.facts.length}</span>
                <span className="stat-chip">{variableLabel}</span>
                <span className="stat-chip">원리 맞히기 {revealScore}/2</span>
                {sc.toneTrap?.enabled && r.toneTrapAnswer && <span className="stat-chip">{r.toneTrapAnswer}</span>}
              </div>
            </div>
          ))}
        </div>

        <hr className="divider" />

        <h2 className="page-title" style={{ fontSize: 19 }}>성찰 기록</h2>
        <p className="dim" style={{ marginBottom: 16 }}>다섯 번의 결정을 돌아보며 답해보세요. 작성한 내용은 아래 "나의 결정 기록"에 자동으로 반영됩니다.</p>
        <div className="col" style={{ marginBottom: 18 }}>
          {(scenario.reflectionPrompts ?? []).map((q, i) => (
            <div key={i} className="col" style={{ gap: 5 }}>
              <label className="dim" style={{ fontSize: 12 }}>{q}</label>
              <textarea rows={2} value={answers[i] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
            </div>
          ))}
        </div>

        {tier === 'homeSchoolStudent' ? (
          <button className="primary" onClick={handleReflectionSubmit} disabled={aiBusy} style={{ width: '100%', textAlign: 'left', marginBottom: 18 }}>
            {aiBusy ? 'AI 피드백 생성 중...' : '성찰 기록 제출하기 (결과 이미지도 자동 저장돼요)'}
          </button>
        ) : (
          <p className="dim" style={{ fontSize: 12, marginBottom: 18 }}>
            게스트 모드에서는 성찰 기록 제출과 AI 피드백이 제공되지 않아요. 결과는 아래 버튼으로 이미지로 저장할 수 있습니다.
          </p>
        )}
        {aiError && <p style={{ color: 'var(--blood-light)' }}>{aiError}</p>}

        <div className="divider-orn"><span className="divider-orn-diamond" /></div>

        <div ref={exportRef} className="card" style={{ padding: '22px 20px' }}>
          <div className="kicker" style={{ marginBottom: 4 }}>나의 결정 기록</div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, margin: '0 0 4px' }}>{scenario.meta.title}</h2>
          <p className="dim" style={{ fontSize: 12, margin: '0 0 14px' }}>
            {run.playerName?.trim() ? `${run.playerName.trim()} · ` : ''}
            다섯 번의 결정: {choiceSummary}
          </p>
          <div className="col">
            {sceneRows.map(({ sc, r, choice, revealScore }) => (
              <div key={sc.id}>
                <p className="dim" style={{ fontSize: 12, margin: '0 0 3px' }}>
                  장면 {sc.order} {sc.job} — 선택 {r.finalChoice ?? '-'} · 사실 {r.foundFactIds.length}/{sc.facts.length} · 원리 {revealScore}/2
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {choice?.label} {r.reason ? `— "${r.reason}"` : ''}
                </p>
              </div>
            ))}
            <hr className="divider" style={{ margin: '10px 0' }} />
            {(scenario.reflectionPrompts ?? []).map((q, i) => (
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
          <ResultExportButton
            targetRef={exportRef}
            filename={`${scenario.scenarioId}-record.jpg`}
            label={tier === 'homeSchoolStudent' ? '이미지 다시 저장하기' : '결과 이미지로 저장'}
          />
        </div>

        <hr className="divider" />
        <div className="row">
          <button onClick={handleRestart}>다시 플레이하기</button>
          <button onClick={handleEndGame}>게임 종료 (메인 화면으로)</button>
        </div>

        <ConfirmModal request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
      </div>
    )
  }

  // ---------- 플레이 (장면 진행) ----------
  const spots = buildInspectSpots(scene)
  const variableFact = findVariableFact(scene)
  const variableFound = variableFact && rec.foundFactIds.includes(variableFact.id)
  const foundFacts = scene.facts.filter((f) => rec.foundFactIds.includes(f.id))
  const missedFacts = scene.facts.filter((f) => !rec.foundFactIds.includes(f.id))
  const allFound = foundFacts.length >= scene.facts.length
  const isLastScene = run.sceneIndex >= scenes.length - 1

  const goNextScene = () => {
    if (isLastScene) setRun((prev) => ({ ...prev, step: 'epilogue' }))
    else setRun((prev) => ({ ...prev, sceneIndex: prev.sceneIndex + 1, phase: 'intro' }))
  }

  const handleInspect = (spot) => {
    if (rec.inspectedSpotIds.includes(spot.id)) return
    if (rec.inspectUsed >= inspectLimit) return
    patchRecord(scene.id, {
      inspectUsed: rec.inspectUsed + 1,
      inspectedSpotIds: [...rec.inspectedSpotIds, spot.id],
      foundFactIds: spot.kind === 'fact' ? [...rec.foundFactIds, spot.id] : rec.foundFactIds,
    })
  }

  // 결정 확정 — 변수 사실을 찾았다면 결정 직후 변수 내레이션을 한 번 들려주고
  // 유지/변경을 다시 묻는다 (못 찾았다면 '놓친 장면 공개'에서 재생).
  const handleDecide = () => {
    if (!selectedChoice) return
    const trimmedReason = reason.trim()
    if (scenario.settings?.requireReasonOnChoice !== false && !trimmedReason) return
    if (variableFound && !rec.variableSeen) {
      patchRecord(scene.id, { initialChoice: selectedChoice, reason: trimmedReason, variableSeen: true })
      gotoPhase('variable')
    } else {
      patchRecord(scene.id, {
        initialChoice: rec.initialChoice ?? selectedChoice,
        finalChoice: selectedChoice,
        reason: trimmedReason,
        changedAfterVariable: rec.variableSeen && rec.initialChoice != null && selectedChoice !== rec.initialChoice,
      })
      gotoPhase('result')
    }
  }

  const handleRevealSubmit = () => {
    if (!guess.A || !guess.B) return
    patchRecord(scene.id, { revealGuess: { ...guess } })
    setRevealSubmitted(true)
  }

  const finalChoiceDef = findChoice(scene, rec.finalChoice)
  const canLeaveReveal = revealSubmitted && (!scene.toneTrap?.enabled || rec.toneTrapAnswer)

  return (
    <div className="page">
      <Masthead />

      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13 }}>
          <span className="dim">{scenario.series?.title ?? '놓친 장면'}</span> · <strong>{scenario.meta.title}</strong>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="ap-badge">장면 {run.sceneIndex + 1}/{scenes.length}</span>
          {run.phase === 'inspect' && <span className="ap-badge">지목 {rec.inspectUsed}/{inspectLimit}</span>}
          <button onClick={handleRestart} style={{ fontSize: 11, padding: '3px 8px' }}>처음부터</button>
        </div>
      </div>

      <div className="kicker" style={{ marginBottom: 2 }}>장면 {scene.order} · {scene.job}</div>
      <h1 className="page-title" style={{ fontSize: 22 }}>{scene.title}</h1>
      <div className="page-title-rule" />

      {/* ---- 도입 ---- */}
      {run.phase === 'intro' && (
        <>
          <div className="card col">
            <Media kind="video" src={mediaUrl(scene.intro.video)} poster={mediaUrl(scene.intro.poster)} />
            <Media kind="audio" src={mediaUrl(scene.intro.narrationAudio)} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9 }}>{scene.intro.text}</p>
          </div>
          <button className="primary" onClick={() => gotoPhase('inspect')} style={{ width: '100%', textAlign: 'left' }}>
            영상을 조사한다 →
          </button>
        </>
      )}

      {/* ---- 영상 조사 ---- */}
      {run.phase === 'inspect' && (
        <>
          {(() => {
            // 편집 화면에서 좌표를 찍은 지점은 영상/이미지 위의 돋보기로, 나머지는 글 버튼으로.
            // 돋보기 모드는 실제로 업로드된 영상·포스터가 있을 때만 켠다.
            const visualFile = [scene.intro?.video, scene.intro?.poster].find((f) => f && scenario.mediaUrls?.[f])
            const markerSpots = visualFile ? spots.filter((s) => spotCenter(s)) : []
            const markerIds = new Set(markerSpots.map((s) => s.id))
            const buttonSpots = spots.filter((s) => !markerIds.has(s.id))
            return (
              <>
                <div className="card col">
                  {markerSpots.length > 0 ? (
                    <div style={{ position: 'relative' }}>
                      <Media
                        kind={visualFile === scene.intro?.video ? 'video' : 'image'}
                        src={mediaUrl(visualFile)}
                        poster={mediaUrl(scene.intro?.poster)}
                      />
                      {markerSpots.map((spot) => (
                        <SpotMarker
                          key={spot.id}
                          spot={spot}
                          inspected={rec.inspectedSpotIds.includes(spot.id)}
                          isFact={spot.kind === 'fact'}
                          disabled={rec.inspectUsed >= inspectLimit}
                          onClick={() => handleInspect(spot)}
                        />
                      ))}
                    </div>
                  ) : (
                    <Media kind="video" src={mediaUrl(scene.intro.video)} poster={mediaUrl(scene.intro.poster)} />
                  )}
                  <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>
                    {ui.inspectGuide}
                    {markerSpots.length > 0 && ' 화면 위의 돋보기를 눌러 조사하세요.'}
                  </p>
                </div>

                {buttonSpots.length > 0 && (
                  <div className="card col">
                    <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>수상한 곳 지목하기</strong>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      {buttonSpots.map((spot) => {
                        const inspected = rec.inspectedSpotIds.includes(spot.id)
                        const isFact = spot.kind === 'fact'
                        return (
                          <button
                            key={spot.id}
                            onClick={() => handleInspect(spot)}
                            disabled={!inspected && rec.inspectUsed >= inspectLimit}
                            style={{
                              fontSize: 12,
                              borderColor: inspected ? (isFact ? 'var(--gold)' : 'var(--line)') : undefined,
                              color: inspected && !isFact ? 'var(--ink-dim)' : undefined,
                            }}
                          >
                            {inspected ? (isFact ? '✓ ' : '× ') : ''}{spot.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {rec.inspectUsed >= inspectLimit && !allFound && (
                  <p style={{ color: 'var(--blood-light)', fontSize: 12, margin: '0 0 10px' }}>지목 기회를 모두 썼습니다. 지금 아는 것만으로 판단해야 합니다.</p>
                )}
              </>
            )
          })()}

          {rec.inspectedSpotIds.length > 0 && (
            <div className="col" style={{ marginBottom: 12 }}>
              {rec.inspectedSpotIds.map((id) => {
                const spot = spots.find((s) => s.id === id)
                if (!spot) return null
                if (spot.kind === 'fact') {
                  const fact = scene.facts.find((f) => f.id === id)
                  return <FactCard key={id} fact={fact} mediaUrl={mediaUrl} />
                }
                return (
                  <div key={id} className="card" style={{ marginBottom: 0 }}>
                    <p className="dim" style={{ margin: 0, fontSize: 12 }}>
                      <strong>{spot.label}</strong> — {spot.text}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="dim" style={{ fontSize: 12 }}>
              {ui.knownFactsTitle ?? '내가 아는 사실'}: {foundFacts.length}/{scene.facts.length}
              {allFound && ' — 전부 찾았습니다!'}
            </span>
          </div>
          <button className="primary" onClick={() => gotoPhase('voices')} style={{ width: '100%', textAlign: 'left' }}>
            조사를 마치고 동료들의 이야기를 듣는다 →
          </button>
        </>
      )}

      {/* ---- 두 목소리 ---- */}
      {run.phase === 'voices' && (
        <>
          {scene.voices.map((voice) => (
            <div key={voice.id} className="card col" style={{ borderLeft: '2px solid var(--gold)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>
                  {voice.speaker} <span className="dim" style={{ fontWeight: 400 }}>· {voice.role}</span>
                </strong>
                <span className="pill pill-muted">{voice.tone}</span>
              </div>
              <Media kind="audio" src={mediaUrl(voice.audio)} />
              <Media kind="video" src={mediaUrl(voice.video)} />
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9 }}>"{voice.text}"</p>
            </div>
          ))}
          <button className="primary" onClick={() => gotoPhase('decide')} style={{ width: '100%', textAlign: 'left' }}>
            이제 결정한다 →
          </button>
        </>
      )}

      {/* ---- 결정 ---- */}
      {run.phase === 'decide' && (
        <>
          <div className="card col">
            <div className="kicker" style={{ marginBottom: 2 }}>{ui.knownFactsTitle ?? '내가 아는 사실'}</div>
            {foundFacts.length === 0 ? (
              <p className="dim" style={{ margin: 0, fontSize: 13 }}>{ui.noFactsFound}</p>
            ) : (
              foundFacts.map((f) => <FactCard key={f.id} fact={f} mediaUrl={mediaUrl} compact />)
            )}
          </div>

          {allFound && (
            <div className="card" style={{ borderColor: 'var(--gold)' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--gold-light)' }}>{ui.thirdChoiceUnlocked}</p>
            </div>
          )}

          <div className="card col">
            <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>어떻게 하시겠습니까?</strong>
            {scene.choices.map((choice) => {
              const unlocked = isChoiceUnlocked(scenario, scene, rec, choice)
              if (!unlocked) return null
              const selected = selectedChoice === choice.id
              return (
                <button
                  key={choice.id}
                  onClick={() => setSelectedChoice(choice.id)}
                  style={{
                    textAlign: 'left',
                    borderColor: selected ? 'var(--gold)' : undefined,
                    background: selected ? 'rgba(201,166,70,.08)' : undefined,
                  }}
                >
                  <strong>{choice.id}.</strong> {choice.label}
                  {choice.requires === 'allFactsFound' && <span className="pill pill-solid" style={{ marginLeft: 8 }}>해금</span>}
                </button>
              )
            })}
          </div>

          <div className="card col">
            <label className="dim" style={{ fontSize: 12 }}>{ui.reasonPrompt ?? '이렇게 결정한 이유를 한 문장으로 적어 주세요.'}</label>
            <textarea
              rows={2}
              maxLength={reasonMax}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`${reasonMax}자 이내`}
            />
            <span className="dim" style={{ fontSize: 11, alignSelf: 'flex-end' }}>{reason.length}/{reasonMax}</span>
          </div>

          <button
            className="primary"
            onClick={handleDecide}
            disabled={!selectedChoice || (scenario.settings?.requireReasonOnChoice !== false && !reason.trim())}
            style={{ width: '100%', textAlign: 'left' }}
          >
            이렇게 결정한다 →
          </button>
        </>
      )}

      {/* ---- 변수 (변수 사실을 찾은 경우에만) ---- */}
      {run.phase === 'variable' && variableFact && (
        <>
          <div className="card col" style={{ borderColor: 'var(--blood-light)' }}>
            <div className="kicker" style={{ marginBottom: 2 }}>잠깐 —</div>
            <Media kind="audio" src={mediaUrl(variableFact.variableNarration?.audio)} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9 }}>{variableFact.variableNarration?.text}</p>
          </div>
          <div className="row">
            <button
              className="primary"
              style={{ flex: 1, textAlign: 'left' }}
              onClick={() => {
                patchRecord(scene.id, { finalChoice: rec.initialChoice, changedAfterVariable: false })
                gotoPhase('result')
              }}
            >
              결정을 유지한다 ({rec.initialChoice})
            </button>
            <button style={{ flex: 1, textAlign: 'left' }} onClick={() => gotoPhase('decide')}>
              다시 생각한다
            </button>
          </div>
        </>
      )}

      {/* ---- 결과 ---- */}
      {run.phase === 'result' && finalChoiceDef && (
        <>
          <div className="card col">
            <div className="kicker" style={{ marginBottom: 2 }}>나의 선택 — {finalChoiceDef.label}</div>
            <Media kind="video" src={mediaUrl(finalChoiceDef.result?.video)} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9 }}>{finalChoiceDef.result?.text}</p>
          </div>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="card" style={{ flex: 1, marginBottom: 0, borderColor: '#4caf7d' }}>
              <p className="dim" style={{ margin: '0 0 4px', fontSize: 11 }}>얻은 것</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{finalChoiceDef.result?.gained}</p>
            </div>
            <div className="card" style={{ flex: 1, marginBottom: 0, borderColor: 'var(--blood-light)' }}>
              <p className="dim" style={{ margin: '0 0 4px', fontSize: 11 }}>잃은 것</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{finalChoiceDef.result?.lost}</p>
            </div>
          </div>
          <button
            className="primary"
            onClick={() => gotoPhase(missedFacts.length > 0 ? 'missed' : 'reveal')}
            style={{ width: '100%', textAlign: 'left', marginTop: 12 }}
          >
            {missedFacts.length > 0 ? `${ui.missedTitle ?? '놓친 장면'} 확인하기 →` : '원리 맞히기 →'}
          </button>
        </>
      )}

      {/* ---- 놓친 장면 공개 ---- */}
      {run.phase === 'missed' && (
        <>
          <div className="card col" style={{ borderTop: '2px solid var(--blood-light)' }}>
            <div className="kicker" style={{ marginBottom: 2 }}>{ui.missedTitle ?? '놓친 장면'} — 당신이 찾지 못한 사실</div>
            {missedFacts.map((f) => (
              <div key={f.id} className="col" style={{ gap: 6 }}>
                <FactCard fact={f} mediaUrl={mediaUrl} />
                {f.isVariable && f.variableNarration?.text && (
                  <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7, fontStyle: 'italic' }}>{f.variableNarration.text}</p>
                )}
              </div>
            ))}
          </div>
          <div className="card col">
            <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>{ui.missedPrompt ?? '이 사실을 알았다면 판단이 달라졌을까요?'}</strong>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {(ui.missedOptions ?? ['달라졌을 것이다', '그래도 같았을 것이다', '잘 모르겠다']).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    patchRecord(scene.id, { missedAnswer: opt })
                    gotoPhase('reveal')
                  }}
                  style={{ fontSize: 13 }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ---- 원리 맞히기와 공개 ---- */}
      {run.phase === 'reveal' && (
        <>
          <div className="card col">
            <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>{ui.revealPrompt ?? '방금 두 사람은 각각 어떤 원리로 말했을까요?'}</strong>
            {scene.voices.map((voice) => (
              <div key={voice.id} className="col" style={{ gap: 6 }}>
                <span className="dim" style={{ fontSize: 12 }}>{voice.speaker}({voice.role})의 원리는?</span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {scene.reveal.options.map((key) => {
                    const picked = guess[voice.id] === key
                    const isAnswer = scene.reveal.answer[voice.id] === key
                    return (
                      <button
                        key={key}
                        disabled={revealSubmitted}
                        onClick={() => setGuess((g) => ({ ...g, [voice.id]: key }))}
                        style={{
                          fontSize: 12,
                          borderColor: revealSubmitted ? (isAnswer ? 'var(--gold)' : picked ? 'var(--blood-light)' : undefined) : picked ? 'var(--gold)' : undefined,
                          background: picked && !revealSubmitted ? 'rgba(201,166,70,.08)' : undefined,
                        }}
                      >
                        {scenario.principles?.[key]?.name ?? key}
                        {revealSubmitted && isAnswer && ' ✓'}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {!revealSubmitted && (
              <button className="primary" onClick={handleRevealSubmit} disabled={!guess.A || !guess.B} style={{ alignSelf: 'flex-start' }}>
                제출하기
              </button>
            )}
          </div>

          {revealSubmitted && (
            <>
              <div className="card col" style={{ borderLeft: '2px solid var(--gold)' }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8 }}>{scene.reveal.explanation}</p>
              </div>
              {['A', 'B'].map((side) => {
                const key = scene.reveal.answer[side]
                const p = scenario.principles?.[key]
                if (!p) return null
                const correct = rec.revealGuess?.[side] === key
                return (
                  <div key={side} className="card col" style={{ gap: 4 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>
                        {scene.voices.find((v) => v.id === side)?.speaker} → {p.name} ({p.thinker})
                      </strong>
                      <span className="pill pill-solid" style={correct ? undefined : { borderColor: 'var(--blood-light)', color: 'var(--blood-light)' }}>
                        {correct ? '정답' : '오답'}
                      </span>
                    </div>
                    <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>{p.summary}</p>
                    {p.quote && <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>"{p.quote}"</p>}
                    <span className="dim" style={{ fontSize: 11 }}>교과서 {p.textbookPage}쪽</span>
                  </div>
                )
              })}

              {scene.toneTrap?.enabled && (
                <div className="card col">
                  <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>{scene.toneTrap.question}</strong>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {scene.toneTrap.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => patchRecord(scene.id, { toneTrapAnswer: opt })}
                        style={{ fontSize: 13, borderColor: rec.toneTrapAnswer === opt ? 'var(--gold)' : undefined }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button className="primary" onClick={goNextScene} disabled={!canLeaveReveal} style={{ width: '100%', textAlign: 'left' }}>
                {isLastScene ? '1년 뒤를 본다 →' : '다음 장면으로 →'}
              </button>
            </>
          )}
        </>
      )}

      <ConfirmModal request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
    </div>
  )
}

export default function MissedScenePlayPage() {
  const { scenarioId } = useParams()
  const [scenario, setScenario] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadScenario(scenarioId)
      .then((s) => !cancelled && setScenario(s))
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [scenarioId])

  if (error) return <div className="page"><Masthead showBack /><div className="card">시나리오를 불러오지 못했습니다: {error.message}</div></div>
  if (!scenario) return <div className="page dim">불러오는 중...</div>
  if (!scenario.published) {
    return (
      <div className="page">
        <Masthead showBack />
        <div className="card"><p style={{ margin: 0 }}>아직 준비 중인 시나리오입니다. 곧 플레이할 수 있어요.</p></div>
      </div>
    )
  }
  return <MissedSceneInner scenario={scenario} />
}
