import { useNavigate } from 'react-router-dom'

export default function Masthead({ showBack, onBack }) {
  const navigate = useNavigate()
  return (
    <>
      <div className="masthead">
        <div className="row" style={{ gap: 8 }}>
          {showBack && (
            <button
              onClick={onBack ?? (() => navigate(-1))}
              style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="masthead-title">윤리미스터리 · ETHICSMYSTERY</div>
        </div>
      </div>
      <div className="masthead-rule" />
    </>
  )
}
