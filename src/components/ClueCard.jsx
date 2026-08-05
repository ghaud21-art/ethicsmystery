export default function ClueCard({ clue, clueState, visible, canClaim, canPublish, onClaim, onPublish, players }) {
  const claimedByName = clueState?.claimedBy ? players?.[clueState.claimedBy]?.name : null

  return (
    <div className="card">
      <div className="row">
        <strong>{clue.title}</strong>
        {clue.location && <span className="dim">· {clue.location}</span>}
        {clue.isCriticalClue && <span style={{ color: 'var(--accent)' }}>★ 핵심 단서</span>}
      </div>

      {visible ? (
        <>
          <p>{clue.content}</p>
          <p className="dim">{clue.implication}</p>
          {clueState?.claimedBy && !clueState?.publishedToRoom && (
            <p className="dim">조사자: {claimedByName ?? '누군가'} (아직 공개 안 됨)</p>
          )}
          {canPublish && (
            <button onClick={onPublish}>이 단서 공개하기</button>
          )}
        </>
      ) : clueState?.claimedBy ? (
        <p className="dim">{claimedByName ?? '다른 플레이어'}가 이미 조사했습니다.</p>
      ) : (
        <div className="row">
          <span className="dim">AP {clue.apCost}</span>
          <button className="primary" onClick={onClaim} disabled={!canClaim}>
            조사하기
          </button>
        </div>
      )}
    </div>
  )
}
