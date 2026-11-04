import { useState } from 'react'
import { Icon, MaterialCard, ownerLabel, PlayerDots, useMr } from './common'
import { HINT_AFTER_FAILS } from '../useMysteryRoom'

// ---- 카드 배치형 공통 (분류, 원리 검사, 문장 배열) ----
// 카드를 눌러 고르고, 칸을 눌러 놓는다. 앞면은 주인과 공유받은 사람만 본다.
function PlacementBoard({ cards, zones, trayLabel }) {
  const { room, mr } = useMr()
  const [sel, setSel] = useState(null)
  const placements = mr.board.placements ?? {}
  const locked = !!mr.state.feedback

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
  return (
    <div className="mr-puzzle">
      <div className="mr-note"><div className="mr-note-cap">시험할 원리</div><p>{config.principle}</p></div>
      <PlacementBoard cards={config.cards} zones={config.slots.map((s) => ({ id: s.id, label: s.label, count: 1 }))} trayLabel="검사에 쓰지 않는 카드 (사실 질문은 여기에)" />
      <strong style={{ fontSize: 13 }}>수정 원리를 고르세요</strong>
      <Options options={config.principleChoices} value={mr.board.principle} disabled={!!mr.state.feedback} onPick={(id) => mr.actions.updateBoard((b) => ({ ...b, principle: id }))} />
    </div>
  )
}

function OrderPuzzle({ config }) {
  return <PlacementBoard cards={config.cards} zones={config.slots} trayLabel="발표문에 넣지 않을 문장" />
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
        <strong style={{ fontSize: 13 }}>{config.cause.label}</strong>
        <Options options={config.cause.options} value={mr.board.cause} disabled={locked} onPick={(id) => mr.actions.updateBoard((b) => ({ ...b, cause: id }))} />
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

function LockPuzzle({ config, sceneId }) {
  const { room, mr } = useMr()
  const [value, setValue] = useState('')
  const paint = mr.board.paint ?? {}
  return (
    <div className="mr-puzzle">
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

const MODULES = { classify: ClassifyPuzzle, test: TestPuzzle, order: OrderPuzzle, scale: ScalePuzzle, verify: VerifyPuzzle, lock: LockPuzzle }

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
  const empty = rev === 0

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

      {tainted ? (
        <div className="mr-feedback">
          <div className="mr-feedback-line">문이 열렸지만 경고등이 켜졌다.</div>
          <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.6 }}>고른 자료가 한쪽에 치우쳤거나 출처가 불분명하다. 이 단서는 ‘오염된 단서’로 기록된다. {mr.state.pendingSolve.why}</p>
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
