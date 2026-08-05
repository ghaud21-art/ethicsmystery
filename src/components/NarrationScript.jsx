import { useState } from 'react'

export default function NarrationScript({ title, lines, characters }) {
  const [open, setOpen] = useState(false)
  const speakerName = (speaker) => characters?.find((c) => c.id === speaker)?.name ?? speaker

  return (
    <div className="card">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0 }}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong style={{ fontFamily: 'var(--font-head)' }}>{title}</strong>
          <span className="dim" style={{ fontSize: 12 }}>{open ? '접기 ▲' : '다 함께 소리 내어 읽어보세요 ▼'}</span>
        </div>
      </button>
      {open && (
        <div className="col" style={{ marginTop: 12 }}>
          {lines.map((l, i) => (
            <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--gold-light)' }}>{speakerName(l.speaker)}</strong>: {l.line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
