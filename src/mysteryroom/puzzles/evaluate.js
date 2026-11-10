// 퍼즐 채점. 화면 코드와 분리된 순수 함수다.
// 반환: { correct, hits, total, why, tainted? }
// why: 틀린 항목 하나의 이유(whyNot). 어느 카드가 틀렸는지 직접 짚지 않고 이유만 보여 준다.

const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase()

function placementResult(cards, placements, keyOf) {
  let hits = 0
  let why = null
  for (const c of cards) {
    const want = keyOf(c) ?? null
    const got = placements?.[c.id] ?? null
    if (want === got) hits++
    else if (!why && got !== null && c.whyNot) why = c.whyNot
  }
  return { hits, total: cards.length, why }
}

export function evaluateClassify(config, board) {
  const r = placementResult(config.cards, board?.placements, (c) => c.bin)
  return { ...r, correct: r.hits === r.total }
}

export function evaluateScale(config, board) {
  const opt = board?.option
  const net = Number(board?.net)
  const okOpt = opt === config.answer.optionId
  const okNet = Number.isFinite(net) && net === config.answer.net
  return {
    correct: okOpt && okNet,
    hits: (okOpt ? 1 : 0) + (okNet ? 1 : 0),
    total: 2,
    why: !okOpt || !okNet ? '만족 합계에서 고통 합계를 뺀 값을 선택지마다 다시 계산해 보세요.' : null,
  }
}

export function evaluateVerify(config, board) {
  if (config.mode === 'diagnose') {
    // 원인은 하나(correctId) 또는 여러 개(correctIds, pick개 고르기)일 수 있다.
    const multi = Array.isArray(config.cause.correctIds)
    const picked = multi ? Object.keys(board?.causes ?? {}).filter((k) => board.causes[k]) : [board?.cause].filter(Boolean)
    const want = multi ? config.cause.correctIds : [config.cause.correctId]
    const okC = picked.length === want.length && want.every((id) => picked.includes(id))
    const wrongCause = config.cause.options.find((o) => picked.includes(o.id) && !want.includes(o.id))
    const remedy = config.remedy.options.find((o) => o.id === board?.remedy)
    const okR = board?.remedy === config.remedy.correctId
    // 거짓 출구 개선안: 원인은 맞혔는데 겉으로만 고치는 개선안을 고르면 문은 열리되 단서가 오염된다.
    if (okC && remedy?.tainted) {
      return { correct: true, tainted: true, hits: 1, total: 2, why: remedy.whyNot ?? null }
    }
    return {
      correct: okC && okR,
      hits: (okC ? 1 : 0) + (okR ? 1 : 0),
      total: 2,
      why: (!okC && (wrongCause?.whyNot || (multi && picked.length !== want.length ? `원인을 ${want.length}개 골라야 합니다.` : null))) || (!okR && remedy?.whyNot) || null,
    }
  }
  // pick
  const picked = Object.keys(board?.picked ?? {}).filter((k) => board.picked[k])
  const want = new Set(config.correctIds)
  const hits = picked.filter((id) => want.has(id)).length
  const exact = picked.length === config.pickCount && hits === config.correctIds.length
  const wrongDoc = config.docs.find((d) => picked.includes(d.id) && !want.has(d.id))
  if (picked.length !== config.pickCount) {
    return { correct: false, hits, total: config.pickCount, why: `자료 ${config.pickCount}개를 골라야 합니다.` }
  }
  // taintIds: 이 자료들로만(정답 자료와 섞여도) 고르면 문은 열리지만 단서가 오염된다(거짓 출구).
  // 그 밖의 자료가 섞이면 오답이다.
  if (!exact && config.taintIds) {
    const okish = picked.every((id) => want.has(id) || config.taintIds.includes(id))
    if (okish) return { correct: true, tainted: true, hits, total: config.pickCount, why: wrongDoc?.note ?? null }
    const hard = config.docs.find((d) => picked.includes(d.id) && !want.has(d.id) && !config.taintIds.includes(d.id))
    return { correct: false, hits, total: config.pickCount, why: hard?.note ?? null }
  }
  if (!exact && config.acceptAnyPair) {
    return { correct: true, tainted: true, hits, total: config.pickCount, why: wrongDoc?.note ?? null }
  }
  return { correct: exact, hits, total: config.pickCount, why: exact ? null : wrongDoc?.note ?? null }
}

