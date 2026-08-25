import { getEffectiveCharacterId } from './characterAssignment'
import { resolveAccusationOptions } from './resolutionOptions'

// 시나리오는 관리자 페이지를 통해 코드 배포 없이 추가/수정되므로, 엔딩 판정 로직은
// 시나리오별 JS 파일이 아니라 이 하나의 범용 평가기가 scenario.endings[].when(JSON)을
// 그대로 해석해서 처리한다.
//
// when 필드:
//   accused: 정확히 이 옵션(캐릭터 id 또는 객관식 선택지 id)이 다수결로 뽑혔을 때만 매치
//   accusedIn: 이 옵션 목록 중 하나가 다수결로 뽑혔을 때 매치
//   accusedOptionCorrect: 다수결로 뽑힌 지목 선택지의 isCorrect 플래그와 일치해야
//     매치 — "누구를 지목했는가"가 아니라 "객관식 정답을 골랐는가"가 핵심인
//     시나리오용(예: 지목 선택지가 캐릭터가 아니라 A~D 서술형 답지인 경우).
//   cluesFound: 이 단서들이 모두 확보(claimedBy 존재)되어 있어야 매치
//   cluesNotFound: 이 단서들이 모두 확보되어 있지 않아야 매치
//   moralChoiceMajority: 'reveal_all' | 'conceal_some' 다수결과 일치해야 매치
//   confessedCharacterIds: 이 캐릭터들을 맡은 플레이어가 전부 개별적으로 자백을
//     선택(moralChoices 값 === 'confess')했어야 매치 — 팀 다수결이 아니라 "이
//     사람은 반드시 자백했는가"를 캐릭터별로 요구하는 시나리오용.
//   notConfessedCharacterIds: 위와 반대로, 이 캐릭터들은 전부 자백하지 않았어야 매치.
//   minConfessCount / maxConfessCount: 자백을 선택한 인원 수(전체, 누구인지 무관)의
//     하한/상한.
//   minCriticalCluesFound: 팀이 확보한 isCriticalClue 단서 수가 이 값 미만이면
//     (지목 내용과 무관하게) 이 엔딩이 최우선으로 매치된다 — "충분한 근거 없이
//     결론 내림" 계열 엔딩용. 시나리오당 최대 하나만 두는 걸 권장.
//   fallback: 다수결 지목이 동점이거나 1위가 'unknown'이거나, 다른 엔딩이 하나도
//             매치하지 않을 때 사용되는 기본 엔딩 — 시나리오당 정확히 하나 있어야 한다.
//
// 같은 accused에 대해 여러 엔딩이 매치 가능하도록 설계됐다면(예: 확보 단서 유무로
// 갈리는 4가지 조합), endings 배열에 등장하는 순서대로 첫 매치를 채택한다 — 저작자가
// 더 구체적인(단서 조건이 있는) 엔딩을 먼저, 더 일반적인 엔딩을 나중에 배치하면 된다.
//
// playerCount: 통합 캐릭터 3인 시나리오에서는 accused가 이미 통합 캐릭터 id로
// 들어오지만(resolveAccusationOptions가 미리 치환함), when.accused/accusedIn과
// confessedCharacterIds/notConfessedCharacterIds는 4인 기준 원본 캐릭터 id로
// 저작되어 있으므로, 비교 전에 같은 방식으로 치환해야 3인 게임에서도 올바르게
// 매치된다.
export function evaluateEndings(scenario, metrics, playerCount) {
  const { accused, moralChoiceMajority, foundClueIds, criticalCluesFoundCount, accusedOptionCorrect, confessedCharacterIds } = metrics
  const effectiveId = (id) => getEffectiveCharacterId(scenario, id, playerCount)

  // 증거 부족 게이트 — 지목 내용과 무관하게 최우선으로 평가한다.
  for (const ending of scenario.endings) {
    const w = ending.when
    if (w?.minCriticalCluesFound !== undefined && (criticalCluesFoundCount ?? 0) < w.minCriticalCluesFound) {
      return ending.id
    }
  }

  if (accused) {
    for (const ending of scenario.endings) {
      const w = ending.when
      if (!w || w.fallback || w.minCriticalCluesFound !== undefined) continue
      if (w.accused && effectiveId(w.accused) !== accused) continue
      if (w.accusedIn && !w.accusedIn.map(effectiveId).includes(accused)) continue
      if (w.accusedOptionCorrect !== undefined && accusedOptionCorrect !== w.accusedOptionCorrect) continue
      if (w.cluesFound && !w.cluesFound.every((id) => foundClueIds.has(id))) continue
      if (w.cluesNotFound && !w.cluesNotFound.every((id) => !foundClueIds.has(id))) continue
      if (w.moralChoiceMajority && w.moralChoiceMajority !== moralChoiceMajority) continue
      if (w.confessedCharacterIds && !w.confessedCharacterIds.map(effectiveId).every((id) => confessedCharacterIds?.includes(id))) continue
      if (w.notConfessedCharacterIds && w.notConfessedCharacterIds.map(effectiveId).some((id) => confessedCharacterIds?.includes(id))) continue
      if (w.minConfessCount !== undefined && (metrics.confessCount ?? 0) < w.minConfessCount) continue
      if (w.maxConfessCount !== undefined && (metrics.confessCount ?? 0) > w.maxConfessCount) continue
      return ending.id
    }
  }

  const fallback = scenario.endings.find((e) => e.when?.fallback)
  if (!fallback) throw new Error('시나리오에 fallback 엔딩이 정의되어 있지 않습니다')
  return fallback.id
}

