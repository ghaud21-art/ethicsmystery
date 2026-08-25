// 시나리오에 딸린 참고 규정/판정 기준표 — "전원 언제든 열람 가능"한 게임 내 자료를
// 보여준다. misconduct/questionablePractice 두 그룹으로 나뉘는 구조를 기본으로 하되,
// 앞으로 다른 시나리오가 다른 구조를 쓸 수도 있으므로 없는 필드는 조용히 건너뛴다.
export default function JudgingReferenceModal({ reference, onClose }) {
  const groups = [reference.misconduct, reference.questionablePractice].filter(Boolean)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{reference.title ?? '판정 기준'}</div>
        <div className="col" style={{ gap: 14 }}>
          {groups.map((group, i) => (
            <div key={i} className="col" style={{ gap: 6 }}>
              <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>{group.label}</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {group.items?.map((item, j) => (
                  <li key={j} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
          {reference.note && <p className="dim" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{reference.note}</p>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
