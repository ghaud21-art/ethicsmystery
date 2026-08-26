// 탐문 수사(1인 예/아니오 문답 추리) 콘텐츠의 AI 기록관/채점관 프롬프트.
// 판정의 유일한 근거는 시나리오 문서의 truth(진상 전문)와 canonicalFacts(확정 사실)다.

const VERDICTS = ['네', '아니오', '그럴수도', '중요하지않음', '반려']

function buildJudgePrompt({ truth, canonicalFacts, fewShots, question }) {
  const factsText = (canonicalFacts ?? []).map((f) => `- ${f}`).join('\n')
  const fewShotText = (fewShots ?? [])
    .map((ex) => `질문: ${ex.question}\n판정: ${ex.verdict}`)
    .join('\n\n')

  return `너는 추리 게임 '탐문 수사'의 기록관이다. 아래 [진상]과 [확정 사실]만을 근거로, 플레이어의 질문 하나를 판정한다.

규칙:
1. 질문이 예/아니오로 답할 수 없는 개방형(왜, 어떻게, 누가, 무엇 등)이면 "반려".
2. 진상과 일치하면 "네", 모순되면 "아니오".
3. 참·거짓이 섞였거나 진상에 명시되지 않아 단정할 수 없으면 "그럴수도".
4. 판정은 가능하지만 진상 도달에 무관한 사소한 사항이면 "중요하지않음".
5. 진상을 유추할 수 있는 어떠한 부가 설명도 하지 마라. 오직 아래 JSON만 출력한다.
6. 진상에 없는 내용을 추측해서 "네"라고 답하지 마라. 모르면 "그럴수도".

출력 형식(JSON only):
{"verdict": "네" | "아니오" | "그럴수도" | "중요하지않음" | "반려"}

[진상]
${truth}

[확정 사실]
${factsText}

[판정 예시]
${fewShotText}

[플레이어 질문]
${question}`
}

function normalizeVerdict(parsed) {
  const v = parsed?.verdict
  return VERDICTS.includes(v) ? v : '그럴수도'
}

function buildGradePrompt({ truth, slots, bonusRule, deduction }) {
  const slotsText = (slots ?? [])
    .map((s, i) => `${i + 1}. [${s.name}] 인정 기준: ${s.criteria}`)
    .join('\n')

  return `너는 추리 게임 '탐문 수사'의 채점관이다. 플레이어가 제출한 최종 추리 서술을 아래 [진상]과 [채점 슬롯]에 비추어 채점한다.

규칙:
1. 각 슬롯마다, 플레이어 서술이 그 슬롯의 인정 기준과 "요지가 일치"하면 적중(true)이다 — 표현은 자유이며 정확한 단어를 요구하지 않는다.
2. 단, 인정 기준에 특정 단어의 명시가 요구되어 있으면(예: "~중 하나 이상 명시") 그 조건을 그대로 적용한다.
3. 서술에 없는 내용을 호의적으로 채워서 적중 처리하지 마라 — 서술에 실제로 담긴 내용만 본다.
4. 보너스 기준이 주어진 경우, 그 기준의 충족 여부도 판정한다.
5. 오직 아래 JSON만 출력한다.

출력 형식(JSON only):
{"slotHits": [true|false, ...슬롯 수만큼], "bonusHit": true|false}

[진상]
${truth}

[채점 슬롯]
${slotsText}

[보너스 기준]
${bonusRule ?? '(없음)'}

[플레이어 최종 추리]
${deduction}`
}

function normalizeGrade(parsed, slotCount) {
  const raw = Array.isArray(parsed?.slotHits) ? parsed.slotHits : []
  const slotHits = Array.from({ length: slotCount }, (_, i) => raw[i] === true)
  return { slotHits, bonusHit: parsed?.bonusHit === true }
}

module.exports = { buildJudgePrompt, normalizeVerdict, buildGradePrompt, normalizeGrade }
