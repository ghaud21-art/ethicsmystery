import ClueCard from './ClueCard.jsx'
import { isClueVisibleTo, isClueAutoRevealed } from '../engine/visibility.js'
import { isComboReady } from '../engine/apEngine.js'
import { getPlayableCharacters, getEffectiveCharacterId } from '../engine/characterAssignment.js'

export default function ClueBoard({ scenario, phase, room, uid, myCharacterId, onClaim, onPublish }) {
  const clueStates = room.clues ?? {}
  const playerCount = room.meta?.playerCount
  const playableCharacters = getPlayableCharacters(scenario, playerCount)
  // owner는 "이 단서가 누구에 관한 것인가"다 — 다른 캐릭터를 조사하는 용도이므로
  // 내 캐릭터 소유 단서는 목록에서 숨긴다(내가 나를 조사할 수 없으니까). 다만 다른
  // 누군가가 그걸 캐물어 공개했다면, 나에 대해 뭐가 밝혀졌는지 볼 수 있어야 한다.
  // 통합 캐릭터로 흡수된 인물의 단서는 통합 캐릭터 본인 소유로 취급해야 하므로
  // owner를 effective id로 치환해 비교한다.
  const items = scenario.clues[phase].items.filter((c) => {
    const effectiveOwner = getEffectiveCharacterId(scenario, c.owner, playerCount)
    return !c.owner || effectiveOwner !== myCharacterId || clueStates[c.id]?.publishedToRoom
  })
  const myAp = room.players?.[uid]?.ap?.[phase] ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {items.map((clue) => {
        const clueState = clueStates[clue.id]
        const autoRevealed = isClueAutoRevealed(clue, scenario, playerCount)
        const visible = isClueVisibleTo(clue, clueState, uid, myCharacterId, scenario, playerCount)
        const comboReady = isComboReady(scenario, clue, clueStates, uid, myCharacterId, playerCount)
        const canClaim = !autoRevealed && !clueState?.claimedBy && myAp >= clue.apCost && comboReady
        // 조합형 단서를 포함해, 확보한 단서는 무엇이든 본인 선택으로 공개할 수 있다.
        const canPublish = !autoRevealed && visible && clueState?.claimedBy === uid && !clueState?.publishedToRoom
        const ownerCharacter = clue.owner
          ? playableCharacters.find((c) => c.id === getEffectiveCharacterId(scenario, clue.owner, playerCount))
          : null
        return (
          <ClueCard
            key={clue.id}
            clue={clue}
            clueState={clueState}
            visible={visible}
            canClaim={canClaim}
            comboReady={comboReady}
            canPublish={canPublish}
            autoRevealed={autoRevealed}
            ownerName={ownerCharacter?.name}
            onClaim={() => onClaim(clue.id)}
            onPublish={() => onPublish(clue.id)}
            players={room.players}
          />
        )
      })}
    </div>
  )
}
