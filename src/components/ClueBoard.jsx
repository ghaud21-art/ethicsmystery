import ClueCard from './ClueCard.jsx'
import { isClueVisibleTo } from '../engine/visibility.js'

export default function ClueBoard({ scenario, phase, room, uid, myCharacterId, onClaim, onPublish }) {
  const items = scenario.clues[phase].items
  const clueStates = room.clues ?? {}
  const myAp = room.players?.[uid]?.ap?.[phase] ?? 0

  return (
    <div className="col">
      {items.map((clue) => {
        const clueState = clueStates[clue.id]
        const visible = isClueVisibleTo(clue, clueState, uid, myCharacterId)
        const canClaim = !clueState?.claimedBy && myAp >= clue.apCost
        const canPublish =
          visible &&
          clue.unlockType === 'manual_reveal_by_player' &&
          clueState?.claimedBy === uid &&
          !clueState?.publishedToRoom
        return (
          <ClueCard
            key={clue.id}
            clue={clue}
            clueState={clueState}
            visible={visible}
            canClaim={canClaim}
            canPublish={canPublish}
            onClaim={() => onClaim(clue.id)}
            onPublish={() => onPublish(clue.id)}
            players={room.players}
          />
        )
      })}
    </div>
  )
}
