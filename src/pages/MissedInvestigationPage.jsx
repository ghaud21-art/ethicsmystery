// 놓친 장면 조사 모드 — 장소를 골라 조사하고, 진술을 뒤집고, 단서를 이어 보고서를 쓴다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import ResultExportButton from '../components/ResultExportButton.jsx'
import AiFeedbackView from '../components/AiFeedbackView.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getAiFeedback } from '../firebase/functionsApi.js'
import { saveReflectionLog } from '../firebase/reflectionApi.js'
import {
  newInvestigationRun, saveRun, loadRun, clearRun, levelOf, cluesOf, allClues, clueText, locationOpen,
  inspectLimitOf, inspectModeOf, spotsOf, hitSpot, isTimed, isPlaced, activeRects, presentWorks, statementLocked, findLink, linkLimitOf,
  layersReached, decisionAvailable, wrongLimitOf, timelineCardTime, timelineScore, decideEnding,
} from '../utils/missedInvestigation.js'

const box = { width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'block' }

function Media({ kind, src, poster }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) return null
  if (kind === 'video') return <video controls playsInline preload="metadata" src={src} poster={poster ?? undefined} onError={() => setFailed(true)} style={{ ...box, background: '#000' }} />
  if (kind === 'audio') return <audio controls preload="metadata" src={src} onError={() => setFailed(true)} style={{ width: '100%' }} />
  return <img src={src} alt="" onError={() => setFailed(true)} style={box} />
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: wide ? 'min(820px, 100%)' : undefined, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="modal-title">{title}</span>
          <button onClick={onClose} style={{ fontSize: 12, padding: '4px 10px' }}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ClueCardView({ scenario, run, clue, mediaUrl, compact, selected, onClick }) {
  const text = clueText(scenario, run, clue)
  return (
    <div
      className="card"
      onClick={onClick}
      style={{ margin: 0, padding: 12, cursor: onClick ? 'pointer' : undefined, borderColor: selected ? 'var(--gold)' : undefined, background: selected ? 'rgba(201,162,39,.1)' : undefined }}
    >
      <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
        <strong style={{ fontSize: 13 }}>{clue.title}</strong>
        {clue.start ? <span className="pill pill-muted">시작 자료</span> : clue.locationName && <span className="pill pill-muted">{clue.locationName}</span>}
      </div>
      {!compact && clue.kind === 'image' && <div style={{ marginTop: 6 }}><Media kind="image" src={mediaUrl(clue.image)} /></div>}
      {text && (
        <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.65, whiteSpace: 'pre-line', fontFamily: clue.kind === 'card' ? 'var(--font-mono, monospace)' : undefined }}>
          {clue.kind === 'card' ? text.split(' / ').join('\n') : text}
        </p>
      )}
    </div>
  )
}

