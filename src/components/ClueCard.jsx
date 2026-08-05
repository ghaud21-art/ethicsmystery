export default function ClueCard({ clue, clueState, visible, canClaim, canPublish, onClaim, onPublish, players }) {
  const claimedByName = clueState?.claimedBy ? players?.[clueState.claimedBy]?.name : null
  const claimedByMe = clueState?.claimedBy && !!players && visible

  return (
    <div className="card col" style={{ marginBottom: 0 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 700 }}>
          {clue.location ?? '단서'}
        </div>
        {clue.isCriticalClue && <span className="pill pill-solid">핵심 단서</span>}
      </div>

      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 15 }}>{clue.title}</div>

      {visible ? (
        <>
          <p className="dim" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{clue.content}</p>
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>{clue.implication}</p>
          {clueState?.claimedBy && !clueState?.publishedToRoom && (
            <p className="dim" style={{ margin: 0, fontSize: 11 }}>조사자: {claimedByName ?? '누군가'} (아직 공개 안 됨)</p>
          )}
          {canPublish && (
            <button onClick={onPublish} style={{ alignSelf: 'flex-start' }}>이 단서 공개하기</button>
          )}
          {claimedByMe && !canPublish && !clueState?.publishedToRoom && clueState?.claimedBy && (
            <span className="stamp" style={{ alignSelf: 'flex-start' }}>확보완료</span>
          )}
        </>
      ) : clueState?.claimedBy ? (
        <p className="dim" style={{ margin: 0, fontSize: 12 }}>{claimedByName ?? '다른 플레이어'}가 이미 조사했습니다.</p>
      ) : (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="pill pill-muted">AP {clue.apCost}</span>
          <button className="primary" onClick={onClaim} disabled={!canClaim}>
            단서 확보
          </button>
        </div>
      )}
    </div>
  )
}
