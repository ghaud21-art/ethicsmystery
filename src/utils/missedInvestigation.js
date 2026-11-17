// 놓친 장면 조사 모드(missedscene-2.0, mode: 'investigation')의 규칙.
// 장소 선택 → 영상 지목 → 인물 진술 뒤집기 → 단서 잇기 → 하루 끝 결정 → 시간표 → 보고서 → 결말.
const KEY_PREFIX = 'ethicsmystery.missedInvestigation.'

export function newInvestigationRun(scenario, level, playerName = '') {
  return {
    scenarioId: scenario.scenarioId,
    playerName,
    level,
    step: 'brief', // brief -> map -> location -> decision -> timeline -> report -> ending -> missed -> ended
    day: 1,
    visitsToday: 0,
    visited: [], // 방문한 장소 id (방문 순서)
    current: null, // 지금 조사 중인 장소 id
    inspect: {}, // { [locId]: { used, found: [clueId], misses: [{x,y}] } }
    found: [], // 찾은 단서 id (시작 단서 포함)
    flipped: {}, // { [charId]: true } 두 번째 진술이 열린 인물
    wrong: {}, // { [charId]: n } 틀린 단서를 내민 횟수
    met: {}, // { [charId]: true } 첫 진술을 들은 인물
    links: [], // 열린 추론 id
    linkTries: 0,
    decisions: {}, // { d1: 'sign', ... }
    pendingDecision: null,
    timeline: null, // 카드 id 배열(학생이 놓은 순서)
    report: {}, // { who, when, why }
    endingId: null,
    startedAt: Date.now(),
  }
}

export const saveRun = (id, run) => localStorage.setItem(KEY_PREFIX + id, JSON.stringify(run))
export const loadRun = (id) => {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFIX + id))
  } catch {
    return null
  }
}
export const clearRun = (id) => localStorage.removeItem(KEY_PREFIX + id)

export function levelOf(scenario, run) {
  return scenario.levels?.[run?.level] ?? scenario.levels?.standard ?? {}
}

// 난이도에 따라 보이는 단서 (입문은 가짜 단서를 뺀다)
export function cluesOf(scenario, run, loc) {
  const lv = levelOf(scenario, run)
  return (loc.clues ?? []).filter((c) => !(lv.fakeClues === false && c.difficulty === 'fake'))
}

export function allClues(scenario) {
  const map = {}
  ;(scenario.startClues ?? []).forEach((c) => (map[c.id] = { ...c, start: true }))
  ;(scenario.locations ?? []).forEach((l) => (l.clues ?? []).forEach((c) => (map[c.id] = { ...c, locationId: l.id })))
  return map
}

// 시계 오차를 끈 난이도에서는 단서 글에 다른 문구(textNoSkew)를 쓴다.
export function clueText(scenario, run, clue) {
  const lv = levelOf(scenario, run)
  if (lv.clockSkew === false && clue.textNoSkew) return clue.textNoSkew
  return clue.text
}

export function locationOpen(scenario, run, loc) {
  const lv = levelOf(scenario, run)
  if (lv.fixedLocations) return lv.fixedLocations.includes(loc.id)
  const u = loc.unlock ?? { start: true }
  if (u.start) return true
  const found = new Set(run.found)
  if (u.anyClue?.some((id) => found.has(id))) return true
  if (u.anyClueFrom && (scenario.locations.find((l) => l.id === u.anyClueFrom)?.clues ?? []).some((c) => found.has(c.id))) return true
  if (u.visited?.some((id) => run.visited.includes(id))) return true
  return false
}

export function inspectLimitOf(scenario, run, loc) {
  const base = scenario.settings?.inspectLimitPerLocation ?? 7
  // 결정 1을 거절하면 군청 문서고의 지목이 줄어든다
  const d = (scenario.decisions ?? []).find((x) => x.id === 'd1')
  const opt = d?.options.find((o) => o.id === run.decisions.d1)
  if (opt?.effect?.inspectLimit?.[loc.id] != null) return opt.effect.inspectLimit[loc.id]
  return base
}

export function inspectModeOf(scenario, run) {
  const lv = levelOf(scenario, run)
  if (lv.hints) return 'marker'
  return scenario.settings?.inspectMode === 'marker' ? 'marker' : 'freeclick'
}

// 지목 후보: 단서 + 혼란 지점. 위치가 없는 후보는 버튼으로 보여 준다.
export function spotsOf(scenario, run, loc) {
  const clues = cluesOf(scenario, run, loc).map((c) => ({ id: c.id, kind: 'clue', label: c.hotspot?.label ?? c.title, ...pick(c.hotspot) }))
  const decoys = (loc.decoyHotspots ?? []).map((d, i) => ({ id: d.id ?? `${loc.id}_d${i}`, kind: 'decoy', label: d.label, text: d.text, ...pick(d) }))
  return [...clues, ...decoys].sort((a, b) => hash(loc.id + a.id) - hash(loc.id + b.id))
}
// at: [{ t, tw, x, y, w, h }] — 영상의 그 시각(t ± tw초)에만 그 자리에 있는 단서
const pick = (h) => ({ x: h?.x ?? null, y: h?.y ?? null, w: h?.w ?? null, h: h?.h ?? null, at: (h?.at ?? []).filter((a) => a.x != null) })
export const DEFAULT_TW = 1.5
export const isTimed = (spot) => spot.at?.length > 0
export const isPlaced = (spot) => isTimed(spot) || spot.x != null
export const inRect = (r, fx, fy) => fx >= r.x && fx <= r.x + (r.w ?? 0.12) && fy >= r.y && fy <= r.y + (r.h ?? 0.12)
// 지금 시각에 보이는 영역 (시간 지정이 없으면 언제나)
export function activeRects(spot, t) {
  if (isTimed(spot)) return spot.at.filter((a) => t != null && Math.abs(t - a.t) <= (a.tw ?? DEFAULT_TW))
  return spot.x != null ? [spot] : []
}
function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
export function hitSpot(spots, fx, fy, t = null) {
  return spots.find((s) => activeRects(s, t).some((r) => inRect(r, fx, fy)))
}

