// AI 피드백 프롬프트/조립을 이 파일 하나로 모은다. 캐릭터 이름(역할극 배역)은
// 절대 모델에 전달하지 않는다 — 애초에 없는 정보는 새어 나올 수 없다.
// 형식(소제목 4개)도 모델의 자유 텍스트 순응에 맡기지 않고, JSON 스키마로 강제한
// 뒤 서버가 최종 문구를 직접 조립한다.
function buildPrompt({ nickname, scenarioTitle, endingTitle, endingMessage, qaPairs }) {
  return [
    `학생 닉네임: ${nickname}`,
    `시나리오: ${scenarioTitle}`,
    `이 학생이 도달한 결말: ${endingTitle} — ${endingMessage}`,
    '학생의 성찰 답변:',
    ...qaPairs.map((qa, i) => `Q${i + 1}. ${qa.question}\nA${i + 1}. ${qa.answer || '(무응답)'}`),
    '',
    '위 성찰 답변을 바탕으로 윤리 교사가 참고할 분석 리포트를 한국어로 작성해줘.',
    '반드시 지킬 것:',
    `- 학생을 지칭할 때는 오직 닉네임 "${nickname}"만 사용한다. 그 외의 어떤 이름도 학생을 가리키는 데 쓰지 않는다.`,
    '- 학생에게 다정하게 말을 거는 편지/코멘트 톤이 아니라, 답변을 객관적으로 분석하는 보고서 톤으로 쓴다(예: "~하는 경향이 보인다", "~로 판단된다"). "~해줘서 고마워요" 같은 구어체 인사말은 쓰지 않는다.',
    '- answerAnalysis: 학생이 각 질문에 어떤 논리와 근거로 답했는지 객관적으로 요약(2~3문장)',
    '- strengths: 답변에서 드러난 사고의 강점을 학생이 실제로 쓴 표현을 인용하며 구체적으로 서술(2~3문장)',
    '- growthPoints: 더 깊이 고민해보면 좋을 지점을 질문 형태로 1~2가지 제시(1~2문장)',
    '- overallEvaluation: 전체적인 이해도와 성찰 수준에 대한 요약 평가(1~2문장)',
    '아래 JSON 스키마로만 응답한다: {"answerAnalysis": string, "strengths": string, "growthPoints": string, "overallEvaluation": string}',
  ].join('\n')
}

function assembleFeedbackText(parsed) {
  return [
    `**답변 분석**\n${parsed.answerAnalysis ?? ''}`,
    `**강점**\n${parsed.strengths ?? ''}`,
    `**성장 포인트**\n${parsed.growthPoints ?? ''}`,
    `**종합 평가**\n${parsed.overallEvaluation ?? ''}`,
  ].join('\n\n')
}

module.exports = { buildPrompt, assembleFeedbackText }
