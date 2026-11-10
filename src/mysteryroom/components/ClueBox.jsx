import { useState } from 'react'
import { Icon, MaterialCard, NoteCard, useMr } from './common'
import { visitedScenes } from './SceneView'

// 단서함: 어느 장면에서든 지금까지 나온 단서를 한곳에서 다시 본다.
// 얻은 단서(A·B·C), 지나온 장면의 메모 카드, 내 자료와 공유된 자료, 모둠이 뽑은 아이디어.
export default function ClueBox() {
  const { room, mr } = useMr()
  const [open, setOpen] = useState(false)
  const visited = visitedScenes(room, mr.state.history)
  const notes = []
  const seen = new Set()
  for (const id of visited) {
    ;(room.scenes[id].body ?? []).forEach((b, i) => {
      if (!b || typeof b === 'string' || !b.note) return
      const key = b.note + '|' + (b.lines ?? []).join('|')
      if (seen.has(key)) return
      seen.add(key)
      notes.push({ id, i, b })
    })
  }
  const mats = Object.keys(room.materials).filter((m) => mr.canSee(room.materials[m].owner, `m:${m}`))
  const clues = room.rooms.filter((r) => mr.state.clues?.[r.clue])
  const ideas = Object.entries(mr.state.ideaWinners ?? {})
  const count = clues.length + notes.length
  return (
    <>
      <button className="mr-small" onClick={() => setOpen(true)} title="지금까지 나온 단서를 다시 봅니다">
        <span className="row" style={{ gap: 4 }}><Icon name="note" size={13} />단서함 {count}</span>
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-panel" style={{ width: 'min(720px, 100%)', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="modal-title">단서함</span>
              <button className="mr-small" onClick={() => setOpen(false)}>닫기</button>
            </div>
            <strong style={{ fontSize: 13 }}>얻은 단서</strong>
            {clues.length ? clues.map((r) => (
              <div key={r.id} className="mr-mat"><div className="mr-mat-title"><span>단서 {r.clue} · {r.name}</span>{mr.state.clues[r.clue] === 'tainted' && <span className="mr-tag">오염됨</span>}</div><p>{room.clueNames?.[r.clue]}</p></div>
            )) : <p className="dim" style={{ fontSize: 12 }}>아직 얻은 단서가 없습니다.</p>}
            {ideas.length > 0 && (
              <>
                <strong style={{ fontSize: 13 }}>모둠이 뽑은 아이디어</strong>
                {ideas.map(([sid, w]) => <div key={sid} className="mr-mat"><div className="mr-mat-title"><span>{room.scenes[sid]?.title}</span></div>{w.map((x, i) => <p key={i}>{x}</p>)}</div>)}
              </>
            )}
            <strong style={{ fontSize: 13 }}>지금까지 나온 메모</strong>
            {notes.map(({ id, i, b }) => <NoteCard key={`${id}-${i}`} block={b} keyPrefix={`l:${id}:${i}`} />)}
            {mats.length > 0 && (
              <>
                <strong style={{ fontSize: 13 }}>볼 수 있는 자료 (내 자료 + 공유된 자료)</strong>
                {mats.map((m) => <MaterialCard key={m} id={m} />)}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
