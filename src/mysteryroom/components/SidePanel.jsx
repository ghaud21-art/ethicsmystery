import { useState } from 'react'
import { MaterialCard, NoteCard, useMr } from './common'
import { RecallBoard } from './puzzles'
import { roleById } from '../roles'

export default function SidePanel() {
  const { room, mr } = useMr()
  const [tab, setTab] = useState('role')
  const myActive = mr.me?.role
  const included = mr.roleInfo.includes[myActive] ?? []
  const myMaterials = Object.keys(room.materials).filter((id) => mr.owns(room.materials[id].owner))
  const sharedMaterials = Object.keys(room.materials).filter((id) => mr.shared[`m:${id}`] && !mr.owns(room.materials[id].owner))
  const concepts = room.concepts.filter((c) => mr.state?.concepts?.[c.k])
  const stance = (sid) => room.debate?.stances?.find((s) => s.id === sid)

  return (
    <div className="card mr-side">
      <div className="tabs">
        {[
          ['role', '내 역할'],
          ['mine', `내 자료 ${myMaterials.length}`],
          ['shared', `공유됨 ${sharedMaterials.length}`],
          ['notes', '수첩'],
          ['history', '지난 장면'],
        ].map(([k, l]) => (
          <button key={k} className={`tab-button ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'role' && (
        <div className="col">
          {included.map((rid) => {
            const r = roleById(room, rid)
            return (
              <div key={rid} className="mr-mat">
                <div className="mr-mat-title"><span>{r.name} · {r.job}</span>{rid !== myActive && <span className="mr-tag blue">함께 맡음</span>}</div>
                <p className="dim" style={{ marginBottom: 6 }}>{r.profile}</p>
                <p><strong style={{ color: 'var(--gold-light)' }}>관점</strong> {r.perspective}</p>
                {r.stance && stance(r.stance) && <p><strong style={{ color: 'var(--gold-light)' }}>토론 입장</strong> {stance(r.stance).label}</p>}
              </div>
            )
          })}
          <div className="dim" style={{ fontSize: 11, lineHeight: 1.6 }}>
            역할은 관점과 자료를 맡습니다. 숨길 비밀은 없어요. 내 자료를 읽어 주거나 공유해야 모두가 풀 수 있습니다.
          </div>
          <strong style={{ fontSize: 12, marginTop: 6 }}>모둠원</strong>
          {mr.playerUids.map((u) => {
            const p = mr.players[u]
            return (
              <div key={u} className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                <span>{p.name}{u === mr.uid ? ' (나)' : ''}</span>
                <span className="dim">{(mr.roleInfo.includes[p.role] ?? []).map((rid) => roleById(room, rid)?.name).join(', ')}</span>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'mine' && (
        <div>
          {myMaterials.length ? myMaterials.map((id) => <MaterialCard key={id} id={id} />) : <p className="dim">가진 자료가 없습니다.</p>}
          <p className="dim" style={{ fontSize: 11 }}>퍼즐 카드는 퍼즐 화면에서 공유할 수 있습니다.</p>
        </div>
      )}

      {tab === 'shared' && (
        <div>{sharedMaterials.length ? sharedMaterials.map((id) => <MaterialCard key={id} id={id} compact />) : <p className="dim">아직 공유받은 자료가 없습니다.</p>}</div>
      )}

      {tab === 'history' && <HistoryTab />}

      {tab === 'notes' && (
        <div className="col">
          <strong style={{ fontSize: 12 }}>단서 수첩</strong>
          {room.rooms.map((r) => {
            const v = mr.state?.clues?.[r.clue]
            return (
              <div key={r.id} className="mr-mat">
                <div className="mr-mat-title">
                  <span>단서 {r.clue} · {r.name}</span>
                  {v === 'clean' ? <span className="mr-tag">획득</span> : v === 'tainted' ? <span className="mr-tag" style={{ color: 'var(--blood-light)' }}>오염됨</span> : <span className="mr-tag blue">미획득</span>}
                </div>
                <p className={v ? '' : 'dim'}>{v ? room.clueNames?.[r.clue] ?? '획득' : '방의 퍼즐을 풀면 얻습니다.'}</p>
              </div>
            )
          })}
          <strong style={{ fontSize: 12, marginTop: 6 }}>개념 노트 {concepts.length}/{room.concepts.length}</strong>
          {concepts.length ? (
            concepts.map((c) => (
              <div key={c.k} className="mr-mat">
                <div className="mr-mat-title"><span>{c.name}</span></div>
                {c.lines.map((l, i) => <p key={i}>{l}</p>)}
              </div>
            ))
          ) : (
            <p className="dim" style={{ fontSize: 12 }}>장면을 지나며 개념이 쌓입니다.</p>
          )}
        </div>
      )}
    </div>
  )
}

// 지나온 장면 다시 보기: 문단·메모 카드와, 퍼즐 장면은 모둠이 놓았던 배치까지.
function HistoryTab() {
  const { room, mr } = useMr()
  const [open, setOpen] = useState(null)
  const seen = []
  for (const id of mr.state?.history ?? []) {
    if (id === mr.state.scene || seen.includes(id)) continue
    const s = room.scenes[id]
    if (!s || s.gate || s.end) continue
    seen.push(id)
  }
  const list = seen.reverse()
  if (!list.length) return <p className="dim" style={{ fontSize: 12 }}>아직 지나온 장면이 없습니다.</p>
  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="dim" style={{ fontSize: 11 }}>최근에 지나온 장면부터 보입니다. 눌러서 펼치세요.</span>
      {list.map((id) => {
        const s = room.scenes[id]
        const roomName = room.rooms.find((r) => r.id === s.room)?.name
        const isOpen = open === id
        return (
          <div key={id} className="mr-mat" style={{ padding: 8 }}>
            <div className="mr-mat-title" style={{ cursor: 'pointer', marginBottom: isOpen ? 6 : 0 }} onClick={() => setOpen(isOpen ? null : id)}>
              <span>{s.title}</span>
              <span className="mr-tag blue">{s.kicker ?? roomName ?? '장면'}</span>
            </div>
            {isOpen && (
              <div className="col" style={{ gap: 6 }}>
                {(s.body ?? []).map((b, i) =>
                  typeof b === 'string' ? (
                    <p key={i} style={{ fontSize: 12, lineHeight: 1.65 }}>{b}</p>
                  ) : b.roleCard ? null : b.material ? (
                    <MaterialCard key={i} id={b.material} compact />
                  ) : (
                    <NoteCard key={i} block={b} keyPrefix={`l:${id}:${i}`} />
                  ),
                )}
                {s.puzzle && ['classify', 'test', 'order'].includes(s.puzzle.module) && <RecallBoard sceneId={id} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