// 인물에게 단서를 내밀었을 때: flip.anyOf = [{clues:[a]}, {clues:[b, c]}] 중 한 묶음을 모두 포함하면 성공
export function presentWorks(ch, clueIds) {
  const set = new Set(clueIds)
  // Firestore는 배열 안의 배열을 못 담으므로 묶음은 { clues: [...] } 형태 (예전 배열 형태도 허용)
  return (ch.flip?.anyOf ?? []).some((group) => (Array.isArray(group) ? group : group.clues ?? []).every((id) => set.has(id)))
}

export function statementLocked(scenario, run, ch) {
  // 결정 1에서 서명하면 관리인이 입을 닫는다
  for (const d of scenario.decisions ?? []) {
    const opt = d.options.find((o) => o.id === run.decisions[d.id])
    if (opt?.effect?.lockStatement === ch.id) return true
  }
  const lim = wrongLimitOf(scenario, run)
  return lim != null && (run.wrong[ch.id] ?? 0) >= lim
}

// 틀린 단서를 내밀 수 있는 횟수 (null = 제한 없음). 난이도에 값(0 = 제한 없음)이 없으면 입문 무제한·표준 3·심화 2.
const WRONG_DEFAULT = { intro: null, standard: 3, advanced: 2 }
export function wrongLimitOf(scenario, run) {
  const v = levelOf(scenario, run).wrongPresentLimit
  if (v === 0 || v === null) return null
  if (v != null) return v
  return run?.level in WRONG_DEFAULT ? WRONG_DEFAULT[run.level] : scenario.settings?.wrongPresentLimit ?? 3
}

export function findLink(scenario, a, b) {
  return (scenario.links ?? []).find((l) => (l.clues[0] === a && l.clues[1] === b) || (l.clues[0] === b && l.clues[1] === a)) ?? null
}

export function linkLimitOf(scenario, run) {
  return levelOf(scenario, run).linkLimit ?? null
}

// 도달한 진실의 겹 (결과 화면용)
export function layersReached(scenario, run) {
  const links = new Set(run.links)
  return (scenario.layers ?? []).filter((ly, i) => i === 0 || (ly.byLinks ?? []).some((id) => links.has(id)) || (ly.byFlip ?? []).some((id) => run.flipped[id]))
}

// 결정 5(보류 결재 공개)는 반려 공문을 찾은 사람에게만
export function decisionAvailable(scenario, run, d) {
  if (d.requiresClue && !run.found.includes(d.requiresClue)) return false
  if (d.skipIfFlipped && run.flipped[d.skipIfFlipped]) return false
  if (d.requiresAnswer) {
    const [k, v] = Object.entries(d.requiresAnswer)[0]
    if (Array.isArray(v) ? !v.includes(run.report[k]) : run.report[k] !== v) return false
  }
  return true
}

export function timelineCardTime(scenario, run, card) {
  const knows = (ids) => (ids ?? []).some((id) => run.found.includes(id) || run.flipped[id])
  const lv = levelOf(scenario, run)
  if (knows(card.revealBy)) return lv.clockSkew === false && card.timeNoSkew ? card.timeNoSkew : card.time
  // 기록 장치 시각만 아는 경우: 시계 오차가 있는 난이도에서는 틀린 기록 시각(timeAlt)이 보인다
  if (knows(card.altBy)) return lv.clockSkew === false ? card.timeNoSkew ?? card.time : card.timeAlt ?? null
  return null
}

export function timelineScore(scenario, run) {
  const correct = [...(scenario.timeline?.cards ?? [])].sort((a, b) => a.order - b.order).map((c) => c.id)
  const mine = run.timeline ?? []
  return mine.filter((id, i) => correct[i] === id).length
}

// 보고서 → 결말
export function decideEnding(scenario, run) {
  const q = Object.fromEntries((scenario.report?.questions ?? []).map((x) => [x.id, x]))
  const who = run.report.who
  if (who === q.who?.machineOption) return 'machine'
  if (who !== q.who?.answer) return 'convenient'
  const allRight = ['who', 'when', 'why'].every((k) => run.report[k] === q[k]?.answer)
  if (allRight && run.decisions.d5 === 'disclose') return 'whole'
  if (run.decisions.d3 === 'anonymous') return 'anonymous'
  return 'half'
}
