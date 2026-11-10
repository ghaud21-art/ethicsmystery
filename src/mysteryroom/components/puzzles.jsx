import { useState } from 'react'
import { Icon, MaterialCard, ownerLabel, PlayerDots, useMr } from './common'
import { HINT_AFTER_FAILS } from '../useMysteryRoom'

// ---- 카드 배치형 공통 (분류, 원리 검사, 문장 배열) ----
// 카드를 눌러 고르고, 칸을 눌러 놓는다. 앞면은 주인과 공유받은 사람만 본다.
function PlacementBoard({ cards, zones, trayLabel, frozen }) {
  const { room, mr } = useMr()
  const [sel, setSel] = useState(null)
  const placements = mr.board.placements ?? {}
  const locked = !!mr.state.feedback || !!frozen

  // zoneId가 null이면 '놓지 않은 카드' 칸으로 되돌린다.
  const place = (zoneId) => {
    if (!sel || locked) return
    const zone = zones.find((z) => z.id === zoneId)
    if (zone?.count && cards.filter((c) => placements[c.id] === zoneId && c.id !== sel).length >= zone.count) return
    mr.actions.updateBoard((b) => ({ ...b, placements: { ...(b.placements ?? {}), [sel]: zoneId } }))
    setSel(null)
  }

  const renderCard = (c) => {
    const key = `c:${c.id}`
    const visible = mr.canSee(c.owner, key)
    const mine = mr.owns(c.owner)
    const isShared = !!mr.shared[key]
    if (!visible) {
      return (
        <div key={c.id} className="mr-pcard back">
          {ownerLabel(room, mr.roleInfo, c.owner)}의 카드
          <div className="mr-pcard-meta"><span>앞면은 주인만 볼 수 있어요</span></div>
        </div>
      )
    }
    return (
      <div
        key={c.id}
        className={`mr-pcard ${sel === c.id ? 'sel' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          if (locked) return
          // 다른 카드를 고른 상태에서 칸 안의 카드를 누르면, 그 칸에 놓는다.
          if (sel && sel !== c.id) return place(placements[c.id] ?? null)
          setSel(sel === c.id ? null : c.id)
        }}
      >
        {c.text}
        <div className="mr-pcard-meta">
          <span>{mr.solo ? '' : `${ownerLabel(room, mr.roleInfo, c.owner)}의 카드${isShared ? ' · 공유됨' : ''}`}</span>
          {mine && !isShared && !mr.solo && (
            <button
              className="mr-small"
              onClick={(e) => {
                e.stopPropagation()
                mr.actions.share(key)
              }}
            >
              <span className="row" style={{ gap: 4 }}><Icon name="share" size={11} />공유</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  const unplaced = cards.filter((c) => !placements[c.id])
  return (
    <div className="mr-puzzle">
      <p className="dim" style={{ margin: 0, fontSize: 12 }}>
        {sel ? '카드를 놓을 칸을 누르세요.' : '카드를 눌러 고른 뒤, 놓을 칸을 누르세요. 칸에 놓인 카드도 다시 골라 옮길 수 있어요.'}
      </p>
      {zones.map((z) => {
        const inZone = cards.filter((c) => placements[c.id] === z.id)
        return (
          <div key={z.id} className={`mr-zone ${sel ? 'target' : ''}`} onClick={() => place(z.id)}>
            <div className="mr-zone-label">
              <span>{z.label}</span>
              {z.count ? <span className="dim">{inZone.length}/{z.count}</span> : null}
            </div>
            {z.desc && <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>{z.desc}</div>}
            <div className="mr-zone-cards">{inZone.map(renderCard)}</div>
          </div>
        )
      })}
      <div className={`mr-zone mr-tray ${sel ? 'target' : ''}`} onClick={() => place(null)}>
        <div className="mr-zone-label"><span>{trayLabel}</span><span className="dim">{unplaced.length}장</span></div>
        <div className="mr-zone-cards">{unplaced.map(renderCard)}</div>
      </div>
    </div>
  )
}

function ClassifyPuzzle({ config }) {
  return <PlacementBoard cards={config.cards} zones={config.bins.map((b) => ({ id: b.id, label: b.label, desc: b.desc }))} trayLabel="아직 분류하지 않은 카드" />
}

function Options({ options, value, onPick, disabled }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      {options.map((o) => (
        <div key={o.id} className={`mr-option ${value === o.id ? 'on' : ''}`} onClick={() => !disabled && onPick(o.id)}>
          <span className="mr-radio" />
          <span>{o.text ?? o.label}</span>
        </div>
      ))}
    </div>
  )
}

function TestPuzzle({ config }) {
  const { mr } = useMr()
  const twoStage = !!config.results
  const stage2 = !!mr.board.stage2
  return (
    <div className="mr-puzzle">
      <div className="mr-note"><div className="mr-note-cap">시험할 원리</div><p>{config.principle}</p></div>
      {twoStage && (
        <div className="mr-status">
          <span className={`mr-dot ${!stage2 ? 'on' : ''}`} />1단계 검사 질문 놓기
          <span className={`mr-dot ${stage2 ? 'on' : ''}`} style={{ marginLeft: 8 }} />2단계 검사 결과 읽고 수정 원리 고르기
        </div>
      )}
      <PlacementBoard
        cards={config.cards}
        zones={config.slots.map((s) => ({ id: s.id, label: s.label, count: 1 }))}
        trayLabel="검사에 쓰지 않는 카드 (사실 질문은 여기에)"
        frozen={stage2}
      />
      {twoStage && !stage2 && (
        <p className="dim" style={{ margin: 0, fontSize: 12 }}>세 검사 칸에 알맞은 질문을 하나씩 놓고 제출하면, 검사 결과가 공개됩니다.</p>
      )}
      {stage2 && (
        <div className="col" style={{ gap: 8 }}>
          <strong style={{ fontSize: 13 }}>검사 결과</strong>
          {config.slots.map((s) => (
            <div key={s.id} className="mr-split" style={{ marginBottom: 0 }}>
              <strong>{s.label}</strong>
              <br />
              {config.results[s.testId]}
            </div>
          ))}
        </div>
      )}
      {(!twoStage || stage2) && (
        <>
          <strong style={{ fontSize: 13 }}>{stage2 ? '세 검사 결과를 모두 견딜 수 있는 수정 원리를 고르세요' : '수정 원리를 고르세요'}</strong>
          <Options options={config.principleChoices} value={mr.board.principle} disabled={!!mr.state.feedback} onPick={(id) => mr.actions.updateBoard((b) => ({ ...b, principle: id }))} />
        </>
      )}
    </div>
  )
}

function OrderPuzzle({ config }) {
  return <PlacementBoard cards={config.cards} zones={config.slots} trayLabel={config.trayLabel ?? '발표문에 넣지 않을 문장'} />
}

function ScalePuzzle({ config }) {
  const { room, mr } = useMr()
  const [net, setNet] = useState(mr.board.net ?? '')
  return (
    <div className="mr-puzzle">
      <table className="mr-table">
        <thead>
          <tr>
            <th>이해관계자</th>
            {config.options.map((o) => <th key={o.id}>{o.label}<br /><span className="dim">만족 / 고통</span></th>)}
          </tr>
        </thead>
        <tbody>
          {config.stakeholders.map((s) => {
            const key = `c:${s.id}`
            const visible = mr.canSee(s.owner, key)
            return (
              <tr key={s.id}>
                <td>
                  {s.label}
                  <div className="dim" style={{ fontSize: 11 }}>{ownerLabel(room, mr.roleInfo, s.owner)}</div>
                  {mr.owns(s.owner) && !mr.shared[key] && !mr.solo && <button className="mr-small" onClick={() => mr.actions.share(key)}>공유</button>}
                </td>
                {config.options.map((o) => <td key={o.id}>{visible ? `${s.scores[o.id].sat} / ${s.scores[o.id].pain}` : '? / ?'}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
      <strong style={{ fontSize: 13 }}>순이익이 가장 큰 선택지</strong>
      <Options options={config.options} value={mr.board.option} disabled={!!mr.state.feedback} onPick={(id) => mr.actions.updateBoard((b) => ({ ...b, option: id }))} />
      <div className="row">
        <input type="number" value={net} onChange={(e) => setNet(e.target.value)} placeholder="순이익 값" style={{ width: 140 }} />
        <button className="mr-small" onClick={() => mr.actions.updateBoard((b) => ({ ...b, net: Number(net) }))}>값 입력</button>
        {mr.board.net !== undefined && <span className="dim" style={{ fontSize: 12 }}>입력된 값: {mr.board.net}</span>}
      </div>
    </div>
  )
}

function VerifyPuzzle({ config }) {
  const { room, mr } = useMr()
  const locked = !!mr.state.feedback
  if (config.mode === 'diagnose') {
    return (
      <div className="mr-puzzle">
        {config.tables.map((t) => <MaterialCard key={t} id={t} />)}
        <strong style={{ fontSize: 13 }}>{config.cause.label}{Array.isArray(config.cause.correctIds) ? ` (${config.cause.correctIds.length}개 고르기)` : ''}</strong>
        {Array.isArray(config.cause.correctIds) ? (
          <div className="col" style={{ gap: 6 }}>
            {config.cause.options.map((o) => {
              const on = !!mr.board.causes?.[o.id]
              const count = Object.values(mr.board.causes ?? {}).filter(Boolean).length
              return (
                <div
                  key={o.id}
                  className={`mr-option ${on ? 'on' : ''}`}
                  onClick={() => !locked && (on || count < config.cause.correctIds.length) && mr.actions.updateBoard((b) => ({ ...b, causes: { ...(b.causes ?? {}), [o.id]: !on } }))}
                >
                  <span className="mr-radio" style={{ borderRadius: 4 }} />
                  <span>{o.text}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <Options options={config.cause.options} value={mr.board.cause} disabled={locked} onPick={(id) => mr.actions.updateBoard((b) => ({ ...b, cause: id }))} />
        )}
        <strong style={{ fontSize: 13 }}>{config.remedy.label}</strong>
        <Options options={config.remedy.options} value={mr.board.remedy} disabled={locked} onPick={(id) => mr.actions.updateBoard((b) => ({ ...b, remedy: id }))} />
      </div>
    )
  }
  const picked = mr.board.picked ?? {}
  const count = Object.values(picked).filter(Boolean).length
  return (
    <div className="mr-puzzle">
      <p className="dim" style={{ margin: 0, fontSize: 12 }}>자료 {config.pickCount}개를 고르세요. ({count}/{config.pickCount})</p>
      {config.docs.map((d) => {
        const key = `c:${d.id}`
        const visible = mr.canSee(d.owner, key)
        const on = !!picked[d.id]
        return (
          <div
            key={d.id}
            className={`mr-option ${on ? 'on' : ''}`}
            onClick={() => !locked && (on || count < config.pickCount) && mr.actions.updateBoard((b) => ({ ...b, picked: { ...(b.picked ?? {}), [d.id]: !on } }))}
          >
            <span className="mr-radio" />
            <span style={{ flex: 1 }}>
              <strong>{d.title}</strong>
              <br />
              {visible ? d.summary : <span className="dim">{ownerLabel(room, mr.roleInfo, d.owner)}만 내용을 볼 수 있어요.</span>}
              {mr.owns(d.owner) && d.owner && !mr.shared[key] && !mr.solo && (
                <span style={{ display: 'block', marginTop: 4 }}>
                  <button className="mr-small" onClick={(e) => (e.stopPropagation(), mr.actions.share(key))}>공유</button>
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// 앞 퍼즐에서 모둠이 놓았던 카드 배치를 다시 보여 준다(자물쇠를 풀 때 기억을 돕는 기록).
export function RecallBoard({ sceneId }) {
  const { room, mr } = useMr()
  const pz = room.scenes[sceneId]?.puzzle
  const placements = mr.data?.boards?.[sceneId]?.placements ?? {}
  if (!pz) return null
  const c = pz.config
  const zones = pz.module === 'classify' ? c.bins.map((b) => ({ id: b.id, label: b.label })) : (c.slots ?? []).map((s) => ({ id: s.id, label: s.label }))
  const trayLabel = pz.module === 'test' ? '검사에 쓰지 않은 카드 (사실 질문)' : pz.module === 'order' ? c.trayLabel ?? '넣지 않은 문장' : null
  const rows = [...zones, ...(trayLabel ? [{ id: null, label: trayLabel }] : [])]
  return (
    <div className="mr-mat">
      <div className="mr-mat-title"><span className="row" style={{ gap: 6 }}><Icon name="note" />앞 퍼즐 기록: {room.scenes[sceneId].title}</span></div>
      {rows.map((z) => {
        const cards = c.cards.filter((card) => (placements[card.id] ?? null) === z.id)
        return (
          <div key={z.id ?? 'tray'} style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-light)' }}>{z.label}</div>
            {cards.map((card) => <div key={card.id} style={{ fontSize: 12, lineHeight: 1.6 }}>· {card.text}</div>)}
          </div>
        )
      })}
    </div>
  )
}

function LockPuzzle({ config, sceneId }) {
  const { room, mr } = useMr()
  const [value, setValue] = useState('')
  const paint = mr.board.paint ?? {}
  return (
    <div className="mr-puzzle">
      {config.recall && <RecallBoard sceneId={config.recall} />}
      {config.fragments?.map((f, i) => {
        const key = `f:${sceneId}:${i}`
        const visible = mr.canSee(f.owner, key)
        return (
          <div key={i} className="mr-mat">
            <div className="mr-mat-title"><span className="row" style={{ gap: 6 }}><Icon name="key" />{ownerLabel(room, mr.roleInfo, f.owner)}의 조각</span>{mr.shared[key] && <span className="mr-tag">공유됨</span>}</div>
            <p>{visible ? f.text : '이 조각은 주인 화면에만 보입니다. 말로 알려 달라고 하세요.'}</p>
            {mr.owns(f.owner) && !mr.shared[key] && !mr.solo && <button className="mr-small" style={{ marginTop: 6 }} onClick={() => mr.actions.share(key)}>공유</button>}
          </div>
        )
      })}
      {config.grid && (
        <div className="col" style={{ gap: 6 }}>
          <div className="mr-grid" style={{ gridTemplateColumns: `repeat(${config.grid.rows[0].bits.length}, auto)` }}>
            {config.grid.rows.map((r, ri) => {
              const key = `g:${sceneId}:${ri}`
              const visible = mr.canSee(r.owner, key)
              return r.bits.split('').map((b, ci) => {
                const cell = `${ri}-${ci}`
                if (!visible) return <span key={cell} className="mr-cell hidden" />
                return (
                  <span
                    key={cell}
                    className={`mr-cell ${paint[cell] ? 'painted' : ''}`}
                    onClick={() => mr.actions.updateBoard((bd) => ({ ...bd, paint: { ...(bd.paint ?? {}), [cell]: !paint[cell] } }))}
                  >
                    {b}
                  </span>
                )
              })
            })}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {config.grid.rows.map((r, ri) => {
              const key = `g:${sceneId}:${ri}`
              if (!mr.owns(r.owner) || mr.shared[key] || mr.solo) return null
              return <button key={ri} className="mr-small" onClick={() => mr.actions.share(key)}>내 {ri + 1}번째 줄 공유</button>
            })}
          </div>
          <p className="dim" style={{ margin: 0, fontSize: 11 }}>점선 줄은 다른 사람의 줄입니다. 칸을 누르면 칠해지고, 모두의 화면에 함께 보입니다.</p>
        </div>
      )}
      <div className="row">
        <input
          className="mr-lock-input"
          value={value}
          inputMode={config.input === 'number' ? 'numeric' : 'text'}
          maxLength={config.length ?? 12}
          placeholder={config.prompt}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="mr-small" disabled={!value.trim() || !!mr.state.feedback} onClick={() => mr.actions.updateBoard((b) => ({ ...b, value: value.trim() }))}>
          자물쇠에 입력
        </button>
      </div>
      {mr.board.value && <div className="dim" style={{ fontSize: 12 }}>자물쇠에 입력된 값: <strong style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>{mr.board.value}</strong></div>}
    </div>
  )
}

// 아이디어 방: 각자 한 줄 아이디어 → 모두 내면 공개 → 가장 기발한 것에 한 표씩
function IdeaPuzzle({ config }) {
  const { mr } = useMr()
  const ideas = mr.board.ideas ?? {}
  const votes = mr.board.votes ?? {}
  const mine = ideas[mr.uid]?.text ?? ''
  const [text, setText] = useState(mine)
  const max = config.maxChars ?? 80
  const min = config.minChars ?? 5
  const allIn = mr.playerUids.every((u) => (ideas[u]?.text ?? '').trim().length >= min)
  const submitted = Object.fromEntries(mr.playerUids.map((u) => [u, (ideas[u]?.text ?? '').trim().length >= min]))
  const voted = Object.fromEntries(mr.playerUids.map((u) => [u, !!votes[u]]))
  const locked = !!mr.state.feedback
  return (
    <div className="mr-puzzle">
      <div className="mr-note">
        <div className="mr-note-cap"><Icon name="bulb" size={12} />아이디어 미션</div>
        <p style={{ fontSize: 15 }}>{config.prompt}</p>
        {config.example && <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>예: {config.example}</p>}
      </div>
      <div className="col" style={{ gap: 6 }}>
        <textarea rows={2} maxLength={max} value={text} placeholder={`한 줄로, ${max}자 이내`} disabled={locked} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <button
            className="mr-small"
            disabled={locked || text.trim().length < min || text.trim() === mine}
            onClick={() => mr.actions.updateBoard((b) => ({ ...b, ideas: { ...(b.ideas ?? {}), [mr.uid]: { text: text.trim(), name: mr.me?.name ?? '' } }, votes: mr.solo ? { [mr.uid]: mr.uid } : {} }))}
          >
            {mine ? '아이디어 고치기' : '아이디어 내기'}
          </button>
          <span className="dim" style={{ fontSize: 11 }}>{text.trim().length}/{max}자 · 고치면 투표가 처음부터 다시 시작됩니다.</span>
        </div>
      </div>
      {!mr.solo && !allIn && <PlayerDots map={submitted} label="아이디어 낸 사람" />}
      {!mr.solo && !allIn && <span className="dim" style={{ fontSize: 12 }}>모두 아이디어를 내면 한꺼번에 공개됩니다.</span>}
      {allIn && (
        <div className="col" style={{ gap: 6 }}>
          <strong style={{ fontSize: 13 }}>{mr.solo ? '내 아이디어' : '가장 기발한 아이디어에 한 표! (내 것에는 투표할 수 없어요)'}</strong>
          {mr.playerUids.map((u) => {
            const on = votes[mr.uid] === u
            const self = u === mr.uid && !mr.solo
            const n = Object.values(votes).filter((v) => v === u).length
            return (
              <div
                key={u}
                className={`mr-option ${on ? 'on' : ''}`}
                style={{ cursor: self || locked ? 'default' : 'pointer', opacity: self ? 0.7 : 1 }}
                onClick={() => !self && !locked && mr.actions.updateBoard((b) => ({ ...b, votes: { ...(b.votes ?? {}), [mr.uid]: u } }))}
              >
                <span className="mr-radio" />
                <span style={{ flex: 1 }}>
                  {ideas[u].text}
                  <span className="dim" style={{ display: 'block', fontSize: 11 }}>{ideas[u].name}{self ? ' (나)' : ''}</span>
                </span>
                {Object.keys(votes).length === mr.playerUids.length && <span className="mr-tag">{n}표</span>}
              </div>
            )
          })}
          {!mr.solo && <PlayerDots map={voted} label="투표한 사람" />}
        </div>
      )}
    </div>
  )
}

// 협력 퀴즈: 문제는 모두에게, 풀이에 필요한 단서는 문제마다 한 사람에게만 보인다.
function QuizPuzzle({ config, sceneId }) {
  const { room, mr } = useMr()
  const answers = mr.board.answers ?? {}
  const locked = !!mr.state.feedback
  const [texts, setTexts] = useState({})
  const setAnswer = (qid, v) => mr.actions.updateBoard((b) => ({ ...b, answers: { ...(b.answers ?? {}), [qid]: v } }))
  return (
    <div className="mr-puzzle">
      {config.intro && <p className="dim" style={{ margin: 0, fontSize: 12 }}>{config.intro}</p>}
      {config.questions.map((q, i) => {
        const key = `q:${sceneId}:${q.id}`
        const clueVisible = q.clue && mr.canSee(q.clue.owner, key)
        return (
          <div key={q.id} className="mr-mat" style={{ padding: 12 }}>
            <div className="mr-mat-title">
              <span>{i + 1}. {q.q}</span>
              {q.area && <span className={`mr-tag ${q.area.includes('AI') ? 'blue' : ''}`}>{q.area}</span>}
            </div>
            {q.clue && (
              clueVisible ? (
                <div className="mr-lens" style={{ marginTop: 4 }}>
                  <div className="mr-lens-who">{ownerLabel(room, mr.roleInfo, q.clue.owner)}의 단서{mr.shared[key] ? ' · 팀 공유됨' : ''}</div>
                  {q.clue.text}
                  {mr.owns(q.clue.owner) && !mr.shared[key] && !mr.solo && (
                    <div style={{ marginTop: 6 }}><button className="mr-small" onClick={() => mr.actions.share(key)}><span className="row" style={{ gap: 4 }}><Icon name="share" size={11} />팀에 공유</span></button></div>
                  )}
                </div>
              ) : (
                <div className="mr-lens-hint"><Icon name="lens" size={11} />풀이에 필요한 단서가 {ownerLabel(room, mr.roleInfo, q.clue.owner)}의 화면에 있어요. 물어보세요.</div>
              )
            )}
            <div style={{ marginTop: 8 }}>
              {q.options ? (
                <div className="col" style={{ gap: 6 }}>
                  {q.options.map((o) => (
                    <div key={o.id} className={`mr-option ${answers[q.id] === o.id ? 'on' : ''}`} style={{ padding: '8px 10px' }} onClick={() => !locked && setAnswer(q.id, o.id)}>
                      <span className="mr-radio" />
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="row">
                  <input value={texts[q.id] ?? answers[q.id] ?? ''} placeholder={q.placeholder ?? '답 입력'} disabled={locked} onChange={(e) => setTexts((t) => ({ ...t, [q.id]: e.target.value }))} />
                  <button className="mr-small" disabled={locked || !(texts[q.id] ?? '').trim()} onClick={() => setAnswer(q.id, texts[q.id].trim())}>답 적기</button>
                  {answers[q.id] && <span className="dim" style={{ fontSize: 12 }}>적은 답: {answers[q.id]}</span>}
                </div>
              )}
            </div>
          </div>
        )
      })}
      <span className="dim" style={{ fontSize: 11 }}>
        답한 문제 {config.questions.filter((q) => answers[q.id]).length}/{config.questions.length} · 모든 문제를 맞혀야 문이 열립니다. 누구나 답을 고를 수 있어요.
      </span>
    </div>
  )
}

const MODULES = {
  quiz: QuizPuzzle, classify: ClassifyPuzzle, test: TestPuzzle, order: OrderPuzzle, scale: ScalePuzzle, verify: VerifyPuzzle, lock: LockPuzzle, idea: IdeaPuzzle }

// '문제를 해결했습니다!' 창: 얻은 단서와(아이디어 방이면) 뽑힌 아이디어를 보여 준다.
function SolvedModal({ puzzle }) {
  const { room, mr } = useMr()
  const ps = mr.state.pendingSolve
  const clueName = puzzle.clue ? room.clueNames?.[puzzle.clue] : null
  const learned = (puzzle.learn ?? []).map((k) => room.concepts.find((c) => c.k === k)?.name).filter(Boolean)
  return (
    <div className="modal-overlay" style={{ zIndex: 50 }}>
      <div className="modal-panel col" style={{ gap: 12, textAlign: 'center', maxWidth: 440 }}>
        <div style={{ color: 'var(--gold)', display: 'flex', justifyContent: 'center' }}><Icon name="key" size={40} /></div>
        <div className="mr-ending-grade" style={{ fontSize: 26 }}>문제를 해결했습니다!</div>
        {puzzle.solvedLine && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{puzzle.solvedLine}</p>}
        {ps.winner && (
          <div className="mr-mat" style={{ textAlign: 'left' }}>
            <div className="mr-mat-title"><span>모둠이 뽑은 아이디어</span></div>
            {ps.winner.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}
        {clueName && (
          <div className="mr-mat" style={{ textAlign: 'left' }}>
            <div className="mr-mat-title"><span>단서 {puzzle.clue} 획득</span></div>
            <p>{clueName}</p>
          </div>
        )}
        {puzzle.module === 'quiz' && puzzle.config.questions.some((q) => q.explain) && (
          <div className="mr-mat" style={{ textAlign: 'left', maxHeight: 260, overflowY: 'auto' }}>
            <div className="mr-mat-title"><span>정답 풀이</span></div>
            {puzzle.config.questions.map((q, i) => q.explain && <p key={q.id} style={{ marginBottom: 6 }}><strong>{i + 1}.</strong> {q.explain}</p>)}
          </div>
        )}
        {learned.length > 0 && <p className="dim" style={{ margin: 0, fontSize: 12 }}>개념 노트에 추가: {learned.join(', ')}</p>}
        <button className="primary" onClick={mr.actions.confirmSolve}>계속 →</button>
        {!mr.solo && <span className="dim" style={{ fontSize: 11 }}>누구든 누르면 모두 다음 장면으로 넘어갑니다.</span>}
      </div>
    </div>
  )
}

export function PuzzleArea({ sceneId, puzzle }) {
  const { mr } = useMr()
  const Comp = MODULES[puzzle.module]
  const rev = mr.board.rev ?? 0
  const agreedNow = Object.fromEntries(mr.playerUids.map((u) => [u, mr.agreeMap[u] === rev]))
  const iAgreed = agreedNow[mr.uid]
  const fails = mr.state.attempts?.[sceneId] ?? 0
  const hintOpen = !!mr.state.hintsUsed?.[sceneId]
  const fb = mr.state.feedback
  const tainted = mr.state.pendingSolve?.scene === sceneId && mr.state.pendingSolve.tainted
  const solved = mr.state.pendingSolve?.scene === sceneId && !mr.state.pendingSolve.tainted
  // 원리 검사 2단계에서는 수정 원리를 골라야 제출할 수 있다.
  const quizReady = puzzle.module !== 'quiz' || puzzle.config.questions.every((q) => mr.board.answers?.[q.id])
  const ideaReady = !quizReady ? false : puzzle.module !== 'idea' || mr.playerUids.every((u) => mr.board.votes?.[u] && mr.board.ideas?.[u])
  const empty = rev === 0 || !ideaReady || (puzzle.module === 'test' && mr.board.stage2 && !mr.board.principle)

  return (
    <div className="col" style={{ gap: 12 }}>
      <Comp config={puzzle.config} sceneId={sceneId} />

      {puzzle.hints?.length > 0 && (fails >= HINT_AFTER_FAILS || mr.state.hintsUnlocked?.[sceneId]) && (
        hintOpen ? (
          <div className="mr-hint">
            <div className="row" style={{ gap: 6, marginBottom: 4 }}><Icon name="bulb" /><strong>힌트</strong></div>
            {puzzle.hints.map((h, i) => <div key={i}>{h}</div>)}
          </div>
        ) : (
          <button className="mr-small" style={{ alignSelf: 'flex-start' }} onClick={mr.actions.openHint}>
            <span className="row" style={{ gap: 4 }}><Icon name="bulb" size={12} />힌트 보기 (기록됩니다)</span>
          </button>
        )
      )}

      {solved && <SolvedModal puzzle={puzzle} />}
      {solved ? null : tainted ? (
        <div className="mr-feedback">
          <div className="mr-feedback-line">문이 열렸지만 경고등이 켜졌다.</div>
          <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.6 }}>{puzzle.taintLine ?? '고른 자료가 한쪽에 치우쳤거나 출처가 불분명하다.'} 이 단서는 ‘오염된 단서’로 기록된다. {mr.state.pendingSolve.why}</p>
          <button onClick={mr.actions.confirmTainted}>그래도 진행한다</button>
        </div>
      ) : fb && fb.scene === sceneId ? (
        <div className="mr-feedback">
          {fb.line && <div className="mr-feedback-line">{fb.line}</div>}
          <div style={{ fontSize: 13, marginBottom: 6 }}>{fb.total} 중 {fb.hits} 맞음</div>
          {fb.why && <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.6 }}>{fb.why}</p>}
          <button onClick={mr.actions.dismissFeedback}>다시 도전</button>
        </div>
      ) : (
        <div className="mr-submit">
          <PlayerDots map={agreedNow} label="제출 동의" />
          <div className="row">
            {iAgreed ? (
              <button className="mr-ghost" onClick={mr.actions.unagree}>동의 취소</button>
            ) : (
              <button className="primary" disabled={empty} onClick={mr.actions.agree}>
                {mr.playerUids.length > 1 ? '이대로 제출에 동의' : '제출'}
              </button>
            )}
            <span className="dim" style={{ fontSize: 11 }}>모두 동의하면 제출됩니다. 누가 보드를 바꾸면 동의가 풀립니다.</span>
          </div>
        </div>
      )}
    </div>
  )
}
