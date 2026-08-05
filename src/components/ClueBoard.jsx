import ClueCard from './ClueCard.jsx'
import { isClueVisibleTo } from '../engine/visibility.js'
import { isComboReady } from '../engine/apEngine.js'

export default function ClueBoard({ scenario, phase, room, uid, myCharacterId, onClaim, onPublish }) {
  const clueStates = room.clues ?? {}
  // owner는 "이 단서가 누구에 관한 것인가"다 — 다른 캐릭터를 조사하는 용도이므로
  // 내 캐릭터 소유 단서는 목록에서 숨긴다(내가 나를 조사할 수 없으니까). 다만 다른
  // 누군가가 그걸 캐물어 공개했다면, 나에 대해 뭐가 밝혀졌는지 볼 수 있어야 한다.
  const items = scenario.clues[phase].items.filter(
    (c) => !c.owner || c.owner !== myCharacterId || clueStates[c.id]?.publishedToRoom,
  )
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