export default function MissedInvestigationPage({ scenario }) {
  const navigate = useNavigate()
  const { uid, tier, studentIdentity } = useAuth()
  const id = scenario.scenarioId
  const mediaUrl = (file) => (file ? scenario.mediaUrls?.[file] ?? null : null)
  const [run, setRunState] = useState(() => loadRun(id))
  const setRun = (fn) =>
    setRunState((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      if (next) saveRun(id, next)
      return next
    })
  const clueMap = useMemo(() => {
    const m = allClues(scenario)
    for (const l of scenario.locations ?? []) for (const c of l.clues ?? []) m[c.id].locationName = l.name
    return m
  }, [scenario])
  const locOf = (lid) => scenario.locations.find((l) => l.id === lid)
  const charOf = (cid) => scenario.characters.find((c) => c.id === cid)
  const [notebook, setNotebook] = useState(null) // 'clues' | 'people' | 'links' | 'videos'

  // ---------- 시작 ----------
  if (!run) return <StartScreen scenario={scenario} onStart={(level, name) => setRun({ ...newInvestigationRun(scenario, level, name), found: (scenario.startClues ?? []).map((c) => c.id) })} />

  const days = scenario.settings?.days ?? [2, 2, 1]
  const visitsLeftToday = (days[run.day - 1] ?? 0) - run.visitsToday
  const restart = () => {
    clearRun(id)
    setRunState(null)
  }
  const header = (
    <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
      <div style={{ fontSize: 13 }}>
        <strong>{scenario.meta.title}</strong>
        {['map', 'location', 'decision'].includes(run.step) && <span className="dim"> · {run.day}일 차 · 오늘 남은 방문 {Math.max(0, visitsLeftToday)}곳 · 전체 {run.visited.length}/{scenario.settings?.visitLimit ?? 5}곳</span>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setNotebook('clues')}>수첩 · 단서 {run.found.length}</button>
        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setNotebook('people')}>인물</button>
        <button style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setNotebook('links')}>단서 잇기 {run.links.length}</button>
      </div>
    </div>
  )
  const notebookModal = notebook && (
    <Notebook
      scenario={scenario} run={run} setRun={setRun} tab={notebook} setTab={setNotebook} onClose={() => setNotebook(null)}
      clueMap={clueMap} mediaUrl={mediaUrl} charOf={charOf} locOf={locOf}
    />
  )

  // ---------- 브리핑 ----------
  if (run.step === 'brief') {
    const b = scenario.briefing ?? {}
    return (
      <div className="page">
        <Masthead />
        <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kicker">{b.kicker ?? '사건 브리핑'}</div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 24, margin: '4px 0 10px' }}>{b.title ?? scenario.meta.title}</h1>
          {b.video && <Media kind="video" src={mediaUrl(b.video)} />}
          {(b.lines ?? []).map((l, i) => <p key={i} style={{ fontSize: 14, lineHeight: 1.8, margin: '8px 0 0' }}>{l}</p>)}
        </div>
        <div className="card col">
          <strong style={{ fontSize: 13 }}>처음 받은 자료</strong>
          {(scenario.startClues ?? []).map((c) => <ClueCardView key={c.id} scenario={scenario} run={run} clue={clueMap[c.id]} mediaUrl={mediaUrl} />)}
          <div className="card" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7 }}>
            <strong>조사 규칙</strong>
            {(scenario.rules ?? []).map((r, i) => <div key={i}>· {r}</div>)}
          </div>
          <button className="primary" onClick={() => setRun((r) => ({ ...r, step: 'map' }))}>1일 차 조사를 시작한다 →</button>
        </div>
      </div>
    )
  }

  // ---------- 지도 ----------
  if (run.step === 'map') {
    const dayDone = visitsLeftToday <= 0
    return (
      <div className="page">
        <Masthead />
        {header}
        <div className="card">
          <div className="kicker">{run.day}일 차</div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.7 }}>
            {dayDone ? '오늘 조사할 수 있는 곳은 다 다녀왔다.' : `오늘은 ${visitsLeftToday}곳을 더 조사할 수 있다. 어디로 갈까?`}
            {' '}이미 다녀온 곳은 방문 횟수를 쓰지 않고 다시 찾아가 인물을 만날 수 있다.
          </p>
        </div>
        <div className="mr-qgrid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {scenario.locations.map((l) => {
            const open = locationOpen(scenario, run, l)
            const visited = run.visited.includes(l.id)
            const insp = run.inspect[l.id]
            return (
              <div key={l.id} className="card" style={{ margin: 0, opacity: open || visited ? 1 : 0.5 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{l.order}. {l.name}</strong>
                  {visited ? <span className="pill pill-solid">조사함</span> : !open && <span className="pill pill-muted">잠김</span>}
                </div>
                <p className="dim" style={{ fontSize: 12, lineHeight: 1.6, margin: '6px 0' }}>{open || visited ? l.blurb : l.lockedHint ?? '아직 갈 이유를 찾지 못했다.'}</p>
                {visited ? (
                  <button style={{ fontSize: 12 }} onClick={() => setRun((r) => ({ ...r, step: 'location', current: l.id }))}>
                    다시 찾아가기 (찾은 단서 {insp?.found?.length ?? 0})
                  </button>
                ) : (
                  <button className="primary" style={{ fontSize: 12 }} disabled={!open || dayDone || run.visited.length >= (scenario.settings?.visitLimit ?? 5)}
                    onClick={() => setRun((r) => ({ ...r, step: 'location', current: l.id, visited: [...r.visited, l.id], visitsToday: r.visitsToday + 1, inspect: { ...r.inspect, [l.id]: r.inspect[l.id] ?? { used: 0, found: [], misses: [] } } }))}>
                    조사하러 간다
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {dayDone && <EndDayButton scenario={scenario} run={run} setRun={setRun} />}
        {notebookModal}
      </div>
    )
  }

  // ---------- 장소 ----------
  if (run.step === 'location') {
    const loc = locOf(run.current)
    return (
      <div className="page">
        <Masthead />
        {header}
        <LocationView scenario={scenario} run={run} setRun={setRun} loc={loc} clueMap={clueMap} mediaUrl={mediaUrl} charOf={charOf} />
        <button className="primary" style={{ width: '100%' }} onClick={() => setRun((r) => ({ ...r, step: 'map', current: null }))}>조사를 마치고 지도로 돌아간다 →</button>
        {notebookModal}
      </div>
    )
  }

  // ---------- 하루 끝 결정 ----------
  if (run.step === 'decision') {
    const d = scenario.decisions.find((x) => x.id === run.pendingDecision)
    return (
      <div className="page">
        <Masthead />
        {header}
        <DecisionView scenario={scenario} run={run} d={d} mediaUrl={mediaUrl} onChoose={(opt) =>
          setRun((r) => {
            const decisions = { ...r.decisions, [d.id]: opt }
            const fl = d.options.find((o) => o.id === opt)?.effect?.flip
            const flipped = fl ? { ...r.flipped, [fl]: true } : r.flipped
            const met = fl ? { ...r.met, [fl]: true } : r.met
            return { ...r, decisions, flipped, met, pendingDecision: null, ...afterDay(scenario, { ...r, decisions }) }
          })} />
        {notebookModal}
      </div>
    )
  }

  // ---------- 시간표 맞추기 ----------
  if (run.step === 'timeline') {
    return (
      <div className="page">
        <Masthead />
        {header}
        <TimelineView scenario={scenario} run={run} onDone={(order) => setRun((r) => ({ ...r, timeline: order, step: 'report' }))} />
        {notebookModal}
      </div>
    )
  }

  // ---------- 보고서 ----------
  if (run.step === 'report') {
    return (
      <div className="page">
        <Masthead />
        {header}
        <ReportView scenario={scenario} run={run} mediaUrl={mediaUrl} onSubmit={(report, decisions) =>
          setRun((r) => {
            const next = { ...r, report, decisions: { ...r.decisions, ...decisions } }
            return { ...next, endingId: decideEnding(scenario, next), step: 'ending' }
          })} />
        {notebookModal}
      </div>
    )
  }

  // ---------- 결말 ----------
  if (run.step === 'ending') {
    const e = scenario.endings.find((x) => x.id === run.endingId)
    const d4 = scenario.decisions.find((x) => x.id === 'd4')?.options.find((o) => o.id === run.decisions.d4)
    return (
      <div className="page">
        <Masthead />
        <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kicker">결말</div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 26, margin: '4px 0 12px' }}>{e.title}</h1>
          <Media kind="video" src={mediaUrl(e.video)} />
          <p style={{ fontSize: 14.5, lineHeight: 1.85, margin: '12px 0 0' }}>{e.text}</p>
          {e.useD4Line && d4?.endingLine && <p style={{ fontSize: 14.5, lineHeight: 1.85, margin: '8px 0 0' }}>{d4.endingLine}</p>}
          <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <div className="card" style={{ margin: 0, flex: 1, minWidth: 200 }}><div className="kicker">얻은 것</div><p style={{ margin: 0, fontSize: 13 }}>{e.gain}</p></div>
            <div className="card" style={{ margin: 0, flex: 1, minWidth: 200 }}><div className="kicker">잃은 것</div><p style={{ margin: 0, fontSize: 13 }}>{e.loss}</p></div>
          </div>
          <p className="dim" style={{ fontSize: 12, margin: '12px 0 0' }}>어느 결말도 ‘정답’은 아닙니다.</p>
        </div>
        <button className="primary" style={{ width: '100%' }} onClick={() => setRun((r) => ({ ...r, step: 'missed' }))}>놓친 장면 보기 →</button>
      </div>
    )
  }

  // ---------- 놓친 장면 ----------
  if (run.step === 'missed') {
    const unvisited = scenario.locations.filter((l) => !run.visited.includes(l.id))
    const missedClues = scenario.locations.flatMap((l) => cluesOf(scenario, run, l).filter((c) => c.difficulty !== 'fake' && !run.found.includes(c.id)).map((c) => ({ ...c, loc: l.name })))
    return (
      <div className="page">
        <Masthead />
        <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="kicker">놓친 장면</div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 22, margin: '4px 0 10px' }}>{scenario.missed?.title ?? '당신이 보지 못한 것'}</h2>
          <strong style={{ fontSize: 13 }}>가지 않은 장소</strong>
          <p style={{ fontSize: 13.5, margin: '4px 0 12px' }}>{unvisited.map((l) => l.name).join(', ') || '없음'}</p>
          <strong style={{ fontSize: 13 }}>찾지 못한 단서 {missedClues.length}개</strong>
          <div className="col" style={{ gap: 4, marginTop: 6 }}>
            {missedClues.map((c) => <div key={c.id} style={{ fontSize: 13 }}>· {c.title} <span className="dim">({c.loc})</span></div>)}
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 0' }}>{scenario.missed?.question ?? '이것을 알았다면 보고서가 달라졌을까요?'}</p>
        </div>
        <button className="primary" style={{ width: '100%' }} onClick={() => setRun((r) => ({ ...r, step: scenario.hiddenStory ? 'story' : 'ended' }))}>
          {scenario.hiddenStory ? `${scenario.hiddenStory.title ?? '숨겨진 이야기'} →` : '나의 조사 기록과 성찰 →'}
        </button>
      </div>
    )
  }

  // ---------- 숨겨진 이야기 (결말·놓친 장면 뒤, 사건의 전모) ----------
  if (run.step === 'story' && scenario.hiddenStory) {
    return (
      <div className="page">
        <Masthead />
        <HiddenStory scenario={scenario} run={run} mediaUrl={mediaUrl} />
        <button className="primary" style={{ width: '100%' }} onClick={() => setRun((r) => ({ ...r, step: 'ended' }))}>나의 조사 기록과 성찰 →</button>
      </div>
    )
  }

  // ---------- 결과·성찰 ----------
  return <ResultView scenario={scenario} run={run} uid={uid} tier={tier} studentIdentity={studentIdentity} onRestart={restart} onExit={() => navigate('/')} />
}

