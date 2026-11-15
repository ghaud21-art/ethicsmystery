// 놓친 장면(1인 영상 추리)의 진행 상태 — 탐문 수사(tanmunRun)·1인용 머더(soloRun)와
// 같은 이유로 localStorage에 저장한다. 새로고침/뒤로가기에도 장면 진행과 기록이 유지된다.
const KEY_PREFIX = 'ethicsmystery.missedSceneRun.'

// 한 장면에서 쌓이는 기록. 결과 화면(resultScreen.show)의 다섯 항목이 전부 여기서 나온다:
// 선택한 쪽(finalChoice) · 적어 둔 이유(reason) · 찾은 사실 수(foundFactIds) ·
// 변수를 알고 결정을 바꿨는지(variableSeen + changedAfterVariable) · 원리 맞히기(revealGuess).
export function newSceneRecord() {
  return {
    inspectUsed: 0,
    inspectedSpotIds: [], // 지목한 순서대로의 조사 지점 id (사실 id 또는 혼란용 지점 id)
    foundFactIds: [],
    initialChoice: null, // 변수 내레이션을 듣기 전의 결정
    finalChoice: null,
    variableSeen: false, // 변수 내레이션을 결정 단계에서 들었는지 (찾은 경우에만 true)
    changedAfterVariable: false,
    reason: '',
    missedAnswer: null, // "이 사실을 알았다면 판단이 달라졌을까요?"에 대한 답
    revealGuess: null, // { A: 원리 key, B: 원리 key }
    toneTrapAnswer: null,
  }
}

export function newMissedSceneRun(scenarioId, playerName = '') {
  return {
    scenarioId,
    playerName,
    step: 'play', // play -> epilogue -> ended
    sceneIndex: 0,
    phase: 'intro', // intro -> inspect -> voices -> decide -> variable -> result -> missed -> reveal
    records: {}, // { [sceneId]: newSceneRecord() } — 장면에 처음 손대는 순간 생성
    startedAt: Date.now(),
  }
}

export function saveMissedSceneRun(scenarioId, run) {
  localStorage.setItem(KEY_PREFIX + scenarioId, JSON.stringify(run))
}

export function getMissedSceneRun(scenarioId) {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFIX + scenarioId))
  } catch {
    return null
  }
}

export function clearMissedSceneRun(scenarioId) {
  localStorage.removeItem(KEY_PREFIX + scenarioId)
}

export function getInspectLimit(scenario) {
  return scenario?.settings?.inspectLimitPerScene ?? 5
}

export function getReasonMaxLength(scenario) {
  return scenario?.settings?.reasonMaxLength ?? 100
}

// 세 번째 선택지(C)의 해금 조건 — 지금은 'allFactsFound' 하나뿐이지만,
// 시나리오 데이터(settings.thirdChoiceUnlock / choice.requires)가 우선하도록 해석한다.
export function isChoiceUnlocked(scenario, scene, record, choice) {
  if (!choice.requires) return true
  if (choice.requires === 'allFactsFound') {
    return (record?.foundFactIds?.length ?? 0) >= scene.facts.length
  }
  return false // 알 수 없는 조건은 안전하게 잠김으로 처리
}

export function findChoice(scene, choiceId) {
  return scene.choices.find((c) => c.id === choiceId) ?? null
}

export function findVariableFact(scene) {
  return scene.facts.find((f) => f.isVariable) ?? null
}

// 조사 지점 목록 — 진짜 사실(facts)과 혼란용 지점(decoyHotspots)을 섞는다.
// 순서는 장면 id 기반 해시로 고정해서, 새로고침해도 배치가 바뀌지 않게 한다.
function hashString(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function buildInspectSpots(scene) {
  const spots = [
    ...scene.facts.map((f) => ({
      id: f.id,
      kind: 'fact',
      label: f.hotspot?.label ?? f.title,
    })),
    ...(scene.decoyHotspots ?? []).map((d, i) => ({
      id: d.id ?? `${scene.id}_decoy_${i}`,
      kind: 'decoy',
      label: d.label,
      text: d.text ?? '자세히 살펴봤지만, 판단에 도움이 될 만한 것은 없었다.',
    })),
  ]
  return spots.sort((a, b) => hashString(scene.id + a.id) - hashString(scene.id + b.id))
}
