export default function MoralChoiceForm({ prompt, value, onChange, disabled }) {
  return (
    <div className="card col">
      <h4>{prompt}</h4>
      <div className="row">
        <button className={value === 'reveal_all' ? 'primary' : ''} onClick={() => onChange('reveal_all')} disabled={disabled}>
          모두 공개했다
        </button>
        <button className={value === 'conceal_some' ? 'primary' : ''} onClick={() => onChange('conceal_some')} disabled={disabled}>
          일부는 덮었다
        </button>
      </div>
    </div>
  )
}
