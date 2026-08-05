// 단서 하나가 특정 플레이어에게 보여야 하는지 판단한다.
// clueState: rooms/{code}/clues/{clueId} 스냅샷 ({ claimedBy, publishedToRoom } | undefined)
export function isClueVisibleTo(clue, clueState, uid, myCharacterId) {
  if (clueState?.claimedBy === uid) return true // 직접 조사함
  if (clueState?.publishedToRoom) return true // 누군가 공개함
  return false
}

// 시나리오 characters[].secretLayers는 게임 콘텐츠일 뿐 보안 경계가 아니다.
// 전체 JSON은 모든 클라이언트에 동일하게 전달되며, 아래 함수는 "내 캐릭터가 아니면
// UI에 렌더링하지 않는다"는 표시 목적의 필터일 뿐이다.
export function getVisibleSecretLayers(scenario, myCharacterId) {
  const character = scenario.characters.find((c) => c.id === myCharacterId)
  return character?.secretLayers ?? []
}
