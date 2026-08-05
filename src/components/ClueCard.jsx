export default function ClueCard({ clue, clueState, visible, canClaim, comboReady, canPublish, onClaim, onPublish, players }) {
  const claimedByName = clueState?.claimedBy ? players?.[clueState.claimedBy]?.name : null
  const claimedByMe = clueState?.claimedBy && visible
  const isCombo = clue.unlockType === 'combo'
  const comboLocked = isCombo && !clueState?.claimedBy && !comboReady

  return (
    <div className="card col" style={{ marginBottom: 0, opacity: comboLocked ? 0.6 : 1 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 700 }}>
          {isCombo ? '조합 단서' : (clue.location ?? '단서')}
        </div>
        {clue.isCriticalClue && <span className="pill pill-solid">핵심 단서</span>}
      </div>

      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 15 }}>{clue.title}</div>

      {comboLocked ? (
        <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
          🔒 {clue.unlockNote ?? '선행 단서를 먼저 확보해야 조합할 수 있습니다.'}
        </p>
      ) : visible ? (
        <>
          <p className="dim" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{clue.content}</p>
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>{clue.implication}</p>
          {claimedByMe && clueState?.publishedToRoom && (
            <span className="pill pill-solid" style={{ alignSelf: 'flex-start' }}>공개됨 · 모두에게 보임</span>
          )}
          {canPublish && (
            <button onClick={onPublish} style={{ alignSelf: 'flex-start' }}>이 단서 공개하기</button>
          )}
        </>
      ) : clueState?.claimedBy ? (
        <p className="dim" style={{ margin: 0, fontSize: 12 }}>{claimedByName ?? '다른 플레이어'}가 이미 조사했습니다.</p>
      ) : (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="pill pill-muted">AP {clue.apCost}</span>
          <button className="primary" onClick={onClaim} disabled={!canClaim}>
            {isCombo ? '조합 확보' : '단서 확보'}
          </button>
        </div>
      )}
    </div>
  )
}
