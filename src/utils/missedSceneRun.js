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
    missPoints: [], // 자유 클릭 모드에서 빗나간 클릭 위치 (화면 비율 {x, y}) — 지목만 소모
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
      x: f.hotspot?.x ?? null,
      y: f.hotspot?.y ?? null,
      w: f.hotspot?.w ?? null,
      h: f.hotspot?.h ?? null,
    })),
    ...(scene.decoyHotspots ?? []).map((d, i) => ({
      id: d.id ?? `${scene.id}_decoy_${i}`,
      kind: 'decoy',
      label: d.label,
      text: d.text ?? '자세히 살펴봤지만, 판단에 도움이 될 만한 것은 없었다.',
      x: d.x ?? null,
      y: d.y ?? null,
      w: d.w ?? null,
      h: d.h ?? null,
    })),
  ]
  return spots.sort((a, b) => hashString(scene.id + a.id) - hashString(scene.id + b.id))
}

// 조사 방식 — 'freeclick'(기본): 힌트 없이 그림 어디든 클릭, 빗나가면 지목만 소모.
// 'marker': 돋보기 버튼을 보여 주고 그중에서 고르게 한다.
export function getInspectMode(scenario) {
  return scenario?.settings?.inspectMode === 'marker' ? 'marker' : 'freeclick'
}

// 클릭 위치(화면 비율)가 조사 지점의 영역(x·y·w·h) 안인지 — 자유 클릭 모드의 판정.
export function hitSpot(spots, fx, fy) {
  return spots.find((s) => {
    if (s.x == null || s.y == null) return false
    const w = s.w ?? 0.12
    const h = s.h ?? 0.12
    return fx >= s.x && fx <= s.x + w && fy >= s.y && fy <= s.y + h
  })
}

// 동료 설득 영상의 파일 이름 — 시나리오에 video가 지정돼 있으면 그대로 쓰고,
// 없으면 음성 파일 이름의 확장자만 mp4로 바꾼 이름으로 본다 (s1_voice_a.mp3 → s1_voice_a.mp4).
// 플레이 화면과 편집 화면이 같은 이름을 계산하므로, 편집 화면에서 올리기만 하면 바로 나온다.
export function voiceVideoFile(scene, voice) {
  if (voice?.video) return voice.video
  if (voice?.audio) return voice.audio.replace(/\.[^.]+$/, '.mp4')
  if (scene?.id && voice?.id) return `${scene.id}_voice_${String(voice.id).toLowerCase()}.mp4`
  return null
}

// 동료 한 명당 설득 영상은 최대 2개 — 기본 이름과, 그 이름에 _2를 붙인 이름.
// (s1_voice_a.mp4, s1_voice_a_2.mp4) 올린 것만, 이 순서대로 플레이 화면에 나온다.
export function voiceVideoFiles(scene, voice) {
  const first = voiceVideoFile(scene, voice)
  if (!first) return []
  return [first, first.replace(/\.[^.]+$/, (ext) => `_2${ext}`)]
}

// 돋보기 마커의 중심 위치(화면 비율 0~1). x·y만 있고 w·h가 없으면 그 점을 중심으로 본다.
export function spotCenter(spot) {
  if (spot.x == null || spot.y == null) return null
  const w = spot.w ?? 0
  const h = spot.h ?? 0
  return { cx: spot.x + w / 2, cy: spot.y + h / 2 }
}
