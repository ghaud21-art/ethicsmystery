import { getPlayableCharacters } from './characterAssignment'

// owner가 있는 단서인데, 그 owner 캐릭터가 이번 방의 인원수(playerCount)에서는
// 아예 플레이 대상이 아닌 경우(예: 4인용 시나리오를 3인으로 진행) — 그 인물을
// 캐물을 사람 자체가 없으므로, 조사(claim) 없이 처음부터 모두에게 공개한다.
export function isClueAutoRevealed(clue, scenario, playerCount) {
  if (!clue.owner || !scenario || !playerCount) return false
  const playable = getPlayableCharacters(scenario, playerCount)
  return !playable.some((c) => c.id === clue.owner)
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
export function getVisibleSecretLayers(scenario, myCharacterId) {
  const character = scenario.characters.find((c) => c.id === myCharacterId)
  return character?.secretLayers ?? []
}
