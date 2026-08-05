const STEPS = ['사건 접수', '역할 확인', '현장 조사', '범인 지목', '수사 종결']

// activeIndex: 0-based index into STEPS
export default function StepProgress({ activeIndex }) {
  return (
    <div className="step-track">
      <div className="step-track-line" />
      <div className="step-track-row">
        {STEPS.map((label, i) => (
          <div className="step-item" key={label}>
            <div className={`step-node ${i === activeIndex ? 'active' : i < activeIndex ? 'done' : ''}`}>
              {i + 1}
            </div>
            <div className={`step-label ${i === activeIndex ? 'active' : ''}`}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
