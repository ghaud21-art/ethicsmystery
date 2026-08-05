export default function APBar({ current, max }) {
  return (
    <span className="ap-badge">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--gold-light)" stroke="none">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
      </svg>
      AP {current}/{max}
    </span>
  )
}
