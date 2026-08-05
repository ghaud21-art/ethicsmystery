// scenario JSON의 endings[].condition은 저작용 의사코드다. 실제 판정 로직은
// 여기 시나리오별 evaluator에 작성한다 (범용 조건 문자열 파서는 과설계로 판단해 채택하지 않음).
//
// "누가 단서를 실제로 숨겼는가"는 대화가 앱 밖(실제 대화)에서 이뤄지므로 서버가
// 검증할 수 없다 — moral_choice 응답(reveal_all/conceal_some) 자체가 자진신고이며,
// 이것이 바로 "기게스의 반지" 주제(보는 사람이 없어도 정직할 것인가)를 게임 메커닉으로 구현한 것.
//
// metrics: {
//   accusationCorrect: boolean,
//   accusations: { [uid]: characterId | 'unknown' },
//   moralChoices: { [uid]: 'reveal_all' | 'conceal_some' },
//   selfConfessTriggeredBy: uid | null,
// }
export function evaluateEndings(metrics) {
  const accusationValues = Object.values(metrics.accusations ?? {})
  const unanimous =
    accusationValues.length > 0 && accusationValues.every((v) => v === accusationValues[0])

  if (metrics.selfConfessTriggeredBy) {
    return 'ending_e_self_confession'
  }
  if (!unanimous) {
    return 'ending_d_each_for_self'
  }
  if (!metrics.accusationCorrect) {
    return 'ending_c_wrong_stigma'
  }

  const choiceValues = Object.values(metrics.moralChoices ?? {})
  const concealCount = choiceValues.filter((v) => v === 'conceal_some').length
  if (concealCount === 0) {
    return 'ending_a_full_truth'
  }
  const majorityConceal = concealCount > choiceValues.length / 2
  if (majorityConceal) {
    return 'ending_b_silent_complicity'
  }

  return 'ending_a_full_truth'
}
