const FIELDS = [
  ['answerAnalysis', '답변 분석'],
  ['strengths', '강점'],
  ['growthPoints', '성장 포인트'],
  ['extendedQuestion', '생각해보면 좋을 질문'],
  ['overallEvaluation', '종합 평가'],
]

// aiFeedback은 { answerAnalysis, strengths, growthPoints, extendedQuestion,
// overallEvaluation } 구조화 객체다. 예전 데이터가 문자열로 저장돼 있을 수도
// 있어 그 경우는 그대로 문단으로 보여준다(마이그레이션 없이 하위 호환).
export default function AiFeedbackView({ feedback }) {
  if (!feedback) return null
  if (typeof feedback === 'string') {
    return <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{feedback}</p>
  }
  return (
    <div className="col" style={{ gap: 10 }}>
      {FIELDS.map(([key, label]) =>
        feedback[key] ? (
          <div key={key}>
            <strong style={{ fontSize: 13 }}>{label}</strong>
            <p style={{ fontSize: 13, lineHeight: 1.65, margin: '4px 0 0' }}>{feedback[key]}</p>
          </div>
        ) : null,
      )}
    </div>
  )
}
