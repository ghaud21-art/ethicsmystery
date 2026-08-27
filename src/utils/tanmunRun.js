// 탐문 수사(1인 문답 추리)의 진행 상태 — 1인용 머더미스터리(soloRun)와 같은 이유로
// localStorage에 저장한다. 새로고침/뒤로가기에도 문답 기록과 문 수가 유지된다.
const KEY_PREFIX = 'ethicsmystery.tanmunRun.'

export function newTanmunRun(scenarioId, playerName = '') {
  return {
    scenarioId,
    playerName,
    step: 'play', // play -> ended
    questionCount: 0, // 누적 "문" 수 — 판정된 질문 +1, 오답 제출 +5, 긴급 단서 +10, 미해결 종료 페널티 포함
    log: [], // { type: 'question', text, verdict } | { type: 'clue', index } | { type: 'attempt', text, slotHits, bonusHit }
    cluesRevealed: 0,
    bestSlotHits: 0,
    solved: false,
    bonusHit: false,
    finalScore: null,
    startedAt: Date.now(),
  }
}

export function saveTanmunRun(scenarioId, run) {
  localStorage.setItem(KEY_PREFIX + scenarioId, JSON.stringify(run))
}

export function getTanmunRun(scenarioId) {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFIX + scenarioId))
  } catch {
    return null
  }
}

export function clearTanmunRun(scenarioId) {
  localStorage.removeItem(KEY_PREFIX + scenarioId)
}

// 단서 자동 공개 간격(문) — 기본 15문마다 1장. 난이도 보정으로 간격을 줄이는
// 시나리오(clueInterval)가 우선한다.
export function getClueInterval(scenario) {
  return scenario?.clueInterval ?? 15
}

export const EMERGENCY_CLUE_COST = 10 // 긴급 단서 열람 비용(문)
export const WRONG_ATTEMPT_PENALTY = 5 // 오답 제출 페널티(문)
// 최종 추리는 총 3회까지 — 3회 모두 빗나가면 포기 없이도 수사가 종료되고,
// 적중한 슬롯 수만큼 감면된 미해결 페널티로 등급이 매겨진다.
export const MAX_DEDUCTION_ATTEMPTS = 3

// 질문 마감 문 수 — 이 문 수에 도달하면 최종 답안 1회만 남는다. 난이도 상
// 시나리오는 상한을 높일 수 있으므로 시나리오 데이터(questionCap)가 우선한다.
export function getQuestionCap(scenario) {
  return scenario?.questionCap ?? 50
}

// 미해결 종료 페널티: 기본 +25문, 채점 슬롯 1개 적중당 -4문 감면(최소 +10문 유지)
export function unresolvedPenalty(bestSlotHits) {
  return Math.max(10, 25 - 4 * bestSlotHits)
}

// 기본 등급 컷 — 시나리오가 grades([{grade,max,title}], 마지막 항목은 max 생략
// 가능)를 정의하면 그것이 우선한다(난이도별 보정용).
const DEFAULT_GRADES = [
  { grade: 'S', max: 15, title: '진실의 대가' },
  { grade: 'A', max: 25, title: '베테랑 수사관' },
  { grade: 'B', max: 35, title: '촉이 좋은 형사' },
  { grade: 'C', max: 45, title: '끈기의 수사관' },
  { grade: 'D', max: Infinity, title: '미제 사건 전담' },
]

export function getGrades(scenario) {
  const grades = scenario?.grades ?? DEFAULT_GRADES
  return grades.map((g) => ({ ...g, max: g.max ?? Infinity }))
}

export function gradeForScore(score, scenario) {
  const grades = getGrades(scenario)
  return grades.find((g) => score <= g.max) ?? grades[grades.length - 1]
}

// 인트로/규칙 화면용 등급 요약 문자열 (예: "S ≤15문 · A ≤25문 · ... · D 46문 이상")
export function gradeLineText(scenario) {
  const grades = getGrades(scenario)
  return grades
    .map((g, i) =>
      g.max === Infinity ? `${g.grade} ${(grades[i - 1]?.max ?? 0) + 1}문 이상` : `${g.grade} ≤${g.max}문`,
    )
    .join(' · ')
}

export const VERDICT_STYLES = {
  네: { color: '#4caf7d', background: 'rgba(76,175,125,.12)' },
  아니오: { color: '#e05d5d', background: 'rgba(224,93,93,.12)' },
  그럴수도: { color: '#d9b23d', background: 'rgba(217,178,61,.12)' },
  중요하지않음: { color: '#9a9a9a', background: 'rgba(154,154,154,.12)' },
  반려: { color: 'var(--ink-dim)', background: 'transparent' },
}
