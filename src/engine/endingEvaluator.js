// 시나리오는 관리자 페이지를 통해 코드 배포 없이 추가/수정되므로, 엔딩 판정 로직은
// 시나리오별 JS 파일이 아니라 이 하나의 범용 평가기가 scenario.endings[].when(JSON)을
// 그대로 해석해서 처리한다.
//
// when 필드:
//   accused: 정확히 이 캐릭터가 지목됐을 때만 매치
//   accusedIn: 이 캐릭터 목록 중 하나가 지목됐을 때 매치
//   cluesFound: 이 단서들이 모두 확보(claimedBy 존재)되어 있어야 매치
//   cluesNotFound: 이 단서들이 모두 확보되어 있지 않아야 매치
//   moralChoiceMajority: 'reveal_all' | 'conceal_some' 다수결과 일치해야 매치
//   fallback: 지목이 만장일치가 아니거나(또는 'unknown') 다른 엔딩이 하나도 매치하지
//             않을 때 사용되는 기본 엔딩 — 시나리오당 정확히 하나 있어야 한다.
//
// 같은 accused에 대해 여러 엔딩이 매치 가능하도록 설계됐다면(예: 확보 단서 유무로
// 갈리는 4가지 조합), endings 배열에 등장하는 순서대로 첫 매치를 채택한다 — 저작자가
// 더 구체적인(단서 조건이 있는) 엔딩을 먼저, 더 일반적인 엔딩을 나중에 배치하면 된다.
export function evaluateEndings(scenario, metrics) {
  const { accused, moralChoiceMajority, foundClueIds } = metrics

  if (accused) {
    for (const ending of scenario.endings) {
      const w = ending.when
      if (!w || w.fallback) continue
      if (w.accused && w.accused !== accused) continue
      if (w.accusedIn && !w.accusedIn.includes(accused)) continue
      if (w.cluesFound && !w.cluesFound.every((id) => foundClueIds.has(id))) continue
      if (w.cluesNotFound && !w.cluesNotFound.every((id) => !foundClueIds.has(id))) continue
      if (w.moralChoiceMajority && w.moralChoiceMajority !== moralChoiceMajority) continue
      return ending.id
    }
  }

  const fallback = scenario.endings.find((e) => e.when?.fallback)
  if (!fallback) throw new Error('시나리오에 fallback 엔딩이 정의되어 있지 않습니다')
  return fallback.id
}

// room.resolution의 원시 상태로부터 evaluateEndings가 쓰는 metrics를 계산한다.
export function computeResolutionMetrics({ accusations, moralChoices, roomClues }) {
  const accusationValues = Object.values(accusations ?? {})
  const unanimous = accusationValues.length > 0 && accusationValues.every((v) => v === accusationValues[0])
  const accused = unanimous && accusationValues[0] !== 'unknown' ? accusationValues[0] : null

  const choiceValues = Object.values(moralChoices ?? {})
  const concealCount = choiceValues.filter((v) => v === 'conceal_some').length
  const moralChoiceMajority = choiceValues.length > 0 && concealCount > choiceValues.length / 2 ? 'conceal_some' : 'reveal_all'

  const foundClueIds = new Set(Object.entries(roomClues ?? {}).filter(([, v]) => v?.claimedBy).map(([id]) => id))

  return { accused, moralChoiceMajority, foundClueIds }
}
