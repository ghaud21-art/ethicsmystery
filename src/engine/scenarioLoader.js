import { listScenarios, getScenario } from '../firebase/scenariosApi'

const cache = new Map()

const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1']

export async function loadScenario(scenarioId) {
  if (cache.has(scenarioId)) return cache.get(scenarioId)
  const scenario = await getScenario(scenarioId)
  if (!scenario) throw new Error(`시나리오를 찾을 수 없습니다: ${scenarioId}`)
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(scenario.schemaVersion)) {
    throw new Error(`지원하지 않는 시나리오 스키마 버전: ${scenario.schemaVersion}`)
  }
  cache.set(scenarioId, scenario)
  return scenario
}

// 발행 여부와 무관하게 전체 목록을 반환한다. 미발행 시나리오도 소개 페이지는
// 보여주고 플레이만 막는 UX이기 때문 — 필터링은 화면에서 published로 처리한다.
export async function loadRegistry() {
  const scenarios = await listScenarios()
  return scenarios.map((s) => ({
    scenarioId: s.scenarioId,
    title: s.meta?.title,
    unit: s.unit,
    themes: s.meta?.themes,
    supportedPlayerCounts: s.meta?.supportedPlayerCounts,
    estimatedMinutes: s.meta?.estimatedMinutes,
    difficulty: s.difficulty,
    published: !!s.published,
  }))
}
