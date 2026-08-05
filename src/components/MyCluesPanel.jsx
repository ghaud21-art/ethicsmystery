import { isClueVisibleTo } from '../engine/visibility.js'

// 단계를 넘어가도 지금까지 내가 확보/열람 가능했던 모든 단서(phase1+phase2)를 모아 보여준다.
export default function MyCluesPanel({ scenario, room, uid, myCharacterId }) {
  const allClues = [...scenario.clues.phase1.items, ...scenario.clues.phase2.items]
  const clueStates = room.clues ?? {}
  const playerCount = room.meta?.playerCount
  const mine = allClues.filter((clue) => isClueVisibleTo(clue, clueStates[clue.id], uid, myCharacterId, scenario, playerCount))

  if (mine.length === 0) {
    return <p className="dim" style={{ fontSize: 13, margin: 0 }}>아직 확보한 단서가 없습니다.</p>
  }

  return (
    <div className="col" style={{ maxHeight: 420, overflowY: 'auto' }}>
      {mine.map((clue) => (
        <div key={clue.id} className="card" style={{ marginBottom: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 13 }}>{clue.title}</strong>
            {clue.isCriticalClue && <span className="pill pill-solid">핵심 단서</span>}
          </div>
          <p className="dim" style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6 }}>{clue.content}</p>
        </div>
      ))}
    </div>
  )
}
