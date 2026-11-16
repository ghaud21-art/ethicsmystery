import { useMr } from './common'

// 수첩·단서함에 쌓이는 증거: AI 기록관에게서 찾은 사실, 단서 보드에서 연 단서, 대질 신문에서 열린 증거.
export function collectEvidence(room, data) {
  const groups = []
  for (const [sid, sc] of Object.entries(room.scenes)) {
    const p = sc.puzzle
    if (!p) continue
    const b = data?.boards?.[sid] ?? {}
    if (p.module === 'tanmun') {
      const items = (p.config.facts ?? []).filter((f) => b.found?.[f.id]).map((f) => ({ title: f.title, text: f.text }))
      if (items.length) groups.push({ key: sid, label: 'AI 기록관에게서 찾은 사실', items })
    }
    if (p.module === 'clueboard') {
      const items = (p.config.cards ?? [])
        .filter((c) => b.opened?.[c.id] && (!c.lock || b.solved?.[c.id]))
        .map((c) => ({ title: c.title.replace(/^잠긴 금고:\s*/, ''), text: c.lock ? c.lock.solvedText ?? c.lock.answer?.[0] : c.text }))
      if (items.length) groups.push({ key: sid, label: '청문회장에서 연 단서', items })
    }
    if (p.module === 'hearing') {
      const items = (p.config.turns ?? []).filter((t) => b.cracked?.[t.role]).map((t) => ({ title: t.reward.title, text: t.reward.text }))
      if (b.interject === 'done' && p.config.interject?.reward) items.push(p.config.interject.reward)
      if (items.length) groups.push({ key: sid, label: '대질 신문에서 열린 증거', items })
    }
  }
  return groups
}

export default function EvidenceList({ compact }) {
  const { room, mr } = useMr()
  const groups = collectEvidence(room, mr.data)
  if (!groups.length) return null
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="col" style={{ gap: 6 }}>
          <strong style={{ fontSize: compact ? 12 : 13 }}>{g.label} {g.items.length}</strong>
          {g.items.map((it, i) => (
            <div key={i} className="mr-mat" style={{ marginBottom: 0 }}>
              <div className="mr-mat-title"><span>{it.title}</span></div>
              <p style={{ whiteSpace: 'pre-line' }}>{it.text}</p>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
