// 청문회형 퍼즐 화면: 탐문(AI 기록관), 단서 보드(행동 포인트), 대질 신문, 책임 지도, 해결안 고르기.
import { useEffect, useState } from 'react'
import { Icon, NoteCard, useMr, fmtTime } from './common'
import { roleById } from '../roles'
import { isLocalMode } from '../store'
import { judgeTanmunQuestion } from '../../firebase/functionsApi.js'

const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase()

// 길잡이의 가짜 추천 답 (모든 잠금에 붙는다)
function Reco({ value, reason, by = '길잡이' }) {
  if (value == null) return null
  return <NoteCard block={{ recommend: value, by, reason }} />
}

// ---------------- 탐문 ----------------
const VERDICT_LABEL = { 네: '네', 아니오: '아니오', 그럴수도: '그럴 수도 있어요', 중요하지않음: '중요하지 않아요', 반려: '예/아니오로 답할 수 있게 물어 주세요' }

function matchFact(config, question, verdict, found = {}) {
  if (!['네', '아니오'].includes(verdict)) return null
  const q = norm(question)
  const hit = (f) => (f.keys ?? []).every((group) => group.some((k) => q.includes(norm(k))))
  return config.facts.find((f) => !found[f.id] && hit(f)) ?? config.facts.find(hit) ?? null
}

