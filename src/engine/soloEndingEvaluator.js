import { findSoloClueDef } from './soloEngine'

// 1인용 엔딩은 멀티플레이의 when(JSON) 스키마 대신 condition 문자열
// ("accusationCorrect == true AND moralChoice == 'reveal_all'")로 정의된다.
// 저작 문서(JSON)를 그대로 신뢰할 수 없는 경로(AI 파싱 등)로도 들어올 수 있어
// eval()은 쓰지 않고, 아주 단순한 AND-결합 비교식만 안전하게 해석한다.
function parseValue(raw) {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  const strMatch = trimmed.match(/^'(.*)'$|^"(.*)"$/)
  if (strMatch) return strMatch[1] ?? strMatch[2]
  return trimmed
}

function evalClause(clause, metrics) {
  const match = clause.trim().match(/^(\w+)\s*(==|!=|<=|>=|<|>)\s*(.+)$/)
  if (!match) return false
  const [, key, op, rawValue] = match
  const left = metrics[key]
  const right = parseValue(rawValue)
  switch (op) {
    case '==':
      return left === right
    case '!=':
      return left !== right
    case '<':
      return typeof left === 'number' && left < right
    case '>':
      return typeof left === 'number' && left > right
    case '<=':
      return typeof left === 'number' && left <= right
    case '>=':
      return typeof left === 'number' && left >= right
    default:
      return false
  }
}

function evalCondition(condition, metrics) {
  return condition.split(/\s+AND\s+/).every((clause) => evalClause(clause, metrics))
}

// run: { viewedClueIds, accusation, moralChoice }
export function computeSoloMetrics(scenario, run) {
  const accusationStep = scenario.resolutionPhase.steps.find((s) => s.id === 'accusation')
  const accusationSubmitted = !!run.accusation
  const accusationCorrect = accusationSubmitted && run.accusation === accusationStep?.correctAnswer
  const criticalCluesFoundCount = run.viewedClueIds.filter((id) => findSoloClueDef(scenario, id)?.isCriticalClue).length

  return {
    accusationSubmitted,
    accusationCorrect,
    moralChoice: run.moralChoice,
    criticalCluesFoundCount,
  }
}

// endings 배열 등장 순서대로 첫 매치를 채택한다(우선순위가 있는 엔딩은 배열
// 앞쪽에 배치돼 있어야 함 — 조기 결론 엔딩 등). 매치가 하나도 없으면 마지막
// 엔딩을 안전망으로 사용한다.
export function evaluateSoloEnding(scenario, metrics) {
  for (const ending of scenario.endings) {
    if (ending.condition && evalCondition(ending.condition, metrics)) return ending.id
  }
  console.warn('어떤 엔딩 조건도 매치되지 않아 마지막 엔딩으로 대체합니다', metrics)
  return scenario.endings[scenario.endings.length - 1]?.id
}
