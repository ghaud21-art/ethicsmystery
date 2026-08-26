import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import ResultExportButton from '../components/ResultExportButton.jsx'
import AiFeedbackView from '../components/AiFeedbackView.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { loadScenario } from '../engine/scenarioLoader.js'
import { judgeTanmunQuestion, gradeTanmunDeduction, getAiFeedback } from '../firebase/functionsApi.js'
import { saveReflectionLog } from '../firebase/reflectionApi.js'
import { exportElementAsImage } from '../utils/html2canvasExport.js'
import {
  newTanmunRun, saveTanmunRun, getTanmunRun, clearTanmunRun,
  CLUE_INTERVAL, EMERGENCY_CLUE_COST, WRONG_ATTEMPT_PENALTY,
  getQuestionCap, unresolvedPenalty, gradeForScore, gradeLineText, VERDICT_STYLES,
} from '../utils/tanmunRun.js'

const KAKAO_LINK = 'https://open.kakao.com/me/dalpjh'

// 학교 인증 게이트 — 탐문 수사는 AI 기록관이 필수라 게스트로는 플레이할 수 없다.
function SchoolAuthGate() {
  const { verifySchoolCode } = useAuth()
  const [schoolCode, setSchoolCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleVerify = async () => {
    if (!studentName.trim() || !studentId.trim()) return setError('이름과 학번을 입력해주세요')
    setBusy(true)
    setError(null)
    try {
      await verifySchoolCode(schoolCode, studentName, studentId)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card col" style={{ borderColor: 'var(--gold)' }}>
      <strong style={{ fontFamily: 'var(--font-head)' }}>학교 인증이 필요합니다</strong>
      <p className="dim" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>
        탐문 수사는 AI 기록관이 모든 질문을 실시간으로 판정하는 콘텐츠라, 학교 인증을 마친 학생만 플레이할 수 있어요.
      </p>
      <label className="dim" style={{ fontSize: 12 }}>이름</label>
      <input placeholder="예: 홍길동" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
      <label className="dim" style={{ fontSize: 12 }}>학번</label>
      <input placeholder="예: 30215" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
      <label className="dim" style={{ fontSize: 12 }}>학교 코드</label>
      <div className="row">
        <input placeholder="학교에서 안내받은 코드" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} style={{ flex: 1 }} />
        <button className="primary" onClick={handleVerify} disabled={busy || !schoolCode}>
          {busy ? '인증 중...' : '인증하기'}
        </button>
      </div>
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12, margin: 0 }}>{error}</p>}
      <p className="dim" style={{ fontSize: 11, margin: 0 }}>
        학교 코드가 없거나 게임 사용 문의가 필요하신가요?{' '}
        <a href={KAKAO_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-light)' }}>
          카카오톡 오픈채팅으로 문의하기 →
        </a>
      </p>
    </div>
  )
}

