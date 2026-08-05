import { evaluateEndings as blackoutEnvelope01 } from './blackout_envelope_01'

const registry = {
  blackout_envelope_01: blackoutEnvelope01,
}

export function evaluateScenarioEndings(scenarioId, metrics) {
  const evaluator = registry[scenarioId]
  if (!evaluator) {
    throw new Error(`시나리오 '${scenarioId}'에 대한 엔딩 평가 로직이 없습니다`)
  }
  return evaluator(metrics)
}
