import ClueCard from './ClueCard.jsx'
import { isClueVisibleTo, isClueAutoRevealed } from '../engine/visibility.js'
import { isComboReady, getApFieldName } from '../engine/apEngine.js'
import { getPlayableCharacters, getEffectiveCharacterId } from '../engine/characterAssignment.js'

export default function ClueBoard({ scenario, phase, room, uid, myCharacterId, onClaim, onPublish }) {
  const clueStates = room.clues ?? {}
  const playerCount = room.meta?.playerCount
  const playableCharacters = getPlayableCharacters(scenario, playerCount)
  const phaseDef = scenario.clues[phase]
  // owner는 "이 단서가 누구에 관한 것인가"다 — 다른 캐릭터를 조사하는 용도이므로
  // 내 캐릭터 소유 단서는 기본적으로 목록에서 숨긴다(내가 나를 조사할 수 없으니까).
  // 다만 (a) 다른 누군가가 그걸 캐물어 공개했거나, (b) 이 시나리오가 "소유자
  // 본인의 자발적 공개"를 허용하는 경우(phaseDef.ownerCanSelfReveal 또는
  // clue.revealPolicy==='ownerOnly')에는 본인에게도 보여야 스스로 공개할 수 있다.
  // 통합 캐릭터로 흡수된 인물의 단서는 통합 캐릭터 본인 소유로 취급해야 하므로
  // owner를 effective id로 치환해 비교한다.
  const items = scenario.clues[phase].items.filter((c) => {
    const effectiveOwner = getEffectiveCharacterId(scenario, c.owner, playerCount)
    const isMine = c.owner && effectiveOwner === myCharacterId
    if (!isMine) return true
    if (phaseDef?.ownerCanSelfReveal || c.revealPolicy === 'ownerOnly') return true
    return !!clueStates[c.id]?.publishedToRoom
  })
  const myAp = room.players?.[uid]?.ap?.[getApFieldName(scenario, phase)] ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {items.map((clue) => {
        const clueState = clueStates[clue.id]
        const autoRevealed = isClueAutoRevealed(clue, scenario, playerCount)
        const visible = isClueVisibleTo(clue, clueState, uid, myCharacterId, scenario, playerCount)
        const comboReady = isComboReady(scenario, clue, clueStates, uid, myCharacterId, playerCount)
        // 자발적 공개(자기 소유 + 정책 허용) 대상이면 AP와 무관하게 항상 확보 가능 — 무료다.
        const effectiveOwner = getEffectiveCharacterId(scenario, clue.owner, playerCount)
        const isMine = clue.owner && effectiveOwner === myCharacterId
        const selfRevealAllowed = isMine && (phaseDef?.ownerCanSelfReveal || clue.revealPolicy === 'ownerOnly')
        // ownerOnly(자백 전용) 단서는 소유자가 아니면 AP를 내도 절대 강제 열람할 수 없다.
        const forcedByOthersBlocked = clue.revealPolicy === 'ownerOnly' && !isMine
        const canClaim =
          !autoRevealed && !clueState?.claimedBy && comboReady && !forcedByOthersBlocked && (selfRevealAllowed || myAp >= clue.apCost)
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
