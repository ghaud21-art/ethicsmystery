// playerCount에 맞는 등장인물만 골라낸다. 3인 버전에 필요한 텍스트 이식은
// 시나리오 JSON 콘텐츠 자체에 이미 반영되어 있으므로(threePlayerVariant.notes 참고),
// 엔진은 단순히 included 여부로 필터링만 하면 된다.
export function getPlayableCharacters(scenario, playerCount) {
  if (playerCount >= 4) return scenario.characters
  return scenario.characters.filter((c) => c.threePlayerVariant?.included !== false)
}