function HiddenStory({ scenario, run, mediaUrl }) {
  const st = scenario.hiddenStory
  const reached = new Set(layersReached(scenario, run).map((l) => l.id))
  return (
    <>
      <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
        <div className="kicker">{st.kicker ?? '사건의 전모'}</div>
        <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 24, margin: '4px 0 10px' }}>{st.title}</h1>
        {st.video && <Media kind="video" src={mediaUrl(st.video)} />}
        {st.intro && <p style={{ fontSize: 14, lineHeight: 1.85, margin: '8px 0 0', whiteSpace: 'pre-line' }}>{st.intro}</p>}
      </div>
      {(st.chapters ?? []).map((c, i) => {
        const got = c.layer ? reached.has(c.layer) : null
        return (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${got === false ? 'var(--line)' : 'var(--gold)'}` }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div className="kicker">{c.kicker ?? `${i + 1}`}</div>
              {got != null && <span className={`pill ${got ? 'pill-solid' : 'pill-muted'}`}>{got ? '당신이 도달한 진실' : '당신이 놓친 진실'}</span>}
            </div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 17, margin: '2px 0 8px' }}>{c.heading}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.85, margin: 0, whiteSpace: 'pre-line' }}>{c.text}</p>
          </div>
        )
      })}
      {st.timeline?.length > 0 && (
        <div className="card">
          <div className="kicker">{st.timelineTitle ?? '그날 밤 실제 시간표'}</div>
          <div className="col" style={{ gap: 6, marginTop: 6 }}>
            {st.timeline.map((t, i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--gold-light)', minWidth: 48 }}>{t.time}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.6 }}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {st.closing && (
        <div className="card">
          <p style={{ fontSize: 15, lineHeight: 1.9, margin: 0, fontWeight: 600, whiteSpace: 'pre-line' }}>{st.closing}</p>
        </div>
      )}
    </>
  )
}

// 하루를 마친 뒤 어디로 갈지 (결정 → 다음 날, 마지막 날은 시간표)
function afterDay(scenario, run) {
  const days = scenario.settings?.days ?? [2, 2, 1]
  if (run.day >= days.length) return { step: 'timeline' }
  return { step: 'map', day: run.day + 1, visitsToday: 0 }
}

function EndDayButton({ scenario, run, setRun }) {
  const d = (scenario.decisions ?? []).find((x) => x.when === `day${run.day}` && !run.decisions[x.id] && decisionAvailable(scenario, run, x))
  const days = scenario.settings?.days ?? [2, 2, 1]
  const last = run.day >= days.length
  return (
    <button className="primary" style={{ width: '100%' }} onClick={() => setRun((r) => (d ? { ...r, step: 'decision', pendingDecision: d.id } : { ...r, ...afterDay(scenario, r) }))}>
      {d ? `${run.day}일 차 저녁으로 →` : last ? '시간표를 맞추러 간다 →' : `${run.day + 1}일 차로 →`}
    </button>
  )
}

function StartScreen({ scenario, onStart }) {
  const [level, setLevel] = useState(scenario.settings?.defaultLevel ?? 'standard')
  const [name, setName] = useState('')
  return (
    <div className="page">
      <Masthead showBack />
      <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
        <div className="kicker">{scenario.meta.series ?? '놓친 장면'}</div>
        <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 26, margin: '4px 0 8px' }}>{scenario.meta.title}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>{scenario.meta.subtitle}</p>
        {scenario.notice && <p className="dim" style={{ fontSize: 12, lineHeight: 1.7, margin: '10px 0 0' }}>{scenario.notice}</p>}
      </div>
      <div className="card col">
        <strong style={{ fontSize: 13 }}>난이도 (선생님 안내에 따라 고르세요)</strong>
        {Object.entries(scenario.levels ?? {}).map(([k, lv]) => (
          <label key={k} className={`mr-option ${level === k ? 'on' : ''}`} onClick={() => setLevel(k)} style={{ cursor: 'pointer' }}>
            <span className="mr-radio" />
            <span><strong>{lv.label}</strong> <span className="dim">· {lv.minutes}</span><br /><span className="dim" style={{ fontSize: 12 }}>{lv.desc}</span></span>
          </label>
        ))}
        <input placeholder="닉네임 (선택)" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        <button className="primary" onClick={() => onStart(level, name.trim())}>조사관으로 출발한다 →</button>
      </div>
    </div>
  )
}

function LocationView({ scenario, run, setRun, loc, clueMap, mediaUrl, charOf }) {
  const insp = run.inspect[loc.id] ?? { used: 0, found: [], misses: [] }
  const limit = inspectLimitOf(scenario, run, loc)
  const mode = inspectModeOf(scenario, run)
  const spots = spotsOf(scenario, run, loc)
  const placed = spots.filter(isPlaced)
  const unplaced = spots.filter((s) => !isPlaced(s))
  const timed = spots.some(isTimed)
  const [playing, setPlaying] = useState(false)
  const [dur, setDur] = useState(0)
  const [msg, setMsg] = useState(null)
  const [justFound, setJustFound] = useState(null)
  const [curT, setCurT] = useState(0)
  const videoRef = useRef(null)
  const left = limit - insp.used
  const clues = cluesOf(scenario, run, loc)
  const inspectedIds = new Set([...(insp.found ?? []), ...(insp.decoys ?? [])])

  const use = (spot, point) => {
    if (left <= 0) return
    setRun((r) => {
      const cur = r.inspect[loc.id] ?? { used: 0, found: [], misses: [] }
      const nextInsp = { ...cur, used: cur.used + 1 }
      let found = r.found
      if (spot?.kind === 'clue' && !cur.found.includes(spot.id)) {
        nextInsp.found = [...cur.found, spot.id]
        found = r.found.includes(spot.id) ? r.found : [...r.found, spot.id]
      } else if (spot?.kind === 'decoy') nextInsp.decoys = [...(cur.decoys ?? []), spot.id]
      else if (point) nextInsp.misses = [...(cur.misses ?? []), point]
      return { ...r, found, inspect: { ...r.inspect, [loc.id]: nextInsp } }
    })
    if (spot?.kind === 'clue') {
      setJustFound(spot.id)
      setMsg(null)
    } else {
      setJustFound(null)
      setMsg(spot?.kind === 'decoy' ? spot.text ?? '자세히 살펴봤지만 사건과 관련된 것은 없었다.' : timed && point ? '그 순간 그곳에서는 아무것도 찾지 못했다.' : '그곳에서는 아무것도 찾지 못했다.')
    }
  }
  const nowT = () => (videoRef.current ? videoRef.current.currentTime : null)
  const onOverlayClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - rect.left) / rect.width
    const fy = (e.clientY - rect.top) / rect.height
    const hit = hitSpot(placed, fx, fy, nowT())
    if (hit && inspectedIds.has(hit.id)) return setMsg('이미 살펴본 곳이다.')
    use(hit ?? null, hit ? null : { x: fx, y: fy, t: nowT() })
  }
  const videoSrc = mediaUrl(loc.video)
  // 영상이 있으면 언제나 영상 위에서 지목한다. 장소 컷은 영상이 없을 때만 쓴다.
  const posterSrc = videoSrc ? null : mediaUrl(loc.poster)
  const ch = loc.character ? charOf(loc.character) : null
  const dot = (r, extra) => ({ position: 'absolute', left: `${(r.x + (r.w ?? 0.12) / 2) * 100}%`, top: `${(r.y + (r.h ?? 0.12) / 2) * 100}%`, transform: 'translate(-50%,-50%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', ...extra })
  // 입문(돋보기 힌트): 영상이 재생되는 동안에도 지금 보이는 단서 자리에 표시
  const hintRects = mode === 'marker' ? placed.filter((s) => !inspectedIds.has(s.id)).flatMap((s) => activeRects(s, curT).map((r, i) => ({ key: `${s.id}_${i}`, r }))) : []

  return (
    <>
      <div className="card">
        <div className="kicker">{loc.order}. {loc.name}</div>
        {videoSrc && placed.length > 0 && <p className="dim" style={{ fontSize: 12, margin: '6px 0 0' }}>영상을 보다가 수상한 것이 보이면 <strong>그 자리를 바로 클릭</strong>하세요. 영상이 멈추며 그 순간을 조사합니다. 단서는 화면에 보이는 순간에만 찾을 수 있고, 빗나가도 지목 1번이 쓰입니다.</p>}
        <div style={{ position: 'relative', marginTop: 6 }}>
          {videoSrc ? <video ref={videoRef} playsInline preload="metadata" src={videoSrc} controls={placed.length === 0}
              onTimeUpdate={(e) => setCurT(e.currentTarget.currentTime)} onSeeked={(e) => setCurT(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
              style={{ ...box, background: '#000' }} />
          : posterSrc ? <img src={posterSrc} alt="" style={box} />
          : <div className="dim" style={{ ...box, padding: 30, textAlign: 'center' }}>(장소 영상 준비 중)</div>}
          {hintRects.map(({ key, r }) => (
            <span key={key} style={dot(r, { width: 30, height: 30, border: '2px solid var(--gold)', background: 'rgba(20,16,8,.5)', color: 'var(--gold-light)', fontSize: 15 })}>?</span>
          ))}
          {(insp.found ?? []).flatMap((cid) => {
            const s = placed.find((x) => x.id === cid)
            return s ? activeRects(s, curT).map((r, i) => <span key={`${cid}_${i}`} style={dot(r, { width: 24, height: 24, background: 'rgba(201,162,39,.92)', color: '#1a1510', fontSize: 13 })}>✓</span>) : []
          })}
          {placed.length > 0 && (videoSrc || posterSrc) && (
            <div onClick={(e) => {
                videoRef.current?.pause()
                if (left <= 0) return setMsg('이 장소에서는 더 지목할 수 없다.')
                onOverlayClick(e)
              }}
              style={{ position: 'absolute', inset: 0, cursor: left > 0 ? 'crosshair' : 'default', borderRadius: 'var(--radius)' }} />
          )}
          {videoSrc && placed.length > 0 && !playing && curT < 0.05 && (
            <button onClick={() => videoRef.current?.play()} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 15, padding: '10px 18px', background: 'rgba(20,16,8,.75)' }}>▶ 영상 재생</button>
          )}
        </div>
        {videoSrc && placed.length > 0 && (
          <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6 }}>
            <button style={{ fontSize: 13, padding: '4px 12px', minWidth: 44 }} onClick={() => (playing ? videoRef.current?.pause() : videoRef.current?.play())}>{playing ? '❚❚' : '▶'}</button>
            <button style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 2) }}>↺ 2초</button>
            <input type="range" min="0" max={dur || 0} step="0.1" value={curT} style={{ flex: 1 }}
              onChange={(e) => { if (videoRef.current) { videoRef.current.currentTime = Number(e.target.value); setCurT(Number(e.target.value)) } }} />
            <span className="dim" style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>{curT.toFixed(1)} / {dur.toFixed(1)}초</span>
          </div>
        )}
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>지목 {left}/{limit}</strong>
          <span className="dim" style={{ fontSize: 12 }}>찾은 단서 {insp.found?.length ?? 0}/{clues.length}</span>
        </div>
        {unplaced.length > 0 && left > 0 && (
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            <span className="dim" style={{ fontSize: 12 }}>살펴볼 곳을 고르세요.</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {unplaced.filter((s) => !inspectedIds.has(s.id)).map((s) => <button key={s.id} style={{ fontSize: 12 }} onClick={() => use(s)}>{s.label}</button>)}
            </div>
          </div>
        )}
        {msg && <div className="mr-feedback" style={{ padding: 8, fontSize: 13, marginTop: 8 }}>{msg}</div>}
        {justFound && (
          <div style={{ marginTop: 8 }}>
            <div className="kicker" style={{ color: 'var(--gold-light)' }}>단서를 찾았다!</div>
            <ClueCardView scenario={scenario} run={run} clue={clueMap[justFound]} mediaUrl={mediaUrl} />
          </div>
        )}
        {(insp.found ?? []).filter((c) => c !== justFound).length > 0 && (
          <div className="col" style={{ gap: 6, marginTop: 10 }}>
            <span className="dim" style={{ fontSize: 12 }}>이 장소에서 찾은 단서</span>
            {(insp.found ?? []).filter((c) => c !== justFound).map((cid) => <ClueCardView key={cid} scenario={scenario} run={run} clue={clueMap[cid]} mediaUrl={mediaUrl} compact />)}
          </div>
        )}
      </div>
      {ch ? <PersonView scenario={scenario} run={run} setRun={setRun} ch={ch} clueMap={clueMap} mediaUrl={mediaUrl} /> : <div className="card dim" style={{ fontSize: 13 }}>이곳에는 만날 사람이 없다.</div>}
    </>
  )
}

function PersonView({ scenario, run, setRun, ch, clueMap, mediaUrl }) {
  const [sel, setSel] = useState([])
  const [reply, setReply] = useState(null)
  const flipped = !!run.flipped[ch.id]
  const locked = !flipped && statementLocked(scenario, run, ch)
  useEffect(() => {
    if (!run.met[ch.id]) setRun((r) => ({ ...r, met: { ...r.met, [ch.id]: true } }))
  }, [ch.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const present = () => {
    if (presentWorks(ch, sel)) {
      setRun((r) => ({ ...r, flipped: { ...r.flipped, [ch.id]: true } }))
      setReply(null)
    } else {
      setRun((r) => ({ ...r, wrong: { ...r.wrong, [ch.id]: (r.wrong[ch.id] ?? 0) + 1 } }))
      setReply(ch.wrongReply ?? '그게 무슨 상관입니까.')
    }
    setSel([])
  }
  const toggle = (cid) => setSel((s) => (s.includes(cid) ? s.filter((x) => x !== cid) : s.length >= 2 ? [s[1], cid] : [...s, cid]))
  return (
    <div className="card">
      <div className="kicker">인물</div>
      <strong style={{ fontSize: 15 }}>{ch.name} <span className="dim" style={{ fontWeight: 400, fontSize: 13 }}>({ch.age}) · {ch.role}</span></strong>
      <div style={{ marginTop: 8 }}>
        <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>첫 번째 진술</div>
        <Media kind="video" src={mediaUrl(ch.statement1?.video)} />
        <p style={{ fontSize: 13.5, lineHeight: 1.75, margin: '6px 0 0' }}>“{ch.statement1?.text}”</p>
      </div>
      {flipped ? (
        <div style={{ marginTop: 12 }}>
          <div className="kicker" style={{ color: 'var(--gold-light)' }}>두 번째 진술</div>
          <Media kind="video" src={mediaUrl(ch.statement2?.video)} />
          <p style={{ fontSize: 13.5, lineHeight: 1.75, margin: '6px 0 0' }}>“{ch.statement2?.text}”</p>
          {run.decisions.d2 === 'promise' && ch.id === scenario.decisions.find((d) => d.id === 'd2')?.character && (
            <p className="dim" style={{ fontSize: 12, margin: '6px 0 0' }}>이름을 빼 주기로 약속하고 들은 진술이라, 보고서의 증거로는 쓸 수 없다.</p>
          )}
        </div>
      ) : locked ? (
        <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>{ch.name}은(는) 더 이상 말하지 않는다.</p>
      ) : (
        <div className="col" style={{ gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 13 }}>진술의 모순을 짚을 단서를 내밀어 보자. (한 번에 두 장까지{wrongLimitOf(scenario, run) != null ? `, 틀린 단서를 ${wrongLimitOf(scenario, run)}번 내밀면 입을 닫는다` : ''})</span>
          <div className="mr-qgrid">
            {run.found.map((cid) => (
              <button key={cid} className={`mr-qcard ${sel.includes(cid) ? 'picked' : ''}`} onClick={() => toggle(cid)}>{clueMap[cid]?.title}</button>
            ))}
          </div>
          <button className="primary" style={{ alignSelf: 'flex-start' }} disabled={!sel.length} onClick={present}>
            단서 {sel.length}장 내밀기
          </button>
          {reply && <div className="mr-feedback" style={{ padding: 8, fontSize: 13 }}>{ch.name}: “{reply}” {wrongLimitOf(scenario, run) != null && <span className="dim">(남은 기회 {Math.max(0, wrongLimitOf(scenario, run) - (run.wrong[ch.id] ?? 0))})</span>}</div>}
        </div>
      )}
    </div>
  )
}

function Notebook({ scenario, run, setRun, tab, setTab, onClose, clueMap, mediaUrl, charOf, locOf }) {
  const [sel, setSel] = useState([])
  const [msg, setMsg] = useState(null)
  const limit = linkLimitOf(scenario, run)
  const tryLink = () => {
    if (sel.length !== 2) return
    if (limit != null && run.linkTries >= limit) return
    const l = findLink(scenario, sel[0], sel[1])
    setRun((r) => ({ ...r, linkTries: r.linkTries + 1, links: l && !r.links.includes(l.id) ? [...r.links, l.id] : r.links }))
    setMsg(l ? null : scenario.linkWrongText ?? '이 두 단서는 이어지지 않습니다.')
    setSel([])
  }
  return (
    <Modal title="조사 수첩" onClose={onClose} wide>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {[['clues', `단서 ${run.found.length}`], ['people', '인물'], ['links', `단서 잇기 ${run.links.length}`], ['videos', '지난 영상']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'mr-selected' : ''} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'clues' && <div className="col" style={{ gap: 8 }}>{run.found.map((cid) => <ClueCardView key={cid} scenario={scenario} run={run} clue={clueMap[cid]} mediaUrl={mediaUrl} />)}</div>}
      {tab === 'people' && (
        <div className="col" style={{ gap: 8 }}>
          {scenario.characters.filter((c) => run.met[c.id]).map((c) => (
            <div key={c.id} className="card" style={{ margin: 0 }}>
              <strong>{c.name}</strong> <span className="dim" style={{ fontSize: 12 }}>· {c.role} · {locOf(c.locationId)?.name}</span>
              <p style={{ fontSize: 13, margin: '6px 0 0' }}>① “{c.statement1?.text}”</p>
              {run.flipped[c.id] ? <p style={{ fontSize: 13, margin: '6px 0 0', color: 'var(--gold-light)' }}>② “{c.statement2?.text}”</p> : <p className="dim" style={{ fontSize: 12, margin: '6px 0 0' }}>{statementLocked(scenario, run, c) ? '더 이상 말하지 않는다.' : '두 번째 진술은 아직 열리지 않았다. 그 장소로 다시 찾아가 단서를 내밀 수 있다.'}</p>}
            </div>
          ))}
          {!Object.keys(run.met).length && <p className="dim">아직 만난 사람이 없다.</p>}
        </div>
      )}
      {tab === 'links' && (
        <div className="col" style={{ gap: 8 }}>
          <span style={{ fontSize: 13 }}>서로 다른 단서 두 장을 골라 이어 보자. 맞으면 새로운 추론이 열린다.{limit != null && ` (남은 시도 ${Math.max(0, limit - run.linkTries)})`}</span>
          <div className="mr-qgrid">
            {run.found.map((cid) => (
              <button key={cid} className={`mr-qcard ${sel.includes(cid) ? 'picked' : ''}`} onClick={() => setSel((s) => (s.includes(cid) ? s.filter((x) => x !== cid) : s.length >= 2 ? [s[1], cid] : [...s, cid]))}>{clueMap[cid]?.title}</button>
            ))}
          </div>
          <button className="primary" style={{ alignSelf: 'flex-start' }} disabled={sel.length !== 2 || (limit != null && run.linkTries >= limit)} onClick={tryLink}>두 단서 잇기</button>
          {msg && <div className="mr-feedback" style={{ padding: 8, fontSize: 13 }}>{msg}</div>}
          <strong style={{ fontSize: 13 }}>열린 추론</strong>
          {run.links.map((lid) => {
            const l = scenario.links.find((x) => x.id === lid)
            return <div key={lid} className="card" style={{ margin: 0 }}><span className="dim" style={{ fontSize: 12 }}>{l.clues.map((c) => clueMap[c]?.title).join(' + ')}</span><p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{l.text}</p></div>
          })}
          {!run.links.length && <p className="dim" style={{ fontSize: 12 }}>아직 열린 추론이 없다.</p>}
        </div>
      )}
      {tab === 'videos' && (
        <div className="col" style={{ gap: 10 }}>
          {run.visited.map((lid) => { const l = locOf(lid); return <div key={lid}><strong style={{ fontSize: 13 }}>{l.name}</strong><Media kind="video" src={mediaUrl(l.video)} /></div> })}
          {scenario.characters.filter((c) => run.met[c.id]).map((c) => (
            <div key={c.id}><strong style={{ fontSize: 13 }}>{c.name} 진술</strong><Media kind="video" src={mediaUrl(c.statement1?.video)} />{run.flipped[c.id] && <Media kind="video" src={mediaUrl(c.statement2?.video)} />}</div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function PhoneCall({ call, mediaUrl }) {
  if (!call) return null
  return (
    <div className="card" style={{ margin: 0, borderColor: 'rgba(94,145,224,.5)' }}>
      <div className="kicker" style={{ color: '#9db8e8' }}>{call.who ?? '전화'}</div>
      {call.image && <Media kind="image" src={mediaUrl(call.image)} />}
      {call.audio && <Media kind="audio" src={mediaUrl(call.audio)} />}
      <p style={{ fontSize: 14, lineHeight: 1.8, margin: '8px 0 0' }}>“{call.text}”</p>
    </div>
  )
}

function DecisionView({ scenario, run, d, mediaUrl, onChoose }) {
  const [opt, setOpt] = useState(null)
  const [heard, setHeard] = useState(null)
  const notVisited = d.visitLoc && !run.visited.includes(d.visitLoc)
  if (heard) {
    const ch = scenario.characters.find((c) => c.id === heard)
    return (
      <div className="card col">
        <div className="kicker">{ch.name}의 두 번째 진술</div>
        <Media kind="video" src={mediaUrl(ch.statement2?.video)} />
        <p style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0 }}>“{ch.statement2?.text}”</p>
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>이름을 빼 주기로 약속하고 들은 진술이라, 보고서의 증거로는 쓸 수 없다. (수첩의 인물 칸에서 다시 볼 수 있다)</p>
        <button className="primary" onClick={() => onChoose(opt)}>다음으로 →</button>
      </div>
    )
  }
  const choose = () => {
    const fl = d.options.find((o) => o.id === opt)?.effect?.flip
    if (fl) setHeard(fl)
    else onChoose(opt)
  }
  return (
    <div className="card col">
      <div className="kicker">{d.label}</div>
      <PhoneCall call={notVisited && d.callIfNotVisited ? d.callIfNotVisited : d.call} mediaUrl={mediaUrl} />
      <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>{notVisited && d.situationIfNotVisited ? d.situationIfNotVisited : d.situation}</p>
      {d.options.map((o) => (
        <label key={o.id} className={`mr-option ${opt === o.id ? 'on' : ''}`} onClick={() => setOpt(o.id)} style={{ cursor: 'pointer' }}>
          <span className="mr-radio" /><span>{o.label}</span>
        </label>
      ))}
      <button className="primary" disabled={!opt} onClick={choose}>결정한다</button>
    </div>
  )
}

function TimelineView({ scenario, run, onDone }) {
  const cards = scenario.timeline?.cards ?? []
  const [order, setOrder] = useState(() => [...cards].sort((a, b) => (a.shuffle ?? 0) - (b.shuffle ?? 0)).map((c) => c.id))
  const move = (i, d) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n })
  return (
    <div className="card col">
      <div className="kicker">3일 차 · 시간표 맞추기</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>{scenario.timeline?.intro ?? '그날 밤 일어난 일을 시간 순서대로 놓아 보자. 단서로 확인한 카드에만 시각이 적혀 있다.'}</p>
      {order.map((cid, i) => {
        const c = cards.find((x) => x.id === cid)
        const t = timelineCardTime(scenario, run, c)
        return (
          <div key={cid} className="row" style={{ gap: 8, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', width: 52, color: t ? 'var(--gold-light)' : 'var(--ink-dim)' }}>{t ?? '--:--'}</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>{c.text}</span>
            <button style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
            <button style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => move(i, 1)} disabled={i === order.length - 1}>▼</button>
          </div>
        )
      })}
      <button className="primary" onClick={() => onDone(order)}>이 순서로 확정하고 보고서를 쓴다 →</button>
    </div>
  )
}

function ReportView({ scenario, run, mediaUrl, onSubmit }) {
  const qs = scenario.report?.questions ?? []
  const [ans, setAns] = useState({})
  const [dec, setDec] = useState({})
  const reportDecisions = (scenario.decisions ?? []).filter((d) => d.when === 'report' && decisionAvailable(scenario, { ...run, report: ans }, d))
  const ready = qs.every((q) => ans[q.id]) && reportDecisions.every((d) => dec[d.id])
  return (
    <div className="card col">
      <div className="kicker">최종 보고서</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>{scenario.report?.intro}</p>
      {qs.map((q) => (
        <div key={q.id} className="col" style={{ gap: 6 }}>
          <strong style={{ fontSize: 14 }}>{q.q}</strong>
          {q.options.map((o) => (
            <label key={o.id} className={`mr-option ${ans[q.id] === o.id ? 'on' : ''}`} onClick={() => setAns((a) => ({ ...a, [q.id]: o.id }))} style={{ cursor: 'pointer' }}>
              <span className="mr-radio" /><span>{o.label}</span>
            </label>
          ))}
        </div>
      ))}
      {reportDecisions.map((d) => (
        <div key={d.id} className="col" style={{ gap: 6 }}>
          <div className="kicker">{d.label}</div>
          <PhoneCall call={d.call} mediaUrl={mediaUrl} />
          <strong style={{ fontSize: 14 }}>{d.situation}</strong>
          {d.options.map((o) => (
            <label key={o.id} className={`mr-option ${dec[d.id] === o.id ? 'on' : ''}`} onClick={() => setDec((x) => ({ ...x, [d.id]: o.id }))} style={{ cursor: 'pointer' }}>
              <span className="mr-radio" /><span>{o.label}</span>
            </label>
          ))}
        </div>
      ))}
      <button className="primary" disabled={!ready} onClick={() => onSubmit(ans, dec)}>보고서를 제출한다</button>
    </div>
  )
}

function ResultView({ scenario, run, uid, tier, studentIdentity, onRestart, onExit }) {
  const exportRef = useRef(null)
  const [answers, setAnswers] = useState({})
  const [aiFeedback, setAiFeedback] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const ending = scenario.endings.find((e) => e.id === run.endingId)
  const layers = layersReached(scenario, run)
  const label = (qid, v) => scenario.report.questions.find((q) => q.id === qid)?.options.find((o) => o.id === v)?.label ?? '-'
  const decLabel = (did) => scenario.decisions.find((d) => d.id === did)?.options.find((o) => o.id === run.decisions[did])?.label
  const tScore = timelineScore(scenario, run)
  const prompts = scenario.reflectionPrompts ?? []
  const submit = async () => {
    if (tier !== 'homeSchoolStudent' || !studentIdentity) return
    setAiBusy(true)
    setAiError(null)
    let logId
    try {
      logId = await saveReflectionLog({
        uid, studentName: studentIdentity.name, studentId: studentIdentity.studentId, scenarioId: scenario.scenarioId, roomCode: null,
        characterId: 'missed_scene_investigator', reflectionPrompts: prompts, answers,
        resultSummary: { endingId: run.endingId, endingTitle: ending?.title, accusedLabel: label('who', run.report.who), moralChoiceLabel: `도달한 겹 ${layers.length}/${scenario.layers?.length ?? 5}` },
      })
      const { feedback } = await getAiFeedback({
        reflectionLogId: logId,
        nickname: run.playerName || studentIdentity.name,
        scenarioTitle: `${scenario.meta.title} (놓친 장면)`,
        endingTitle: ending?.title,
        endingMessage: `조사관으로서 수문을 연 사람을 "${label('who', run.report.who)}", 시각을 "${label('when', run.report.when)}", 이유를 "${label('why', run.report.why)}"로 보고했다. 결정: ${['d1', 'd2', 'd3', 'd4', 'd5'].map((k) => decLabel(k)).filter(Boolean).join(' / ')}. 결말: ${ending?.title}.`,
        qaPairs: prompts.map((q, i) => ({ question: q, answer: answers[i] ?? '' })),
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
      <div className="card col">
        <div className="kicker">성찰</div>
        {prompts.map((q, i) => (
          <div key={i} className="col" style={{ gap: 5 }}>
            <label className="dim" style={{ fontSize: 12 }}>{q}</label>
            <textarea rows={2} value={answers[i] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
          </div>
        ))}
        {tier === 'homeSchoolStudent' ? (
          <button className="primary" onClick={submit} disabled={aiBusy}>{aiBusy ? 'AI 피드백 생성 중...' : '성찰 기록 제출하기'}</button>
        ) : <p className="dim" style={{ fontSize: 12, margin: 0 }}>게스트 모드에서는 성찰 기록 제출과 AI 피드백이 제공되지 않아요. 결과는 이미지로 저장할 수 있습니다.</p>}
        {aiError && <p style={{ color: 'var(--blood-light)', margin: 0 }}>{aiError}</p>}
      </div>
      <div ref={exportRef} className="card" style={{ padding: '22px 20px' }}>
        <div className="kicker">나의 조사 기록</div>
        <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, margin: '0 0 4px' }}>{scenario.meta.title}</h2>
        <p className="dim" style={{ fontSize: 12, margin: '0 0 12px' }}>{run.playerName ? `${run.playerName} · ` : ''}{levelOf(scenario, run).label} · 결말: {ending?.title}</p>
        <table className="mr-table">
          <tbody>
            <tr><th>방문한 장소</th><td>{run.visited.map((l) => scenario.locations.find((x) => x.id === l)?.name).join(', ')}</td></tr>
            <tr><th>찾은 단서</th><td>{run.found.length - (scenario.startClues?.length ?? 0)}개 · 열린 추론 {run.links.length}/{scenario.links.length}</td></tr>
            <tr><th>도달한 겹</th><td>{layers.map((l) => l.name).join(' → ')}</td></tr>
            <tr><th>보고서</th><td>누가: {label('who', run.report.who)} · 언제: {label('when', run.report.when)} · 왜: {label('why', run.report.why)}</td></tr>
            <tr><th>결정</th><td>{scenario.decisions.map((d) => decLabel(d.id) && `${d.short ?? d.label}: ${decLabel(d.id)}`).filter(Boolean).join(' / ')}</td></tr>
            <tr><th>시간표</th><td>{tScore}/{scenario.timeline?.cards?.length ?? 0} 맞음</td></tr>
          </tbody>
        </table>
        {prompts.map((q, i) => <div key={i} style={{ marginTop: 8 }}><p className="dim" style={{ fontSize: 12, margin: 0 }}>{q}</p><p style={{ fontSize: 13, margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{answers[i] || '(무응답)'}</p></div>)}
        {aiFeedback && <><hr className="divider" /><AiFeedbackView feedback={aiFeedback} /></>}
      </div>
      <ResultExportButton targetRef={exportRef} filename={`${scenario.scenarioId}-record.jpg`} label="결과 이미지로 저장" />
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={onRestart}>다시 플레이하기 (다른 장소로)</button>
        <button onClick={onExit}>메인 화면으로</button>
      </div>
    </div>
  )
}
