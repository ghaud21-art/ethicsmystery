import { useEffect, useState } from 'react'

// startedAt: 이 phase가 시작된 시각(ms epoch, room.meta.phaseStartedAt)
// durationMinutes: 제한시간(분)
// onExpire: 처음 0에 도달하는 순간 한 번만 호출
export default function PhaseTimer({ startedAt, durationMinutes, onExpire }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const active = !!startedAt && !!durationMinutes
  const totalMs = (durationMinutes ?? 0) * 60 * 1000
  const remainingMs = active ? Math.max(0, startedAt + totalMs - now) : 0
  const isUp = active && remainingMs <= 0

  useEffect(() => {
    if (isUp) onExpire?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUp])

  if (!active) return null

  const totalSec = Math.ceil(remainingMs / 1000)
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')

  return (
    <span className="ap-badge" style={isUp ? { color: 'var(--blood-light)', background: 'rgba(176,71,58,.16)' } : undefined}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
      {isUp ? '시간 종료' : `${mm}:${ss}`}
    </span>
  )
}
