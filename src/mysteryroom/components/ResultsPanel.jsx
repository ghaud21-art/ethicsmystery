import { useRef, useState } from 'react'
import { Icon, useMr } from './common'
import { roleById } from '../roles'
import { isLocalMode } from '../store'
import { submitMysteryResult } from '../resultsApi'
import { useAuth } from '../../context/AuthContext'
import { getAiFeedback } from '../../firebase/functionsApi'
import { exportElementAsImage } from '../../utils/html2canvasExport'
import AiFeedbackView from '../../components/AiFeedbackView.jsx'

const len = (s) => String(s ?? '').trim().length

function useLocal(key, initial) {
  const [v, setV] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initial
    } catch {
      return initial
    }
  })
  const set = (next) => {
    setV(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* 저장 공간이 막혀 있어도 화면은 계속 동작한다 */
    }
  }
  return [v, set]
}

export default function ResultsPanel({ scene, grade }) {
  const { room, mr } = useMr()
  const { tier, studentIdentity, verifySchoolCode } = useAuth()
  const cardRef = useRef(null)
  const base = `ethicsmystery.mysteryroom.${mr.code}.${mr.uid}`
  const [answers, setAnswers] = useLocal(`${base}.reflection`, ['', '', '', ''])
  const [submitted, setSubmitted] = useLocal(`${base}.submitted`, false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [school, setSchool] = useState({ code: '', name: studentIdentity?.name ?? '', id: studentIdentity?.studentId ?? '' })
  const [feedback, setFeedback] = useState(null)

  const local = isLocalMode()
  const verified = tier === 'homeSchoolStudent' && !!studentIdentity
  const d = mr.data?.debate ?? {}
  const stance = (id) => room.debate?.stances?.find((s) => s.id === id)?.label ?? '-'
  const myRoles = (mr.roleInfo.includes[mr.me?.role] ?? []).map((rid) => roleById(room, rid)?.name).join(', ')
  const dr = mr.state.debateResult
  const concepts = room.concepts.filter((c) => mr.state.concepts?.[c.k])
  const visitedBad = (mr.state.history ?? []).filter((s) => room.scenes[s]?.end?.kind === 'bad').map((s) => room.scenes[s].end.name)
  const answeredCount = answers.filter((a) => len(a) > 0).length

  const result = () => ({
    uid: mr.uid,
    nickname: mr.me?.name ?? '',
    ...(verified ? { studentName: studentIdentity.name, studentId: studentIdentity.studentId } : {}),
    scenarioId: room.scenarioId,
    roomTitle: room.meta.title,
    roomCode: mr.code,
    playerCount: mr.playerUids.length,
    roles: myRoles,
    grade,
    endingKind: scene.end.kind,
    endingName: scene.end.name,
    failedTotal: mr.state.failedTotal ?? 0,
    hintsUsed: Object.keys(mr.state.hintsUsed ?? {}).length,
    badEndings: visitedBad,
    elapsedSec: mr.elapsed,
    stanceBefore: d.before?.[mr.uid] ?? null,
    stanceAfter: d.after?.[mr.uid] ?? null,
    swapped: d.swaps?.[mr.uid]?.to ?? null,
    debate: dr ?? null,
    concepts: concepts.map((c) => c.name),
    reflection: room.reflection.map((q, i) => ({ question: q.text, link: q.link, answer: answers[i] ?? '' })),
  })

  const handleSubmit = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (local) {
        console.log('[로컬 모드] 제출 내용', result())
        setMsg('로컬 테스트 모드라 실제로 저장하지 않았습니다. (브라우저 콘솔에서 내용 확인)')
      } else {
        await submitMysteryResult(result())
        setMsg('선생님께 제출했습니다.')
      }
      setSubmitted(true)
    } catch (e) {
      setMsg(`제출하지 못했습니다: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    if (!school.name.trim() || !school.id.trim() || !school.code.trim()) return setMsg('학교 코드, 이름, 학번을 모두 입력해 주세요')
    setBusy(true)
    setMsg(null)
    try {
      await verifySchoolCode(school.code.trim(), school.name.trim(), school.id.trim())
      setAuthOpen(false)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleFeedback = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await getAiFeedback({
        nickname: mr.me?.name ?? '학생',
        scenarioTitle: room.meta.title,
        endingTitle: scene.end.name,
        endingMessage: scene.end.line,
        qaPairs: room.reflection.map((q, i) => ({ question: q.text, answer: answers[i] ?? '' })),
      })
      setFeedback(res.feedback)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col" style={{ gap: 14, width: '100%', marginTop: 8 }}>
      <div className="divider" style={{ margin: '4px 0' }} />
      <strong style={{ fontSize: 15 }}>성찰 질문</strong>
      {room.reflection.map((q, i) => (
        <div key={i} className="col" style={{ gap: 4 }}>
          <label style={{ fontSize: 13, lineHeight: 1.6 }}>
            <span className="mr-tag" style={{ marginRight: 6 }}>{q.link}</span>{q.text}
          </label>
          <textarea rows={3} value={answers[i] ?? ''} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
        </div>
      ))}
      <p className="dim" style={{ margin: 0, fontSize: 11 }}>이름·학번·학교명은 쓰지 마세요. 쓴 답은 이 기기에 저장되어, 수업 후에 이어 쓸 수 있어요.</p>

      {/* 이미지로 저장되는 결과 카드 */}
      <div ref={cardRef} className="mr-result-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="kicker" style={{ margin: 0 }}>미스터리 룸 · {room.meta.title}</span>
          <span className="dim" style={{ fontSize: 12 }}>{new Date().toLocaleDateString('ko-KR')}</span>
        </div>
        <div className="row" style={{ gap: 16, alignItems: 'center', margin: '10px 0' }}>
          <div className="mr-ending-grade" style={{ fontSize: 44 }}>{grade}</div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 17 }}>{scene.end.name}</div>
            <div className="dim" style={{ fontSize: 12 }}>{mr.me?.name} · {myRoles}</div>
          </div>
        </div>
        <table className="mr-table" style={{ marginBottom: 10 }}>
          <tbody>
            <tr><th>방 진행</th><td>{room.rooms.map((r) => `${r.name} ${mr.state.clues?.[r.clue] ? '○' : '×'}`).join(' · ')}</td></tr>
            <tr><th>실패·힌트</th><td>실패 {mr.state.failedTotal ?? 0}회 · 힌트 {Object.keys(mr.state.hintsUsed ?? {}).length}회{visitedBad.length ? ` · 거친 BAD 엔딩: ${visitedBad.join(', ')}` : ''}</td></tr>
            <tr><th>내 생각</th><td>토론 전 {stance(d.before?.[mr.uid])} → 토론 후 {stance(d.after?.[mr.uid])}</td></tr>
            {dr && <tr><th>모둠 결론</th><td>{stance(dr.conclusion)}{dr.conditions?.filter(Boolean).length ? ` (조건: ${dr.conditions.filter(Boolean).join(' / ')})` : ''}</td></tr>}
            {dr?.acknowledge && <tr><th>인정한 근거</th><td>{dr.acknowledge}</td></tr>}
            {dr?.concession && <tr><th>조건부 양보</th><td>{dr.concession}</td></tr>}
            <tr><th>모은 개념</th><td>{concepts.map((c) => c.name).join(', ') || '-'}</td></tr>
          </tbody>
        </table>
        {answeredCount > 0 && (
          <div className="col" style={{ gap: 6 }}>
            {room.reflection.map((q, i) => len(answers[i]) > 0 && (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>
                <strong>{q.link}</strong> {answers[i]}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row">
        <button onClick={() => exportElementAsImage(cardRef.current, `미스터리룸-${room.meta.title}-${mr.me?.name ?? ''}.jpg`)}>
          <span className="row" style={{ gap: 6 }}><Icon name="note" />이미지로 저장</span>
        </button>
        <button className="primary" disabled={busy} onClick={handleSubmit}>
          {submitted ? '고친 내용으로 다시 제출' : '선생님께 제출'}
        </button>
      </div>
      {answeredCount < 4 && !submitted && <span className="dim" style={{ fontSize: 11 }}>성찰 질문에 답하지 않아도 제출할 수 있지만, 수업 후 다시 들어와 이어 쓰고 제출하면 더 좋아요.</span>}

      {!local && (
        verified ? (
          <div className="col" style={{ gap: 8 }}>
            <span className="dim" style={{ fontSize: 12 }}>학교 인증됨: {studentIdentity.name} ({studentIdentity.studentId}) · 제출 결과에 이름과 학번이 함께 기록됩니다.</span>
            {room.aiEnabled !== false && (
              <button style={{ alignSelf: 'flex-start' }} disabled={busy || answeredCount === 0} onClick={handleFeedback}>
                <span className="row" style={{ gap: 6 }}><Icon name="bulb" />성찰 답에 AI 피드백 받기</span>
              </button>
            )}
          </div>
        ) : authOpen ? (
          <div className="mr-mat col" style={{ gap: 6 }}>
            <strong style={{ fontSize: 13 }}>학교 인증 (선택)</strong>
            <span className="dim" style={{ fontSize: 11 }}>인증하면 결과가 이름·학번과 함께 제출되고, AI 피드백을 받을 수 있어요.</span>
            <input placeholder="학교 코드" value={school.code} onChange={(e) => setSchool({ ...school, code: e.target.value })} />
            <input placeholder="이름" value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} />
            <input placeholder="학번" value={school.id} onChange={(e) => setSchool({ ...school, id: e.target.value })} />
            <button style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={handleVerify}>인증하기</button>
          </div>
        ) : (
          <button className="mr-ghost mr-small" style={{ alignSelf: 'flex-start' }} onClick={() => setAuthOpen(true)}>학교 인증하고 이름으로 제출하기 (선택)</button>
        )
      )}

      {feedback && (
        <div className="mr-mat">
          <div className="mr-mat-title"><span>AI 피드백</span></div>
          <AiFeedbackView feedback={feedback} />
        </div>
      )}
      {msg && <p style={{ margin: 0, fontSize: 12, color: msg.includes('못') ? 'var(--blood-light)' : 'var(--gold-light)' }}>{msg}</p>}
    </div>
  )
}
