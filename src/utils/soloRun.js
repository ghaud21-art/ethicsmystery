// 1인용 플레이는 방(room) 없이 이 기기 안에서만 진행된다 — 여러 명이 볼 필요가
// 없으므로 RTDB 대신 localStorage에 진행 상태를 저장한다. 새로고침해도 이어할 수 있다.
const KEY_PREFIX = 'ethicsmystery.soloRun.'

export function newSoloRun(scenario, playerName) {
  return {
    scenarioId: scenario.scenarioId,
    playerName,
    step: 'briefing', // briefing -> phase1 -> phase2 -> resolution -> ended
    apRemaining: scenario.clues.phase1.totalActionPoints ?? 10,
    viewedClueIds: [],
    accusation: null,
    moralChoice: null,
    startedAt: Date.now(),
    investigationStartedAt: null, // 브리핑을 넘기고 조사를 시작한 시각 — 제한시간 타이머 기준점
  }
}

export function saveSoloRun(scenarioId, run) {
  localStorage.setItem(KEY_PREFIX + scenarioId, JSON.stringify(run))
}

export function getSoloRun(scenarioId) {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFIX + scenarioId))
  } catch {
    return null
  }
}

export function clearSoloRun(scenarioId) {
  localStorage.removeItem(KEY_PREFIX + scenarioId)
}
