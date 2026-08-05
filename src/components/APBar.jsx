export default function APBar({ current, max }) {
  return (
    <div className="row">
      <strong>AP</strong>
      <span>
        {current} / {max}
      </span>
      <div style={{ flex: 1, height: 8, background: 'var(--panel-border)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${max > 0 ? (current / max) * 100 : 0}%`,
            height: '100%',
            background: 'var(--accent-2)',
          }}
        />
      </div>
    </div>
  )
}
