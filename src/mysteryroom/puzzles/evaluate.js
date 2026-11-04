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
    const cause = config.cause.options.find((o) => o.id === board?.cause)
    const remedy = config.remedy.options.find((o) => o.id === board?.remedy)
    const okC = board?.cause === config.cause.correctId
    const okR = board?.remedy === config.remedy.correctId
    return {
      correct: okC && okR,
      hits: (okC ? 1 : 0) + (okR ? 1 : 0),
      total: 2,
      why: (!okC && cause?.whyNot) || (!okR && remedy?.whyNot) || null,
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
  if (!exact && config.acceptAnyPair) {
    return { correct: true, tainted: true, hits, total: config.pickCount, why: wrongDoc?.note ?? null }
  }
  return { correct: exact, hits, total: config.pickCount, why: exact ? null : wrongDoc?.note ?? null }
}

export function evaluateTest(config, board) {
  const r = placementResult(config.cards, board?.placements, (c) => (c.testId ? config.slots.find((s) => s.testId === c.testId)?.id : null))
  const okPrinciple = board?.principle === config.correctPrincipleId
  const pc = config.principleChoices.find((p) => p.id === board?.principle)
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

const EVALUATORS = {
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
