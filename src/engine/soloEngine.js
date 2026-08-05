// 1인용 시나리오는 팀원이 없으므로 "누가 확보했는가"가 아니라 "내가 무엇을
// 먼저 봤는가"로 단서가 풀린다. unlockCondition 문자열(예:
// "clue:p1_spread_graph_viewed AND clue:p2_yujin_base_viewed",
// "character:seo_jio_base_visited")을 해석해 지금까지 본 단서 목록과 비교한다.
//
// clue:{clueId}_viewed        → clueId 단서를 이미 봤어야 함
// character:{characterId}_{base|deep}_visited
//                              → 그 인물의 base/deep 단서(ownedPhase2Clues[0|1])를 이미 봤어야 함
export function isSoloClueUnlocked(scenario, clue, viewedClueIds) {
  if (!clue.unlockCondition) return true
  const viewed = new Set(viewedClueIds)
  const clauses = clue.unlockCondition.split(/\s+AND\s+/)
  return clauses.every((raw) => {
    // 저작 데이터에 "_viewed"와 "_revealed"가 같은 의미로 혼용돼 있어(예:
    // "clue:p2_yujin_deep_revealed") 둘 다 "이미 봤다"로 취급한다.
    const clueMatch = raw.match(/^clue:(.+)_(?:viewed|revealed)$/)
    if (clueMatch) return viewed.has(clueMatch[1])

    const charMatch = raw.match(/^character:(.+)_(base|deep)_visited$/)
    if (charMatch) {
      const [, characterId, level] = charMatch
      const character = scenario.characters.find((c) => c.id === characterId)
      const targetClueId = character?.ownedPhase2Clues?.[level === 'base' ? 0 : 1]
      return targetClueId ? viewed.has(targetClueId) : false
    }

    return false // 알 수 없는 조건은 안전하게 미충족으로 처리
  })
}

export function findSoloClueDef(scenario, clueId) {
  return (
    scenario.clues.phase1.items.find((c) => c.id === clueId) ??
    scenario.clues.phase2.items.find((c) => c.id === clueId)
  )
}

// 단서를 본다 — 성공 시 { apRemaining, viewedClueIds }를 반환, 실패 시 에러 메시지 throw.
export function viewSoloClue(scenario, run, clueId) {
  const clue = findSoloClueDef(scenario, clueId)
  if (!clue) throw new Error(`알 수 없는 단서: ${clueId}`)
  if (run.viewedClueIds.includes(clueId)) return run // 이미 본 단서 — 그대로 반환
  if (!isSoloClueUnlocked(scenario, clue, run.viewedClueIds)) {
    throw new Error(clue.unlockNote ?? '아직 이 단서를 볼 조건이 충족되지 않았습니다')
  }
  if (run.apRemaining < clue.apCost) {
    throw new Error('행동력(AP)이 부족합니다')
  }
  return {
    ...run,
    apRemaining: run.apRemaining - clue.apCost,
    viewedClueIds: [...run.viewedClueIds, clueId],
  }
}
