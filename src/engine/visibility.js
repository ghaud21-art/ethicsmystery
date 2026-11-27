import { getPlayableCharacters, getEffectiveCharacterId } from './characterAssignment'

// owner가 있는 단서인데, 그 owner 캐릭터가 이번 방의 인원수(playerCount)에서는
// 아예 플레이 대상이 아닌 경우(예: 4인용 시나리오를 3인으로 진행) — 그 인물을
// 캐물을 사람 자체가 없으므로, 조사(claim) 없이 처음부터 모두에게 공개한다.
// 통합 캐릭터로 흡수된 인물의 단서는 "미등장"이 아니라 통합 캐릭터 본인 소유로
// 취급해야 하므로, 비교 전에 owner를 effective id로 치환한다.
export function isClueAutoRevealed(clue, scenario, playerCount) {
  if (!clue.owner || !scenario || !playerCount) return false
  const playable = getPlayableCharacters(scenario, playerCount)
  const effectiveOwner = getEffectiveCharacterId(scenario, clue.owner, playerCount)
  if (playable.some((c) => c.id === effectiveOwner)) return false
  // NPC가 된 인물의 단서는 자동 공개하지 않고 npcMode에 따라 조사 카드/비밀 증거가 된다.
  if (clue.npcMode) return false
  return true
}

// 이 방에서 단서가 놓이는 단계: 'phase1' | 'phase2' | null(이번 판에는 없음).
// owner가 NPC(플레이어가 맡지 않은 인물·상시 NPC)일 때 npcMode에 따라
//  - 'investigation' → 1단계 조사 카드(AP로 조사)
//  - 'keyEvidence'   → 보드에 놓이지 않음(NPC의 L2 비밀로만 드러남)
// owner가 플레이어 배역이면 원래 정의된 단계 그대로.
export function cluePhaseInRoom(clue, definedPhase, scenario, playerCount) {
  if (!clue.npcMode || !clue.owner) return definedPhase
  const playable = getPlayableCharacters(scenario, playerCount)
  if (playable.some((c) => c.id === clue.owner)) return clue.npcMode === 'investigation' && clue.npcOnly ? null : definedPhase
  if (clue.npcMode === 'investigation') return 'phase1'
  return null
}

export function cluesForPhase(scenario, phase, playerCount) {
  return ['phase1', 'phase2'].flatMap((p) =>
    scenario.clues[p].items.filter((c) => cluePhaseInRoom(c, p, scenario, playerCount) === phase),
  )
}

// 단서 하나가 특정 플레이어에게 보여야 하는지 판단한다.
// clueState: rooms/{code}/clues/{clueId} 스냅샷 ({ claimedBy, publishedToRoom } | undefined)
// scenario/playerCount를 넘기면 "미등장 인물"의 단서 자동 공개 규칙도 함께 적용된다.
export function isClueVisibleTo(clue, clueState, uid, myCharacterId, scenario, playerCount) {
  if (clueState?.claimedBy === uid) return true // 직접 조사함
  if (clueState?.publishedToRoom) return true // 누군가 공개함
  if (isClueAutoRevealed(clue, scenario, playerCount)) return true // 미등장 인물의 단서는 자동 공개
  return false
}

// 시나리오 characters[].secretLayers는 게임 콘텐츠일 뿐 보안 경계가 아니다.
// 전체 JSON은 모든 클라이언트에 동일하게 전달되며, 아래 함수는 "내 캐릭터가 아니면
// UI에 렌더링하지 않는다"는 표시 목적의 필터일 뿐이다.
export function getVisibleSecretLayers(scenario, myCharacterId, playerCount) {
  const character = getPlayableCharacters(scenario, playerCount).find((c) => c.id === myCharacterId)
  return character?.secretLayers ?? []
}
