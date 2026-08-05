export default function MoralChoiceForm({ prompt, value, onChange, disabled }) {
  const options = [
    { id: 'reveal_all', label: '모두 공개했다' },
    { id: 'conceal_some', label: '일부는 덮었다' },
  ]
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
