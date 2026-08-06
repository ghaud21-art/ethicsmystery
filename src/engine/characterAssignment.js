// playerCount에 맞는 등장인물만 골라낸다. 두 가지 3인 변형 방식을 지원한다:
//  1) 제외 방식 — 각 캐릭터의 threePlayerVariant.included===false면 빠진다(텍스트는
//     이미 시나리오 콘텐츠에 이식되어 있으므로 필터링만 하면 됨).
//  2) 통합 방식 — scenario.threePlayerVariant.integratedCharacter가 있으면, 3인일 때
//     mergedFromCharacterIds에 속한 캐릭터들을 빼고 그 자리에 통합 캐릭터 하나를 넣는다.
export function getPlayableCharacters(scenario, playerCount) {
  if (playerCount >= 4) return scenario.characters
  const variant = scenario.threePlayerVariant
  if (playerCount === 3 && variant?.integratedCharacter) {
    const merged = new Set(variant.mergedFromCharacterIds ?? [])
    return [...scenario.characters.filter((c) => !merged.has(c.id)), variant.integratedCharacter]
  }
  return scenario.characters.filter((c) => c.threePlayerVariant?.included !== false)
}

// 캐릭터 id 하나를 이번 인원수 기준의 "실제로 플레이되는" id로 변환한다. 통합 방식
// 3인 시나리오에서, 통합되어 사라진 원래 캐릭터(예: 'haneul')를 가리키던 id를
// 통합 캐릭터 id(예: 'sora_integrated')로 치환한다 — 단서 소유자 판정(자기 자신
// 조사 금지, 미등장 인물 자동 공개), 지목 선택지, 엔딩 판정(when.accused)이 모두
// 이 치환을 거쳐야 통합 캐릭터를 원래 두 인물의 "본인"으로 일관되게 취급할 수 있다.
export function getEffectiveCharacterId(scenario, characterId, playerCount) {
  if (!characterId) return characterId
  const variant = scenario.threePlayerVariant
  if (playerCount === 3 && variant?.integratedCharacter && (variant.mergedFromCharacterIds ?? []).includes(characterId)) {
    return variant.integratedCharacter.id
  }
  return characterId
}
