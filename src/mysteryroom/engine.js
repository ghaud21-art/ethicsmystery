// 장면 진행 규칙: 관문(gate) 판정, 투표 집계, 등급 계산.

// 관문 조건 문법: 'A&B&C&debate&fails<4' 처럼 &로 잇는다. '*'는 항상 참.
//   A/B/C   해당 단서를 깨끗하게 얻음 (오염된 단서는 거짓)
//   debate  최종 토론 조건 충족
//   fails<N 실패 시도 합계가 N 미만
export function checkCondition(cond, state) {
  if (!cond || cond === '*') return true
  return cond.split('&').every((raw) => {
    const tok = raw.trim()
    const neg = tok.startsWith('!')
    const t = neg ? tok.slice(1) : tok
    let v
    if (t === 'debate') v = !!state?.debateDone
    else if (t.startsWith('fails<')) v = (state?.failedTotal ?? 0) < Number(t.slice(6))
    else v = state?.clues?.[t] === 'clean'
    return neg ? !v : v
  })
}

export function resolveGate(scene, state) {
  return scene.gate.find((g) => checkCondition(g.if, state))?.to ?? null
}

// 선택지 투표: 1회차는 만장일치, 2회차는 다수결, 동수면 방장 표.
export function tallyVotes(votes, playerUids, round, hostUid) {
  const cast = playerUids.map((u) => votes?.[u]).filter((v) => v !== undefined && v !== null)
  if (cast.length < playerUids.length) return { done: false }
  const counts = {}
  cast.forEach((v) => (counts[v] = (counts[v] ?? 0) + 1))
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 1) return { done: true, choice: Number(entries[0][0]) }
  if (round < 2) return { done: true, split: true }
  const top = entries.filter(([, n]) => n === entries[0][1])
  if (top.length === 1) return { done: true, choice: Number(top[0][0]) }
  return { done: true, choice: Number(votes?.[hostUid] ?? top[0][0]) }
}

// 등급: TRUE → SS/S, GOOD → A, BAD → B, 시간 초과 → C
export function computeGrade(endKind, state) {
  if (endKind === 'true') {
    const perfect = (state?.failedTotal ?? 0) <= 1 && !Object.keys(state?.hintsUsed ?? {}).length && !state?.badVisited
    return perfect ? 'SS' : 'S'
  }
  if (endKind === 'good') return 'A'
  if (endKind === 'bad') return 'B'
  return 'C'
}

export const GRADE_TEXT = {
  SS: '완벽한 탈출',
  S: '탈출 성공',
  A: '탈출, 그러나 흔들린 근거',
  B: '함정에 빠짐',
  C: '시간 초과',
}
