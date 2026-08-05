export default function AccusationForm({ characters, value, onChange, disabled }) {
  return (
    <div className="card col">
      <h4>범인을 지목하세요</h4>
      <div className="row">
        {characters.map((c) => (
          <button
            key={c.id}
            className={value === c.id ? 'primary' : ''}
            onClick={() => onChange(c.id)}
            disabled={disabled}
          >
            {c.name}
          </button>
        ))}
        <button className={value === 'unknown' ? 'primary' : ''} onClick={() => onChange('unknown')} disabled={disabled}>
          모르겠다
        </button>
      </div>
    </div>
  )
}
