// 탐문 수사(1인 문답 추리)의 진행 상태 — 1인용 머더미스터리(soloRun)와 같은 이유로
// localStorage에 저장한다. 새로고침/뒤로가기에도 문답 기록과 문 수가 유지된다.
const KEY_PREFIX = 'ethicsmystery.tanmunRun.'

export function newTanmunRun(scenarioId) {
  return {
    scenarioId,
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

export const QUESTION_CAP = 50 // 이 문 수에 도달하면 질문 마감 — 최종 답안 1회만 남는다
export const CLUE_INTERVAL = 15 // 15문마다 단서 1장 공개
export const EMERGENCY_CLUE_COST = 10 // 긴급 단서 열람 비용(문)
export const WRONG_ATTEMPT_PENALTY = 5 // 오답 제출 페널티(문)

// 미해결 종료 페널티: 기본 +25문, 채점 슬롯 1개 적중당 -4문 감면(최소 +10문 유지)
export function unresolvedPenalty(bestSlotHits) {
  return Math.max(10, 25 - 4 * bestSlotHits)
}

const GRADES = [
  { grade: 'S', max: 15, title: '진실의 대가' },
  { grade: 'A', max: 25, title: '베테랑 수사관' },
  { grade: 'B', max: 35, title: '촉이 좋은 형사' },
  { grade: 'C', max: 45, title: '끈기의 수사관' },
  { grade: 'D', max: Infinity, title: '미제 사건 전담' },
]

export function gradeForScore(score) {
  return GRADES.find((g) => score <= g.max)
}

export const VERDICT_STYLES = {
  네: { color: '#4caf7d', background: 'rgba(76,175,125,.12)' },
  아니오: { color: '#e05d5d', background: 'rgba(224,93,93,.12)' },
  그럴수도: { color: '#d9b23d', background: 'rgba(217,178,61,.12)' },
  중요하지않음: { color: '#9a9a9a', background: 'rgba(154,154,154,.12)' },
  반려: { color: 'var(--ink-dim)', background: 'transparent' },
}
