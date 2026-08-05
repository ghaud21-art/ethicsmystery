const cache = new Map()

export async function loadScenario(scenarioId) {
  if (cache.has(scenarioId)) return cache.get(scenarioId)
  const res = await fetch(`${import.meta.env.BASE_URL}scenarios/${scenarioId}.json`)
  if (!res.ok) throw new Error(`시나리오를 불러올 수 없습니다: ${scenarioId}`)
  const scenario = await res.json()
  if (!['1.0', '1.1'].includes(scenario.schemaVersion)) {
    throw new Error(`지원하지 않는 시나리오 스키마 버전: ${scenario.schemaVersion}`)
  }
  cache.set(scenarioId, scenario)
  return scenario
}

export async function loadRegistry() {
  const res = await fetch(`${import.meta.env.BASE_URL}scenarios/registry.json`)
  if (!res.ok) throw new Error('시나리오 목록을 불러올 수 없습니다')
  return res.json()
}
