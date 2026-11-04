import { createContext, useContext, useState } from 'react'
import { roleById } from '../roles'

export const MrContext = createContext(null)
export const useMr = () => useContext(MrContext)

// ---- SVG 아이콘 (이모지 대신) ----
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
export function Icon({ name, size = 14 }) {
  const paths = {
    lens: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8 11h6M11 8v6" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 16 0v1" /></>,
    check: <path d="M5 12l5 5L20 7" />,
    note: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4M8 12h8M8 16h6" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3M16 7l3 3" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    door: <><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" /><path d="M3 21h18M15 12h.01" /></>,
    bulb: <><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden="true" style={{ flex: 'none' }}>
      {paths[name]}
    </svg>
  )
}

// 자료·카드의 주인을 사람에게 보이는 이름으로 (통합된 역할이면 맡은 사람의 역할)
export function ownerLabel(room, roleInfo, owner) {
  if (!owner) return '공용'
  const active = roleInfo.ownerOf[owner] ?? owner
  return roleById(room, active)?.name ?? owner
}

export function MaterialTable({ m }) {
  return (
    <table className="mr-table">
      <thead>
        <tr>{m.columns.map((c) => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {m.rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

// 관점 렌즈: 내 역할에 렌즈가 있으면 '깊이 보기', 공유되면 모두에게 보인다.
export function LensBlock({ lens, keyPrefix }) {
  const { room, mr } = useMr()
  const [open, setOpen] = useState({})
  if (!lens) return null
  const entries = Object.entries(lens)
  return (
    <>
      {entries.map(([rid, l]) => {
        const key = `${keyPrefix}:${rid}`
        const mine = mr.owns(rid)
        const isShared = !!mr.shared[key]
        const holder = ownerLabel(room, mr.roleInfo, rid) // 이 렌즈를 가진 플레이어의 역할
        const who = roleById(room, rid)?.name // 렌즈의 시선 주인(등장인물)
        const job = roleById(room, rid)?.job
        if (isShared || (mine && open[rid])) {
          return (
            <div key={rid} className="mr-lens">
              <div className="mr-lens-who">{who}({job})의 시선{isShared ? ' · 팀 공유됨' : ' · 나만 보는 중'}</div>
              {l.text}
              {mine && !isShared && !mr.solo && (
                <div style={{ marginTop: 6 }}>
                  <button
                    className="mr-small"
                    onClick={() => {
                      mr.actions.share(key)
                      mr.actions.learnConcept(l.concept)
                    }}
                  >
                    <span className="row" style={{ gap: 4 }}><Icon name="share" size={12} />팀에 공유</span>
                  </button>
                </div>
              )}
            </div>
          )
        }
        if (mine) {
          return (
            <div key={rid} style={{ marginTop: 8 }}>
              <button
                className="mr-small"
                onClick={() => {
                  setOpen((o) => ({ ...o, [rid]: true }))
                  if (mr.solo) mr.actions.learnConcept(l.concept)
                }}
              >
                <span className="row" style={{ gap: 4 }}><Icon name="lens" size={12} />깊이 보기 ({job})</span>
              </button>
            </div>
          )
        }
        return (
          <div key={rid} className="mr-lens-hint">
            <Icon name="lens" size={11} />{holder}에게만 더 보이는 것이 있어요. 물어보세요.
          </div>
        )
      })}
    </>
  )
}

export function NoteCard({ block, keyPrefix }) {
  return (
    <div className="mr-note">
      <div className="mr-note-cap"><Icon name="note" size={12} />{block.note}</div>
      {block.lines.map((l, i) => <p key={i}>{l}</p>)}
      <LensBlock lens={block.lens} keyPrefix={keyPrefix} />
    </div>
  )
}

// 자료 하나: 볼 수 있으면 내용, 아니면 뒷면. 주인은 공유 버튼.
export function MaterialCard({ id, compact }) {
  const { room, mr } = useMr()
  const m = room.materials[id]
  const key = `m:${id}`
  const visible = mr.canSee(m.owner, key)
  const isShared = !!mr.shared[key]
  const mine = mr.owns(m.owner)
  return (
    <div className="mr-mat">
      <div className="mr-mat-title">
        <span>{m.title}</span>
        <span className="row" style={{ gap: 4 }}>
          {isShared ? <span className="mr-tag">공유됨</span> : <span className="mr-tag blue">{ownerLabel(room, mr.roleInfo, m.owner)}</span>}
        </span>
      </div>
      {visible ? (
        m.kind === 'table' ? <MaterialTable m={m} /> : <p>{m.text}</p>
      ) : (
        <p className="dim" style={{ fontStyle: 'italic' }}>{ownerLabel(room, mr.roleInfo, m.owner)}만 볼 수 있는 자료입니다. 읽어 달라고 하거나 공유를 부탁하세요.</p>
      )}
      {visible && <LensBlock lens={m.lens} keyPrefix={`ml:${id}`} />}
      {mine && !isShared && !compact && !mr.solo && (
        <div style={{ marginTop: 8 }}>
          <button className="mr-small" onClick={() => mr.actions.share(key)}>
            <span className="row" style={{ gap: 4 }}><Icon name="share" size={12} />팀에 공유</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PlayerDots({ map, label }) {
  const { mr } = useMr()
  const n = mr.playerUids.filter((u) => map?.[u]).length
  return (
    <div className="mr-status">
      {mr.playerUids.map((u) => (
        <span key={u} title={mr.players[u]?.name} className={`mr-dot ${map?.[u] ? 'on' : ''}`} />
      ))}
      <span>{label} {n}/{mr.playerUids.length}</span>
    </div>
  )
}