export function evaluateTest(config, board) {
  const r = placementResult(config.cards, board?.placements, (c) => (c.testId ? config.slots.find((s) => s.testId === c.testId)?.id : null))
  // 검사 결과(results)가 있으면 두 단계로 푼다:
  //   1단계 검사 질문 카드를 칸에 놓고 제출 → 맞으면 검사 결과가 공개된다(stagePass, 실패로 세지 않음)
  //   2단계 결과를 읽고 수정 원리를 골라 제출
  if (config.results && !board?.stage2) {
    if (r.hits === r.total) return { correct: false, stagePass: true, hits: r.hits, total: r.total, why: null }
    return { correct: false, hits: r.hits, total: r.total, why: r.why }
  }
  const okPrinciple = board?.principle === config.correctPrincipleId
  const pc = config.principleChoices.find((p) => p.id === board?.principle)
  if (config.results) {
    return { correct: okPrinciple && r.hits === r.total, hits: okPrinciple ? 1 : 0, total: 1, why: okPrinciple ? null : pc?.whyNot ?? '수정 원리를 골라 주세요.' }
  }
  return {
    correct: r.hits === r.total && okPrinciple,
    hits: r.hits + (okPrinciple ? 1 : 0),
    total: r.total + 1,
    why: r.why || (!okPrinciple && pc?.whyNot) || null,
  }
}

export function evaluateOrder(config, board) {
  const r = placementResult(config.cards, board?.placements, (c) => c.slot)
  const trap = config.cards.find((c) => !c.slot && board?.placements?.[c.id])
  return {
    ...r,
    correct: r.hits === r.total,
    why: trap ? [trap.whyNot, trap.rubricEcho && `채점기준: ‘${trap.rubricEcho}’`].filter(Boolean).join(' ') : r.why,
  }
}

export function evaluateLock(config, board) {
  const answers = Array.isArray(config.answer) ? config.answer : [config.answer]
  const ok = answers.some((a) => norm(a) === norm(board?.value))
  return { correct: ok, hits: ok ? 1 : 0, total: 1, why: ok ? null : config.wrongHint ?? null }
}

// 아이디어 방: 각자 한 줄 아이디어를 내고, 모두 공개된 뒤 가장 기발한 것에 투표한다.
// 모두 내고 모두 투표하면 통과. 가장 많이 표를 받은 아이디어(동점이면 모두)가 뽑힌다.
export function evaluateIdea(config, board) {
  const ideas = board?.ideas ?? {}
  const votes = board?.votes ?? {}
  const authors = Object.keys(ideas).filter((u) => norm(ideas[u]?.text).length >= (config.minChars ?? 5))
  if (!authors.length) return { correct: false, hits: 0, total: 1, why: '아이디어를 한 줄씩 적어 주세요.' }
  const voters = Object.keys(votes).filter((u) => authors.includes(votes[u]))
  if (voters.length < authors.length) return { correct: false, hits: 0, total: 1, why: '모두 한 표씩 투표해야 합니다.' }
  const count = {}
  voters.forEach((u) => (count[votes[u]] = (count[votes[u]] ?? 0) + 1))
  const max = Math.max(...Object.values(count))
  const winner = Object.keys(count).filter((u) => count[u] === max).map((u) => ideas[u].text)
  return { correct: true, hits: 1, total: 1, why: null, winner }
}

// 협력 퀴즈: 여러 문제를 모두 맞혀야 통과. 문제마다 객관식(answerId) 또는 단답(answer 배열).
// 틀리면 맞은 개수와, 첫 번째로 틀린 문제의 힌트(hint)를 알려 준다.
export function evaluateQuiz(config, board) {
  const answers = board?.answers ?? {}
  let hits = 0
  let why = null
  config.questions.forEach((q, i) => {
    const a = answers[q.id]
    const ok = q.options ? a === q.answerId : (q.answer ?? []).some((x) => norm(x) === norm(a))
    if (ok) hits++
    else if (!why) why = `${i + 1}번 문제를 다시 보세요.${q.hint ? ' ' + q.hint : ''}`
  })
  return { correct: hits === config.questions.length, hits, total: config.questions.length, why }
}

const EVALUATORS = {
  quiz: evaluateQuiz,
  idea: evaluateIdea,
  classify: evaluateClassify,
  scale: evaluateScale,
  verify: evaluateVerify,
  test: evaluateTest,
  order: evaluateOrder,
  lock: evaluateLock,
}

export function evaluatePuzzle(puzzle, board) {
  const fn = EVALUATORS[puzzle.module]
  if (!fn) throw new Error(`알 수 없는 퍼즐: ${puzzle.module}`)
  return fn(puzzle.config, board)
}

export const PUZZLE_MODULES = Object.keys(EVALUATORS)
