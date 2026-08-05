// scenario JSON의 endings[].condition은 저작용 의사코드다. 실제 판정 로직은
// 여기 시나리오별 evaluator에 작성한다 (범용 조건 문자열 파서는 과설계로 판단해 채택하지 않음).
//
// metrics: {
//   accusations: { [uid]: characterId | 'unknown' },
//   moralChoices: { [uid]: 'reveal_all' | 'conceal_some' },
//   roomClues: { [clueId]: { claimedBy, publishedToRoom, ... } },
// }
export function evaluateEndings(metrics) {
  const accusationValues = Object.values(metrics.accusations ?? {})
  const unanimous =
    accusationValues.length > 0 && accusationValues.every((v) => v === accusationValues[0])
  const accused = unanimous ? accusationValues[0] : null

  const specialCFound = !!metrics.roomClues?.p2_specialC?.claimedBy
  const specialDFound = !!metrics.roomClues?.p1_specialA?.claimedBy && !!metrics.roomClues?.p2_specialD?.claimedBy

  const choiceValues = Object.values(metrics.moralChoices ?? {})
  const concealCount = choiceValues.filter((v) => v === 'conceal_some').length
  const moralChoiceMajority = choiceValues.length > 0 && concealCount > choiceValues.length / 2 ? 'conceal_some' : 'reveal_all'

  if (!unanimous || !accused || accused === 'unknown') {
    return 'ending_unfinished_truth'
  }

  if (accused === 'harin') {
    if (specialCFound) {
      return moralChoiceMajority === 'reveal_all' ? 'ending_honest_reconstruction' : 'ending_our_own_morality'
    }
    return moralChoiceMajority === 'reveal_all' ? 'ending_half_truth' : 'ending_unfinished_suspicion'
  }

  if (accused === 'junhyeok') {
    return specialDFound ? 'ending_seen_but_not_believed' : 'ending_wronged_stigma'
  }

  // 서연 또는 도현을 지목한 경우 — 이 시나리오는 서연에 대해서만 전용 결말 텍스트를
  // 작성했으므로(설계안 참고), 도현 오지목도 같은 결말로 수렴시킨다.
  return 'ending_accused_by_suspicion'
}
