// AI 피드백 프롬프트/검증을 이 파일 하나로 모은다. 캐릭터 이름(역할극 배역)은
// 절대 모델에 전달하지 않는다 — 애초에 없는 정보는 새어 나올 수 없다.
// 형식(5개 필드)도 모델의 자유 텍스트 순응에 맡기지 않고 JSON 스키마로 강제한다.
// 클라이언트는 이 5개 필드를 직접 렌더링하므로(AiFeedbackView.jsx) 마크다운
// 문법(**) 같은 걸 절대 값 안에 포함하지 말라고도 명시한다.
const FIELDS = ['answerAnalysis', 'strengths', 'growthPoints', 'extendedQuestion', 'overallEvaluation']

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
    '- 학생에게 다정하게 말을 거는 편지/코멘트 톤이 아니라, 답변을 객관적으로 분석하는 보고서 톤의 줄글로 쓴다(예: "~하는 경향이 보인다", "~로 판단된다"). "~해줘서 고마워요" 같은 구어체 인사말은 쓰지 않는다.',
    '- 각 필드 값에는 **, #, - 같은 마크다운 기호나 소제목을 절대 포함하지 않는다. 순수한 문장으로만 쓴다.',
    '- answerAnalysis: 학생이 각 질문에 어떤 논리와 근거로 답했는지 객관적으로 요약(2~3문장)',
    '- strengths: 답변에서 드러난 사고의 강점을 학생이 실제로 쓴 표현을 인용하며 구체적으로 서술(2~3문장)',
    '- growthPoints: 더 깊이 고민해보면 좋을 지점을 서술형으로 제시(1~2문장, 질문 형태로 쓰지 않는다)',
    '- extendedQuestion: 이 학생의 사고를 확장시킬 수 있는 추가 질문을 하나 제시(1문장, 물음표로 끝나는 질문 형태)',
    '- overallEvaluation: 전체적인 이해도와 성찰 수준에 대한 요약 평가(1~2문장)',
    `아래 JSON 스키마로만 응답한다: {${FIELDS.map((f) => `"${f}": string`).join(', ')}}`,
  ].join('\n')
}

// 모델이 필드를 누락하거나 이상한 타입을 반환해도 클라이언트가 안전하게
// 렌더링할 수 있도록 문자열로 정규화한다.
function normalizeFeedback(parsed) {
  const result = {}
  for (const field of FIELDS) result[field] = typeof parsed?.[field] === 'string' ? parsed[field] : ''
  return result
}

module.exports = { buildPrompt, normalizeFeedback }