function VerdictPill({ verdict }) {
  const style = VERDICT_STYLES[verdict] ?? VERDICT_STYLES['그럴수도']
  return (
    <span
      style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 12, fontWeight: 800,
        color: style.color, background: style.background, border: `1px solid ${style.color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {verdict}
    </span>
  )
}

function TanmunInner({ scenario }) {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const { uid, tier, isAdmin, studentIdentity } = useAuth()

  const [run, setRunState] = useState(() => getTanmunRun(scenarioId))
  const [question, setQuestion] = useState('')
  const [deduction, setDeduction] = useState('')
  const [deductionOpen, setDeductionOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const logEndRef = useRef(null)

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
      if (next) saveTanmunRun(scenarioId, next)
      return next
    })
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [run?.log?.length])

  useEffect(() => {
    if (autoExportPending && exportRef.current) {
      exportElementAsImage(exportRef.current, `${scenario.scenarioId}-tanmun-record.png`)
      setAutoExportPending(false)
    }
  }, [autoExportPending, scenario.scenarioId])

  const authorized = tier === 'homeSchoolStudent' || isAdmin

  const clues = scenario.clues ?? []
  const nextClueAt = run ? (run.cluesRevealed < clues.length ? (run.cluesRevealed + 1) * CLUE_INTERVAL : null) : null

  // 문 수가 단서 공개 기준을 넘었으면 자동 공개 — 페널티로 한 번에 여러 기준을
  // 넘을 수도 있으므로 while로 따라잡는다.
  const syncClues = (next) => {
    while (next.cluesRevealed < clues.length && next.questionCount >= (next.cluesRevealed + 1) * CLUE_INTERVAL) {
      next.cluesRevealed += 1
      next.log = [...next.log, { type: 'clue', index: next.cluesRevealed - 1 }]
    }
    return next
  }

  const questionCap = getQuestionCap(scenario)
  const questionsLocked = run && run.questionCount >= questionCap

  const handleAsk = async () => {
    const q = question.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    try {
      const { verdict } = await judgeTanmunQuestion(scenarioId, q)
      setQuestion('')
      setRun((prev) => {
        const counted = verdict !== '반려'
        const next = {
          ...prev,
          questionCount: prev.questionCount + (counted ? 1 : 0),
          log: [...prev.log, { type: 'question', text: q, verdict }],
        }
        return syncClues(next)
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleEmergencyClue = () => {
    if (!run || run.cluesRevealed >= clues.length) return
    if (!confirm(`+${EMERGENCY_CLUE_COST}문을 쓰고 다음 단서를 미리 열람할까요?`)) return
    setRun((prev) => {
      const next = {
        ...prev,
        questionCount: prev.questionCount + EMERGENCY_CLUE_COST,
        cluesRevealed: prev.cluesRevealed + 1,
        log: [...prev.log, { type: 'clue', index: prev.cluesRevealed }],
      }
      return syncClues(next)
    })
  }

  const finishRun = (prev, { solved, slotHits, bonusHit }) => {
    const hitCount = slotHits.filter(Boolean).length
    const bestSlotHits = Math.max(prev.bestSlotHits, hitCount)
    let finalScore
    if (solved) {
      finalScore = prev.questionCount - (bonusHit ? 1 : 0)
    } else {
      finalScore = prev.questionCount + unresolvedPenalty(bestSlotHits)
    }
    return {
      ...prev,
      step: 'ended',
      solved,
      bonusHit: solved ? bonusHit : false,
      bestSlotHits,
      finalScore: Math.max(0, finalScore),
    }
  }

  const handleSubmitDeduction = async () => {
    const text = deduction.trim()
    if (!text) return
    setBusy(true)
    setError(null)
    try {
      const { slotHits, bonusHit } = await gradeTanmunDeduction(scenarioId, text)
      const hitCount = slotHits.filter(Boolean).length
      const allHit = hitCount === (scenario.slots?.length ?? 4)
      if (allHit) {
        setRun((prev) => finishRun(prev, { solved: true, slotHits, bonusHit }))
      } else if (questionsLocked) {
        // 질문 마감 후에는 최종 답안 1회만 — 실패하면 미해결 종료
        setRun((prev) =>
          finishRun(
            { ...prev, log: [...prev.log, { type: 'attempt', text, slotHits, bonusHit }] },
            { solved: false, slotHits, bonusHit },
          ),
        )
      } else {
        setDeduction('')
        setDeductionOpen(false)
        setRun((prev) => {
          const next = {
            ...prev,
            questionCount: prev.questionCount + WRONG_ATTEMPT_PENALTY,
            bestSlotHits: Math.max(prev.bestSlotHits, hitCount),
            log: [...prev.log, { type: 'attempt', text, slotHits, bonusHit }],
          }
          return syncClues(next)
        })
        setError(`아직 진상에 도달하지 못했습니다 (${hitCount}/${scenario.slots?.length ?? 4}개 요소 적중, +${WRONG_ATTEMPT_PENALTY}문)`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleGiveUp = () => {
    if (!confirm('수사를 포기할까요? 미해결 종료로 처리되고 진상이 공개됩니다.')) return
    setRun((prev) => finishRun(prev, { solved: false, slotHits: [], bonusHit: false }))
  }

  const handleRestart = () => {
    if (!confirm('처음부터 다시 시작할까요? 지금까지의 문답 기록이 사라집니다.')) return
    clearTanmunRun(scenarioId)
    setRunState(null)
    setAnswers({})
    setAiFeedback(null)
  }

  const handleEndGame = () => {
    clearTanmunRun(scenarioId)
    navigate('/')
  }

  const gradeInfo = run?.finalScore != null ? gradeForScore(run.finalScore, scenario) : null

  const handleReflectionSubmit = async () => {
    if (tier !== 'homeSchoolStudent') return
    if (!studentIdentity) return setAiError('학교 인증 정보가 만료됐어요 — 새로고침 후 학교 코드를 다시 인증해주세요')
    setAiBusy(true)
    setAiError(null)
    let reflectionLogId
    const endingTitle = `${gradeInfo.grade}등급 · ${gradeInfo.title} (${run.finalScore}문)`
    try {
      reflectionLogId = await saveReflectionLog({
        uid,
        studentName: studentIdentity.name,
        studentId: studentIdentity.studentId,
        scenarioId: scenario.scenarioId,
        roomCode: null,
        characterId: 'tanmun_detective',
        reflectionPrompts: scenario.reflectionPrompts,
        answers,
        resultSummary: {
          endingId: gradeInfo.grade,
          endingTitle,
          accusedLabel: null,
          moralChoiceLabel: run.solved ? '사건 해결' : '미해결 종료',
        },
      })
    } catch (e) {
      setAiError(e.message)
      setAiBusy(false)
      return
    }
    try {
      const { feedback } = await getAiFeedback({
        reflectionLogId,
        nickname: studentIdentity.name,
        scenarioTitle: `${scenario.meta.title} (탐문 수사)`,
        endingTitle,
        endingMessage: run.solved ? '플레이어가 진상에 도달해 사건을 해결했다.' : '플레이어가 진상에 도달하지 못한 채 수사를 종료했다.',
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

  // ---------- 인트로 (게임 시작 전) ----------
  if (!run) {
    return (
      <div className="page">
        <Masthead showBack />
        <div className="kicker">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          탐문 수사
        </div>
        <h1 className="page-title">{scenario.meta.title}</h1>
        <p className="dim" style={{ marginBottom: 14 }}>{scenario.meta.subtitle}</p>
        <div className="page-title-rule" />

        <div className="card col" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kicker" style={{ marginBottom: 2 }}>사건 개요 — 공개 정보</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85 }}>{scenario.publicInfo}</p>
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>
            공개 키워드: <strong style={{ color: 'var(--gold-light)' }}>{scenario.publicKeywordCount ?? scenario.slots?.length ?? 4}개</strong>
            {' '}(내용은 진상 공개 화면에서 확인됩니다)
          </p>
        </div>

        <div className="card col">
          <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>수사 규칙</strong>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
            <li>AI 기록관에게 <strong>예/아니오로 답할 수 있는 질문</strong>을 던져 진상을 추리하세요.</li>
            <li>판정은 5가지 — <strong style={{ color: '#4caf7d' }}>네</strong> · <strong style={{ color: '#e05d5d' }}>아니오</strong> · <strong style={{ color: '#d9b23d' }}>그럴수도</strong> · <strong style={{ color: '#9a9a9a' }}>중요하지않음</strong> · 반려(개방형 질문, 문 수 미포함)</li>
            <li>질문 1개 = <strong>+1문</strong>. 문 수가 낮을수록 좋은 등급을 받습니다.</li>
            <li>{CLUE_INTERVAL}문마다 단서가 1장씩 공개됩니다 (총 {clues.length}장). 급하면 +{EMERGENCY_CLUE_COST}문으로 미리 열람할 수 있어요.</li>
            <li>확신이 서면 <strong>최종 추리</strong>를 서술로 제출하세요. 오답이면 +{WRONG_ATTEMPT_PENALTY}문 후 수사를 계속합니다.</li>
            <li>{questionCap}문에 도달하면 질문이 마감되고 최종 답안 1회만 남습니다.</li>
          </ul>
          <p className="dim" style={{ fontSize: 12, margin: 0 }}>
            등급: {gradeLineText(scenario)}
          </p>
        </div>

        {authorized ? (
          <button
            className="primary"
            onClick={() => setRun(newTanmunRun(scenarioId))}
            style={{ width: '100%', textAlign: 'left' }}
          >
            수사 시작하기 →
          </button>
        ) : (
          <SchoolAuthGate />
        )}

        <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
          게임 사용 문의:{' '}
          <a href={KAKAO_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-light)' }}>
            카카오톡 오픈채팅 →
          </a>
        </p>
      </div>
    )
  }

  // ---------- 결과 (수사 종료) ----------
  if (run.step === 'ended') {
    return (
      <div className="page">
        <Masthead />
        <div className="card" style={{ borderTop: '2px solid var(--gold)', position: 'relative', padding: '26px 20px' }}>
          <span className="stamp" style={{ position: 'absolute', top: 20, right: 20 }}>CASE CLOSED</span>
          <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-light)', marginBottom: 10 }}>
            수사 종결 · {scenario.meta.title}
          </div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 40, margin: '0 0 4px', color: 'var(--gold-light)' }}>
            {gradeInfo.grade}
          </h1>
          <p style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18, margin: '0 0 10px' }}>「{gradeInfo.title}」</p>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-dim)', margin: 0 }}>
            총 <strong style={{ color: 'var(--ink)' }}>{run.finalScore}문</strong>
            {run.solved ? ' — 진상에 도달했습니다.' : ' — 진상에 도달하지 못한 채 수사가 종료됐습니다.'}
            {run.solved && run.bonusHit && ' (결정적 근거 보너스 -1문 적용)'}
          </p>
        </div>

        <div className="divider-orn"><span className="divider-orn-diamond" /></div>

        <h2 className="page-title" style={{ fontSize: 19 }}>사건의 진상</h2>
        <div className="card col">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{scenario.truth}</p>
        </div>

        <h2 className="page-title" style={{ fontSize: 19 }}>진상의 열쇠 — 핵심 요소 {scenario.slots?.length ?? 4}가지</h2>
        <div className="col" style={{ marginBottom: 18 }}>
          {(scenario.slots ?? []).map((slot, i) => (
            <div key={i} className="card" style={{ marginBottom: 0, borderColor: 'var(--gold)' }}>
              <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>{slot.name}</strong>
              <p className="dim" style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6 }}>{slot.criteria}</p>
            </div>
          ))}
        </div>

        <h2 className="page-title" style={{ fontSize: 19 }}>나의 심문 기록 ({run.log.filter((l) => l.type === 'question').length}개 질문)</h2>
        <div className="col" style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 18, paddingRight: 4 }}>
          {run.log.map((entry, i) =>
            entry.type === 'question' ? (
              <div key={i} className="card row" style={{ marginBottom: 0, justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{entry.text}</p>
                <VerdictPill verdict={entry.verdict} />
              </div>
            ) : entry.type === 'clue' ? (
              <div key={i} className="card" style={{ marginBottom: 0, borderLeft: '2px solid var(--gold)' }}>
                <span className="pill pill-solid">단서 공개</span>
                <strong style={{ fontSize: 13, marginLeft: 8 }}>{clues[entry.index]?.title}</strong>
              </div>
            ) : (
              <div key={i} className="card" style={{ marginBottom: 0, borderColor: 'var(--blood-light)' }}>
                <span className="pill pill-muted">최종 추리 시도 ({entry.slotHits.filter(Boolean).length}/{scenario.slots?.length ?? 4} 적중)</span>
                <p className="dim" style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6 }}>{entry.text}</p>
              </div>
            ),
          )}
        </div>

        <hr className="divider" />

        <h2 className="page-title" style={{ fontSize: 19 }}>성찰 기록</h2>
        <p className="dim" style={{ marginBottom: 16 }}>오늘의 사건을 돌아보며 답해보세요. 작성한 내용은 아래 "나의 수사 기록"에 자동으로 반영됩니다.</p>
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
          <p className="dim" style={{ fontSize: 12, marginBottom: 18 }}>관리자 미리보기 모드 — 성찰 기록 제출은 학교 인증 학생만 가능합니다.</p>
        )}
        {aiError && <p style={{ color: 'var(--blood-light)' }}>{aiError}</p>}

        <div className="divider-orn"><span className="divider-orn-diamond" /></div>

        <div ref={exportRef} className="card" style={{ padding: '22px 20px' }}>
          <div className="kicker" style={{ marginBottom: 4 }}>나의 수사 기록</div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, margin: '0 0 4px' }}>{scenario.meta.title}</h2>
          <p className="dim" style={{ fontSize: 12, margin: '0 0 14px' }}>
            {gradeInfo.grade}등급 「{gradeInfo.title}」 · 총 {run.finalScore}문 · {run.solved ? '사건 해결' : '미해결 종료'}
          </p>
          <div className="col">
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
            filename={`${scenario.scenarioId}-tanmun-record.png`}
            label={tier === 'homeSchoolStudent' ? '이미지 다시 저장하기' : '결과 이미지로 저장'}
          />
        </div>

        <hr className="divider" />
        <div className="row">
          <button onClick={handleRestart}>다시 도전하기</button>
          <button onClick={handleEndGame}>게임 종료 (메인 화면으로)</button>
        </div>
      </div>
    )
  }

  // ---------- 플레이 (문답 진행) ----------
  return (
    <div className="page">
      <Masthead />

      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13 }}>
          <span className="dim">탐문 수사</span> · <strong>{scenario.meta.title}</strong>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="ap-badge">
            {run.questionCount}문{questionsLocked ? ' · 질문 마감' : ''}
          </span>
          <button onClick={() => setRulesOpen(true)} style={{ fontSize: 11, padding: '3px 8px' }}>규칙</button>
        </div>
      </div>

      <div className="card col" style={{ borderLeft: '2px solid var(--gold)' }}>
        <div className="kicker" style={{ marginBottom: 2 }}>사건 개요</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{scenario.publicInfo}</p>
      </div>

      {run.cluesRevealed > 0 && (
        <div className="col" style={{ marginBottom: 12 }}>
          {clues.slice(0, run.cluesRevealed).map((clue, i) => (
            <div key={i} className="card" style={{ marginBottom: 0, borderColor: 'var(--gold)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>{clue.title}</strong>
                <span className="pill pill-solid">단서 {i + 1}</span>
              </div>
              <p className="dim" style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.7 }}>{clue.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="dim" style={{ fontSize: 12 }}>
          {nextClueAt != null
            ? `다음 단서 공개까지 ${Math.max(0, nextClueAt - run.questionCount)}문 (${run.cluesRevealed}/${clues.length}장 공개됨)`
            : `단서 ${clues.length}장 모두 공개됨`}
        </span>
        {nextClueAt != null && (
          <button onClick={handleEmergencyClue} disabled={busy} style={{ fontSize: 11, padding: '3px 8px' }}>
            긴급 열람 (+{EMERGENCY_CLUE_COST}문)
          </button>
        )}
      </div>

      <div className="col" style={{ maxHeight: 380, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
        {run.log.length === 0 && (
          <p className="dim" style={{ fontSize: 13 }}>
            아직 질문이 없습니다. 기록관에게 예/아니오로 답할 수 있는 질문을 던져보세요 — 예: "강태오는 병에 걸렸습니까?"
          </p>
        )}
        {run.log.map((entry, i) =>
          entry.type === 'question' ? (
            <div key={i} className="card row" style={{ marginBottom: 0, justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{entry.text}</p>
              <VerdictPill verdict={entry.verdict} />
            </div>
          ) : entry.type === 'clue' ? (
            <div key={i} className="card" style={{ marginBottom: 0, borderLeft: '2px solid var(--gold)' }}>
              <span className="pill pill-solid">단서 공개</span>
              <strong style={{ fontSize: 13, marginLeft: 8 }}>{clues[entry.index]?.title}</strong>
            </div>
          ) : (
            <div key={i} className="card" style={{ marginBottom: 0, borderColor: 'var(--blood-light)' }}>
              <span className="pill pill-muted">최종 추리 오답 (+{WRONG_ATTEMPT_PENALTY}문, {entry.slotHits.filter(Boolean).length}/{scenario.slots?.length ?? 4} 적중)</span>
            </div>
          ),
        )}
        <div ref={logEndRef} />
      </div>

      {!questionsLocked ? (
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="예/아니오로 답할 수 있는 질문을 입력하세요"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleAsk() }}
            disabled={busy}
            style={{ flex: 1 }}
          />
          <button className="primary" onClick={handleAsk} disabled={busy || !question.trim()}>
            {busy ? '판정 중...' : '질문하기'}
          </button>
        </div>
      ) : (
        <p style={{ color: 'var(--blood-light)', fontSize: 13, marginBottom: 12 }}>
          {questionCap}문에 도달해 질문이 마감됐습니다 — 최종 추리 1회만 제출할 수 있습니다.
        </p>
      )}

      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}

      {deductionOpen || questionsLocked ? (
        <div className="card col" style={{ borderColor: 'var(--gold)' }}>
          <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>최종 추리 제출</strong>
          <p className="dim" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            무슨 일이 있었나 · 왜 그랬나 · 왜 실제와 다르게 보였나 · 결말의 이유 — 네 가지가 모두 담기게 서술하세요.
            {questionsLocked ? ' (마지막 1회입니다!)' : ` 오답이면 +${WRONG_ATTEMPT_PENALTY}문 후 수사를 계속합니다.`}
          </p>
          <textarea
            rows={5}
            value={deduction}
            onChange={(e) => setDeduction(e.target.value)}
            placeholder="사건의 전말을 자신의 말로 서술해보세요"
            disabled={busy}
          />
          <div className="row">
            <button className="primary" onClick={handleSubmitDeduction} disabled={busy || !deduction.trim()}>
              {busy ? '채점 중...' : '최종 추리 제출하기'}
            </button>
            {!questionsLocked && <button onClick={() => setDeductionOpen(false)} disabled={busy}>접기</button>}
          </div>
        </div>
      ) : (
        <div className="row">
          <button onClick={() => setDeductionOpen(true)} style={{ flex: 1, textAlign: 'left' }}>
            확신이 선다 — 최종 추리 제출하기 →
          </button>
          <button onClick={handleGiveUp} style={{ fontSize: 12 }}>포기</button>
        </div>
      )}

      {rulesOpen && (
        <div className="modal-overlay" onClick={() => setRulesOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">수사 규칙</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
              <li>질문 1개 = +1문 (반려된 개방형 질문은 문 수에 안 들어감)</li>
              <li>오답 제출 = +{WRONG_ATTEMPT_PENALTY}문 · 긴급 단서 열람 = +{EMERGENCY_CLUE_COST}문</li>
              <li>{CLUE_INTERVAL}문마다 단서 1장 자동 공개 (총 {clues.length}장)</li>
              <li>{questionCap}문 도달 시 질문 마감, 최종 답안 1회만</li>
              <li>미해결 종료 시 +25문 (핵심 요소 1개 적중당 -4문 감면, 최소 +10문)</li>
              <li>등급: {gradeLineText(scenario)}</li>
            </ul>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setRulesOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TanmunPlayPage() {
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
  if (scenario.aiEnabled === false) {
    return (
      <div className="page">
        <Masthead showBack />
        <div className="card col">
          <p style={{ margin: 0 }}>이 시나리오는 지금 AI 기록관이 꺼져 있어 플레이할 수 없습니다.</p>
          <p className="dim" style={{ fontSize: 12, margin: 0 }}>
            궁금한 점은{' '}
            <a href={KAKAO_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-light)' }}>
              카카오톡 오픈채팅
            </a>
            으로 문의해주세요.
          </p>
        </div>
      </div>
    )
  }
  return <TanmunInner scenario={scenario} />
}
