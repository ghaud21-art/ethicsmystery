// options: [{ id, label, role? }] — resolveAccusationOptions()가 만들어주는 형태.
// role은 캐릭터 옵션일 때만 있고, 부가 설명으로 작게 표시된다.
export default function AccusationForm({ options, value, onChange, disabled }) {
  return (
    <div className="col" style={{ marginBottom: 24 }}>
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
          <span style={{ fontWeight: 800, fontFamily: 'var(--font-head)' }}>{o.label}</span>
          {o.role && <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>{o.role}</span>}
        </button>
      ))}
    </div>
  )
}
