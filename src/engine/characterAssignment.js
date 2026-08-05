// playerCount에 맞는 등장인물만 골라낸다. 3인 버전에 필요한 텍스트 이식은
// 시나리오 JSON 콘텐츠 자체에 이미 반영되어 있으므로(threePlayerVariant.notes 참고),
// 엔진은 단순히 included 여부로 필터링만 하면 된다.
export function getPlayableCharacters(scenario, playerCount) {
  if (playerCount >= 4) return scenario.characters
  return scenario.characters.filter((c) => c.threePlayerVariant?.included !== false)
}

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function assignCharactersToPlayers(scenario, playerCount, playerUids) {
  const characters = shuffle(getPlayableCharacters(scenario, playerCount))
  if (characters.length !== playerUids.length) {
    throw new Error(
      `인원(${playerUids.length})과 캐릭터 수(${characters.length})가 일치하지 않습니다`,
    )
  }
  // 방장이 호출하며 RTDB에 그대로 기록되는 배정 결과를 반환한다.
  const assignment = {}
  playerUids.forEach((uid, i) => {
    assignment[uid] = characters[i].id
  })
  return assignment
}
