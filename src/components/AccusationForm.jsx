export default function AccusationForm({ characters, value, onChange, disabled }) {
  return (
    <div className="col" style={{ marginBottom: 24 }}>
      {characters.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          disabled={disabled}
          style={{
            textAlign: 'left',
            padding: '12px 16px',
            background: value === c.id ? 'rgba(201,162,39,.14)' : 'var(--panel2)',
            border: value === c.id ? '1px solid var(--gold)' : '1px solid var(--line)',
            color: 'var(--ink)',
          }}
        >
          <span style={{ fontWeight: 800, fontFamily: 'var(--font-head)' }}>{c.name}</span>
          <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>{c.role}</span>
        </button>
      ))}
      <button
        onClick={() => onChange('unknown')}
        disabled={disabled}
        style={{
          textAlign: 'left',
          padding: '12px 16px',
          background: value === 'unknown' ? 'rgba(201,162,39,.14)' : 'var(--panel2)',
          border: value === 'unknown' ? '1px solid var(--gold)' : '1px solid var(--line)',
          color: 'var(--ink)',
        }}
      >
        모르겠다
      </button>
    </div>
  )
}
