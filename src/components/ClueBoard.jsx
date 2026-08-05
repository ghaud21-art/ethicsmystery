import ClueCard from './ClueCard.jsx'
import { isClueVisibleTo } from '../engine/visibility.js'
import { isComboReady } from '../engine/apEngine.js'

export default function ClueBoard({ scenario, phase, room, uid, myCharacterId, onClaim, onPublish }) {
  // 다른 캐릭터 소유의 단서는 애초에 내 조사판에 표시하지 않는다(그 캐릭터를 맡은
  // 플레이어의 개인 조사 대상이기 때문 — 공용 단서와 조합형 단서만 모두에게 보인다).
  const items = scenario.clues[phase].items.filter((c) => !c.owner || c.owner === myCharacterId)
  const clueStates = room.clues ?? {}
  const myAp = room.players?.[uid]?.ap?.[phase] ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {items.map((clue) => {
        const clueState = clueStates[clue.id]
        const visible = isClueVisibleTo(clue, clueState, uid, myCharacterId)
        const comboReady = isComboReady(scenario, clue, clueStates, uid, myCharacterId)
        const canClaim = !clueState?.claimedBy && myAp >= clue.apCost && comboReady
        // 조합형 단서를 포함해, 확보한 단서는 무엇이든 본인 선택으로 공개할 수 있다.
        const canPublish = visible && clueState?.claimedBy === uid && !clueState?.publishedToRoom
        return (
          <ClueCard
            key={clue.id}
            clue={clue}
            clueState={clueState}
            visible={visible}
            canClaim={canClaim}
            comboReady={comboReady}
            canPublish={canPublish}
            onClaim={() => onClaim(clue.id)}
            onPublish={() => onPublish(clue.id)}
            players={room.players}
          />
        )
      })}
    </div>
  )
}