// 지목은 만장일치가 아니라 다수결로 정한다 — 득표 1위가 단독이면 그 인물로 확정,
// 동점이면(1위가 여럿) 팀이 결론을 못 낸 것으로 보고 fallback 엔딩으로 보낸다.
function pickMajorityAccusation(accusationValues) {
  if (accusationValues.length === 0) return null
  const counts = new Map()
  for (const v of accusationValues) counts.set(v, (counts.get(v) ?? 0) + 1)
  const max = Math.max(...counts.values())
  const topOptions = [...counts.entries()].filter(([, c]) => c === max).map(([k]) => k)
  if (topOptions.length !== 1) return null // 동점
  const winner = topOptions[0]
  return winner === 'unknown' ? null : winner
}

// room.resolution의 원시 상태로부터 evaluateEndings가 쓰는 metrics를 계산한다.
// scenario를 넘기면 isCriticalClue 단서 중 몇 개를 확보했는지, 지목 선택지의
// isCorrect 플래그도 함께 계산한다. players(room.players, uid→{characterId})를
// 넘기면 자백 인원수/캐릭터 목록도 계산한다 — 둘 다 생략해도 기존 시나리오
// 동작에는 영향이 없다(해당 필드가 undefined로 남을 뿐).
export function computeResolutionMetrics({ accusations, moralChoices, roomClues, scenario, players, playerCount }) {
  const accusationValues = Object.values(accusations ?? {})
  const accused = pickMajorityAccusation(accusationValues)

  const choiceValues = Object.values(moralChoices ?? {})
  const concealCount = choiceValues.filter((v) => v === 'conceal_some').length
  const moralChoiceMajority = choiceValues.length > 0 && concealCount > choiceValues.length / 2 ? 'conceal_some' : 'reveal_all'

  const foundClueIds = new Set(Object.entries(roomClues ?? {}).filter(([, v]) => v?.claimedBy).map(([id]) => id))

  let criticalCluesFoundCount = 0
  if (scenario) {
    const criticalIds = new Set(
      [...scenario.clues.phase1.items, ...scenario.clues.phase2.items].filter((c) => c.isCriticalClue).map((c) => c.id),
    )
    criticalCluesFoundCount = [...foundClueIds].filter((id) => criticalIds.has(id)).length
  }

  let accusedOptionCorrect
  if (scenario && accused) {
    const picked = resolveAccusationOptions(scenario, playerCount).find((o) => o.id === accused)
    if (picked?.isCorrect !== undefined) accusedOptionCorrect = picked.isCorrect
  }

  let confessCount
  let confessedCharacterIds
  if (players) {
    const confessedEntries = Object.entries(moralChoices ?? {}).filter(([, v]) => v === 'confess')
    confessCount = confessedEntries.length
    confessedCharacterIds = confessedEntries
      .map(([puid]) => players[puid]?.characterId)
      .filter(Boolean)
      .map((id) => getEffectiveCharacterId(scenario, id, playerCount))
  }

  return {
    accused,
    moralChoiceMajority,
    foundClueIds,
    criticalCluesFoundCount,
    accusedOptionCorrect,
    confessCount,
    confessedCharacterIds,
  }
}
