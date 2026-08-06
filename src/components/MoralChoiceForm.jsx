const DEFAULT_OPTIONS = [
  { id: 'reveal_all', label: '모두 공개하겠다' },
  { id: 'conceal_some', label: '일부는 덮겠다' },
]

// options: 시나리오가 자체 라벨을 제공하면 그걸 쓰고(예: "공개한다"/"은닉한다"),
// 없으면 기존 기본 라벨을 그대로 쓴다 — 값(reveal_all/conceal_some)은 항상 동일해서
// 엔딩 판정 로직은 라벨과 무관하게 그대로 동작한다.
export default function MoralChoiceForm({ prompt, value, onChange, disabled, options = DEFAULT_OPTIONS }) {
  return (
    <div>
      <h2 className="page-title" style={{ fontSize: 19 }}>{prompt}</h2>
      <div className="col" style={{ marginBottom: 24, marginTop: 12 }}>
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            disabled={disabled}
            style={{
              textAlign: 'left',
              padding: '12px 16px',
              background: value === o.id ? 'rgba(201,162,39,.14)' : 'var(--panel2)',
              border: value === o.id ? '1px solid var(--gold)' : '1px solid var(--line)',
              color: 'var(--ink)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