export function TanmunPuzzle({ config }) {
  const { mr } = useMr()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const log = mr.board.log ?? []
  const found = mr.board.found ?? {}
  const cardsMode = mr.board.mode === 'cards' || isLocalMode() || !config.scenarioId
  const asked = mr.board.asked ?? {}
  const myName = mr.players[mr.uid]?.name ?? '나'
  // 질문 제한: 모든 사실을 다 캐기 어렵게. 다 쓰고도 부족하면 실패 1회를 감수하고 추가 질문을 받는다.
  const limit = config.maxQuestions ? config.maxQuestions + (mr.board.extra ?? 0) : Infinity
  const used = mr.board.used ?? 0
  const out = used >= limit
  const maxOf = (b) => (config.maxQuestions ? config.maxQuestions + (b.extra ?? 0) : Infinity)

  const record = (entry, fact) =>
    mr.actions.updateBoard((b) => ({
      ...b,
      used: entry.v === '반려' ? b.used ?? 0 : (b.used ?? 0) + 1,
      log: [...(b.log ?? []), entry].slice(-40),
      found: fact ? { ...(b.found ?? {}), [fact.id]: true } : b.found ?? {},
    }))
  const buyExtra = async () => {
    await mr.actions.recordFail()
    await mr.actions.updateBoard((b) => ({ ...b, extra: (b.extra ?? 0) + 1, log: [...(b.log ?? []), { sys: '추가 질문 1개를 받았습니다. (실패 1회로 기록)' }] }))
  }

  const ask = async () => {
    const text = q.trim()
    if (!text || busy || out) return
    setBusy(true)
    try {
      const { verdict } = await judgeTanmunQuestion(config.scenarioId, text)
      const fact = matchFact(config, text, verdict, found)
      await record({ by: myName, q: text, v: verdict, fact: fact && !found[fact.id] ? fact.id : null }, fact)
      setQ('')
    } catch (e) {
      await mr.actions.updateBoard((b) => ({ ...b, mode: 'cards', log: [...(b.log ?? []), { sys: 'AI 기록관이 응답하지 않아 질문 카드로 바꿉니다.' }] }))
    } finally {
      setBusy(false)
    }
  }

  const askCard = (c) => {
    if (asked[c.id] || out) return
    const fact = c.fact ? config.facts.find((f) => f.id === c.fact) : null
    mr.actions.updateBoard((b) => (b.asked?.[c.id] || (b.used ?? 0) >= maxOf(b) ? b : {
      ...b,
      used: (b.used ?? 0) + 1,
      asked: { ...(b.asked ?? {}), [c.id]: true },
      log: [...(b.log ?? []), { by: myName, q: c.q, v: c.verdict, fact: fact && !b.found?.[fact.id] ? fact.id : null }].slice(-40),
      found: fact ? { ...(b.found ?? {}), [fact.id]: true } : b.found ?? {},
    }))
  }

  const n = Object.keys(found).length
  const quota = config.maxQuestions ? (
    <div className={`mr-quota ${out ? 'out' : ''}`}>
      남은 질문 <strong>{Math.max(0, limit - used)}</strong> / {limit}
      {out && n < (config.need ?? 3) && (
        <button className="mr-small" style={{ marginLeft: 8 }} onClick={buyExtra}>추가 질문 1개 받기 (실패 1회로 기록)</button>
      )}
      {out && n >= (config.need ?? 3) && <span className="dim" style={{ marginLeft: 8 }}>질문을 다 썼어요. 찾은 사실로 제출하세요.</span>}
    </div>
  ) : null
  return (
    <div className="mr-puzzle">
      <div className="mr-mat">
        <div className="mr-mat-title"><span className="row" style={{ gap: 6 }}><Icon name="key" />찾은 사실 {n}개 <span className="dim" style={{ fontWeight: 400 }}>({config.need ?? 3}개를 찾으면 통과)</span></span><span className="mr-tag blue">숨은 사실 {config.facts.length}개</span></div>
        <div className="col" style={{ gap: 6 }}>
          {config.facts.map((f) => (found[f.id] ? (
            <div key={f.id} className="mr-fact on"><strong>{f.title}</strong><div>{f.text}</div></div>
          ) : (
            <div key={f.id} className="mr-fact">??? 아직 찾지 못한 사실</div>
          )))}
        </div>
      </div>

      {quota}
      {!cardsMode ? (
        <div className="col" style={{ gap: 6 }}>
          <span className="dim" style={{ fontSize: 12 }}>AI 기록관은 <strong>예/아니오</strong>로만 답합니다. 모둠원이 돌아가며 질문을 불러 주세요.</span>
          <div className="row">
            <input style={{ flex: 1 }} value={q} maxLength={120} placeholder="예: 길잡이는 올해 데이터로 배웠나요?" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
            <button className="primary" disabled={busy || !q.trim() || out} onClick={ask}>{busy ? '판정 중…' : '질문하기'}</button>
          </div>
          <button className="mr-small mr-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => mr.actions.updateBoard((b) => ({ ...b, mode: 'cards' }))}>AI가 느리면: 질문 카드로 바꾸기</button>
        </div>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          <span className="dim" style={{ fontSize: 12 }}>질문 카드를 골라 기록관에게 물어보세요. 모든 질문이 사실로 이어지지는 않습니다.</span>
          <div className="mr-qgrid">
            {config.fallback.map((c) => (
              <button key={c.id} className={`mr-qcard ${asked[c.id] ? 'done' : ''}`} disabled={!!asked[c.id] || out} onClick={() => askCard(c)}>
                {c.q}
                {asked[c.id] && <div className="mr-qv">기록관: {VERDICT_LABEL[c.verdict] ?? c.verdict}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="mr-mat" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <div className="mr-mat-title"><span>질문 기록</span></div>
          {log.slice().reverse().map((e, i) => e.sys ? (
            <p key={i} className="dim" style={{ fontSize: 12 }}>{e.sys}</p>
          ) : (
            <p key={i} style={{ fontSize: 13 }}>
              <span className="dim">{e.by}:</span> {e.q} → <strong style={{ color: 'var(--gold-light)' }}>{VERDICT_LABEL[e.v] ?? e.v}</strong>
              {e.fact && <span className="mr-tag" style={{ marginLeft: 6 }}>사실 발견!</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------- 단서 보드 ----------------
export function ClueBoardPuzzle({ config }) {
  const { mr } = useMr()
  const opened = mr.board.opened ?? {}
  const solved = mr.board.solved ?? {}
  const used = mr.board.ap?.[mr.uid] ?? 0
  const players = Math.max(1, mr.playerUids.length)
  const myAp = mr.solo ? config.cards.length : Math.max(config.ap ?? 3, Math.ceil(config.cards.length / players))
  const left = myAp - used

  const open = (id) =>
    mr.actions.updateBoard((b) => {
      if (b.opened?.[id] || (b.ap?.[mr.uid] ?? 0) >= myAp) return b
      return { ...b, opened: { ...(b.opened ?? {}), [id]: mr.uid }, ap: { ...(b.ap ?? {}), [mr.uid]: (b.ap?.[mr.uid] ?? 0) + 1 } }
    })

  return (
    <div className="mr-puzzle">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>내 행동 포인트 <span style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>{left}/{myAp}</span></strong>
        <span className="dim" style={{ fontSize: 11 }}>단서를 열면 모두에게 보입니다. 잠긴 단서는 열고 나서 자물쇠를 풀어야 합니다.</span>
      </div>
      <div className="mr-clueboard">
        {config.cards.map((c) => (
          <ClueCard key={c.id} card={c} opened={opened[c.id]} solved={!!solved[c.id]} canOpen={left > 0} onOpen={() => open(c.id)} />
        ))}
      </div>
    </div>
  )
}

function ClueCard({ card, opened, solved, canOpen, onOpen }) {
  const { mr } = useMr()
  const [v, setV] = useState('')
  const [msg, setMsg] = useState(null)
  const [wrong, setWrong] = useState(0)
  const lock = card.lock
  const check = async () => {
    const ok = (lock.answer ?? []).some((a) => norm(a) === norm(v))
    if (ok) {
      await mr.actions.updateBoard((b) => ({ ...b, solved: { ...(b.solved ?? {}), [card.id]: true } }))
      setMsg(null)
    } else {
      mr.actions.recordFail()
      setWrong((w) => w + 1)
      setMsg(lock.wrongHint ?? '잘못 입력하셨습니다.')
    }
  }
  if (!opened) {
    return (
      <div className="mr-clue closed">
        <div className="mr-mat-title"><span className="row" style={{ gap: 6 }}><Icon name={lock ? 'lock' : 'note'} size={12} />{card.title}</span>{lock && <span className="mr-tag">잠김</span>}</div>
        <button className="mr-small" disabled={!canOpen} onClick={onOpen}>열기 (행동 포인트 1)</button>
      </div>
    )
  }
  return (
    <div className={`mr-clue ${lock && !solved ? 'locked' : ''}`}>
      <div className="mr-mat-title">
        <span className="row" style={{ gap: 6 }}><Icon name={lock ? 'lock' : 'note'} size={12} />{card.title}</span>
        <span className="dim" style={{ fontSize: 10 }}>연 사람: {mr.players[opened]?.name}</span>
      </div>
      <p style={{ whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.65 }}>{card.text}</p>
      {lock && (solved ? (
        <div className="mr-tag" style={{ alignSelf: 'flex-start', marginTop: 6 }}>풀림: {lock.solvedText ?? lock.answer[0]}</div>
      ) : (
        <div className="col" style={{ gap: 6, marginTop: 8 }}>
          <Reco value={lock.recommend} reason={lock.reason} />
          <div className="row">
            <input className="mr-lock-input" style={{ width: 160, fontSize: 18 }} value={v} placeholder={lock.prompt} maxLength={lock.length ?? 12} inputMode={lock.input === 'number' ? 'numeric' : 'text'} onChange={(e) => setV(e.target.value)} />
            <button className="mr-small" disabled={!v.trim()} onClick={check}>자물쇠에 입력</button>
          </div>
          {msg && <div className="mr-feedback" style={{ padding: 8, fontSize: 12 }}>{msg}</div>}
          {wrong >= 2 && lock.hint && <div className="mr-hint" style={{ fontSize: 12 }}><strong>힌트</strong> {lock.hint}</div>}
        </div>
      ))}
    </div>
  )
}

// ---------------- 대질 신문 ----------------
export function HearingPuzzle({ config }) {
  const { room, mr } = useMr()
  const b = mr.board
  const turns = config.turns
  const started = b.turn != null
  const turn = b.turn ?? 0
  const allDone = started && turn >= turns.length
  const interjectNow = !!config.interject && started && turn === config.interject.afterTurn && b.interject !== 'done'
  const per = config.secondsPerTurn ?? 70
  const speak = config.speakSeconds ?? 20
  const passed = b.turnAt ? Math.floor((mr.now - b.turnAt) / 1000) : 0
  const remain = Math.max(0, per - passed)
  const cur = turns[turn]

  const advance = (from) =>
    mr.actions.updateBoard((x) => (x.turn !== from ? x : { ...x, turn: from + 1, turnAt: Date.now() }))

  // 시간이 다 되면 다음 차례로 (누가 먼저 쓰든 한 번만 넘어간다)
  useEffect(() => {
    if (started && !allDone && !interjectNow && b.turnAt && remain === 0) advance(turn)
  }, [started, allDone, interjectNow, remain, turn, b.turnAt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!started) {
    return (
      <div className="mr-talk">
        <div className="mr-talk-kicker">말하기 시간 · 대질 신문</div>
        <p style={{ fontSize: 15 }}>다섯 인물이 차례로 변론합니다. 한 사람에게 {per}초. 변론하는 사람은 고개를 들고 말하고, 듣는 사람은 화면의 추천 질문으로 반박하세요.</p>
        <p className="dim" style={{ fontSize: 13 }}>듣는 사람은 상대가 기대는 <strong>도덕 원리</strong>를 맞혀 ‘원리 간파’에 도전할 수 있습니다. 간파하면 결정적 증거가 열립니다.</p>
        <button className="primary" onClick={() => mr.actions.updateBoard((x) => (x.turn != null ? x : { ...x, turn: 0, turnAt: Date.now() }))}>청문회 시작</button>
      </div>
    )
  }

  const rewards = turns.filter((t) => b.cracked?.[t.role])
  const evidence = (
    <>
      {(rewards.length > 0 || b.interject === 'done') && (
        <div className="col" style={{ gap: 6 }}>
          <strong style={{ fontSize: 13 }}>열린 결정적 증거</strong>
          {rewards.map((t) => (
            <div key={t.role} className="mr-mat" style={{ marginBottom: 0 }}>
              <div className="mr-mat-title"><span>{t.reward.title}</span><span className="mr-tag">{roleById(room, t.role)?.name} · {t.principle}</span></div>
              <p>{t.reward.text}</p>
            </div>
          ))}
          {b.interject === 'done' && config.interject?.reward && (
            <div className="mr-mat" style={{ marginBottom: 0 }}><div className="mr-mat-title"><span>{config.interject.reward.title}</span><span className="mr-tag">길잡이 증언 반박</span></div><p>{config.interject.reward.text}</p></div>
          )}
        </div>
      )}
    </>
  )

  if (allDone) {
    return (
      <div className="mr-puzzle">
        <div className="mr-talk">
          <div className="mr-talk-kicker">대질 신문 종료</div>
          <p>원리 간파 {Object.keys(b.cracked ?? {}).length}/{turns.length}. 모두 제출에 동의하면 책임 지도로 넘어갑니다.</p>
        </div>
        {evidence}
      </div>
    )
  }

  if (interjectNow) return <Interject config={config.interject} evidence={evidence} />

  const speakerRole = cur.role
  const speaker = roleById(room, speakerRole)
  const iSpeak = mr.owns(speakerRole)
  const playerName = mr.players[mr.playerUids.find((u) => (mr.roleInfo.includes[mr.players[u]?.role] ?? []).includes(speakerRole))]?.name
  const myGuess = b.guesses?.[turn]?.[mr.uid]
  const cracked = !!b.cracked?.[speakerRole]
  const guess = (p) =>
    mr.actions.updateBoard((x) => {
      if (x.guesses?.[turn]?.[mr.uid]) return x
      const ok = p === cur.principle
      return { ...x, guesses: { ...(x.guesses ?? {}), [turn]: { ...(x.guesses?.[turn] ?? {}), [mr.uid]: p } }, cracked: ok ? { ...(x.cracked ?? {}), [speakerRole]: true } : x.cracked ?? {} }
    })

  return (
    <div className="mr-puzzle">
      <div className="mr-talk">
        <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
          <span className="mr-talk-kicker">말하기 시간 · {turn + 1}/{turns.length}번째 변론</span>
          <span className={`mr-talk-timer ${remain <= 10 ? 'warn' : ''}`}>{fmtTime(remain)}</span>
        </div>
        <div className="mr-talk-speaker">{speaker?.name} <span className="dim" style={{ fontSize: 14 }}>{speaker?.job}{playerName ? ` · ${playerName} 맡음` : ''}</span></div>
        {iSpeak ? (
          <>
            <p className="dim" style={{ margin: 0 }}>당신 차례입니다. 아래 변론을 고개를 들고 말한 뒤, 친구들의 질문에 답하세요.</p>
            <div className="mr-talk-line">“{cur.line}”</div>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>{speaker?.name}의 변론을 듣고, 아래 질문으로 반박해 보세요.</p>
            <div className="col" style={{ gap: 6, width: '100%' }}>
              {cur.questions.map((qq, i) => <div key={i} className="mr-suggest"><span className="mr-tag blue">추천 질문</span> {qq}</div>)}
            </div>
          </>
        )}
        {passed >= speak && (
          <button className="mr-small" onClick={() => advance(turn)}>다음 차례로 →</button>
        )}
      </div>

      {!iSpeak && (
        <div className="mr-mat">
          <div className="mr-mat-title"><span className="row" style={{ gap: 6 }}><Icon name="eye" size={12} />원리 간파: {speaker?.name}이(가) 기대는 원리는?</span>{cracked && <span className="mr-tag">간파 성공</span>}</div>
          {cracked ? (
            <p>간파 성공! <strong>{cur.principle}</strong>. 아래에 결정적 증거가 열렸습니다.</p>
          ) : myGuess ? (
            <p className="dim">‘{myGuess}’(으)로 답했습니다. 아쉽게도 아니에요. 다른 친구의 간파를 기다리세요.</p>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              {config.principles.map((p) => <button key={p} className="mr-small" onClick={() => guess(p)}>{p}</button>)}
            </div>
          )}
          <span className="dim" style={{ fontSize: 11 }}>한 사람에 한 번씩 답할 수 있어요. 추천 질문이 어떤 관점에서 묻고 있는지 생각해 보세요.</span>
        </div>
      )}
      {evidence}
    </div>
  )
}

function Interject({ config, evidence }) {
  const { mr } = useMr()
  const [msg, setMsg] = useState(null)
  const pick = async (id) => {
    if (id === config.answerId) {
      await mr.actions.updateBoard((x) => ({ ...x, interject: 'done', turnAt: Date.now() }))
    } else {
      mr.actions.recordFail()
      setMsg(config.wrongLine ?? '길잡이: “그 증거로는 제 말을 반박할 수 없어요.”')
    }
  }
  return (
    <div className="mr-puzzle">
      <div className="mr-talk" style={{ borderColor: 'rgba(94,145,224,0.6)' }}>
        <div className="mr-talk-kicker">돌발 · 길잡이의 증언</div>
        <div className="mr-voice" style={{ width: '100%' }}><div className="mr-voice-who">길잡이</div>{config.line}</div>
        <p style={{ margin: 0 }}>{config.prompt ?? '이 증언을 깨뜨릴 증거를 골라 주세요.'}</p>
        <div className="col" style={{ gap: 6, width: '100%' }}>
          {config.options.map((o) => <button key={o.id} className="mr-choice" onClick={() => pick(o.id)}>{o.text}</button>)}
        </div>
        {msg && <div className="mr-feedback" style={{ padding: 8, fontSize: 13 }}>{msg}</div>}
      </div>
      {evidence}
    </div>
  )
}

// ---------------- 책임 지도 ----------------
export function BlamePuzzle({ config }) {
  const { mr } = useMr()
  const ratings = mr.board.ratings ?? {}
  const mine = ratings[mr.uid] ?? {}
  const [reason, setReason] = useState(mr.board.reason ?? '')
  useEffect(() => setReason(mr.board.reason ?? ''), [mr.board.reason])
  const talkLeft = Math.max(0, (config.talkSeconds ?? 120) - Math.floor((mr.now - (mr.state.sceneAt ?? mr.now)) / 1000))
  const rate = (id, n) => mr.actions.updateBoard((b) => ({ ...b, ratings: { ...(b.ratings ?? {}), [mr.uid]: { ...(b.ratings?.[mr.uid] ?? {}), [id]: n } } }))
  const avg = (id) => {
    const v = Object.values(ratings).map((r) => r?.[id]).filter((x) => x != null)
    return v.length ? (v.reduce((a, c) => a + c, 0) / v.length).toFixed(1) : '-'
  }
  return (
    <div className="mr-puzzle">
      <div className="mr-talk" style={{ padding: '10px 14px' }}>
        <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
          <span className="mr-talk-kicker">말하기 시간 · 책임 지도</span>
          <span className={`mr-talk-timer ${talkLeft <= 15 ? 'warn' : ''}`}>{fmtTime(talkLeft)}</span>
        </div>
        <p style={{ margin: 0 }}>{config.prompt}</p>
      </div>
      <table className="mr-table">
        <thead><tr><th>인물</th><th>내 판단 (책임 0~3)</th><th>모둠 평균</th></tr></thead>
        <tbody>
          {config.targets.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>
                <div className="row" style={{ gap: 4 }}>
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} className={`mr-small ${mine[t.id] === n ? 'mr-selected' : ''}`} onClick={() => rate(t.id, n)}>{n === 0 ? '없음' : '★'.repeat(n)}</button>
                  ))}
                </div>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{avg(t.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="col" style={{ gap: 6 }}>
        <strong style={{ fontSize: 13 }}>모둠이 정한 가장 큰 책임자</strong>
        <div className="row" style={{ gap: 6 }}>
          {config.targets.map((t) => (
            <button key={t.id} className={`mr-small ${mr.board.pick === t.id ? 'mr-selected' : ''}`} onClick={() => mr.actions.updateBoard((b) => ({ ...b, pick: t.id }))}>{t.name}</button>
          ))}
        </div>
        <textarea rows={2} maxLength={160} value={reason} placeholder={`그렇게 생각한 근거 (${config.minReason ?? 10}자 이상)`} onChange={(e) => setReason(e.target.value)} />
        <button className="mr-small" style={{ alignSelf: 'flex-start' }} disabled={reason.trim() === (mr.board.reason ?? '')} onClick={() => mr.actions.updateBoard((b) => ({ ...b, reason: reason.trim() }))}>근거 저장</button>
      </div>
    </div>
  )
}

// ---------------- 해결안 고르기 ----------------
export function SelectPuzzle({ config }) {
  const { mr } = useMr()
  const picks = mr.board.picks ?? []
  const max = config.pick ?? 2
  const toggle = (id) =>
    mr.actions.updateBoard((b) => {
      const cur = b.picks ?? []
      if (cur.includes(id)) return { ...b, picks: cur.filter((x) => x !== id) }
      if (cur.length >= max) return b
      return { ...b, picks: [...cur, id] }
    })
  return (
    <div className="mr-puzzle">
      <span className="dim" style={{ fontSize: 12 }}>{config.prompt ?? `해결안을 ${max}개 고르세요.`} ({picks.length}/{max})</span>
      <div className="mr-qgrid">
        {config.options.map((o) => (
          <button key={o.id} className={`mr-qcard ${picks.includes(o.id) ? 'picked' : ''}`} onClick={() => toggle(o.id)}>
            {o.stage && <span className="mr-tag blue" style={{ marginBottom: 4, display: 'inline-block' }}>{o.stage}</span>}
            <div>{o.text}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// 제출 버튼을 열어도 되는지 (빈 제출로 실패가 쌓이지 않게)
export const HEARING_READY = {
  tanmun: (c, b) => Object.keys(b.found ?? {}).length >= (c.need ?? 3),
  clueboard: (c, b) => (c.need ?? []).every((id) => b.solved?.[id] || (!c.cards.find((x) => x.id === id)?.lock && b.opened?.[id])),
  hearing: (c, b) => (b.turn ?? 0) >= c.turns.length && (!c.interject || b.interject === 'done'),
  blame: (c, b) => !!b.pick && String(b.reason ?? '').trim().length >= (c.minReason ?? 10) && Object.keys(b.ratings ?? {}).length > 0,
  select: (c, b) => (b.picks ?? []).length === (c.pick ?? 2),
}
