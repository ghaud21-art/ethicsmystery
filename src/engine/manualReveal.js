import { ref, get, set } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'
import { findClueDef } from './apEngine'

// unlockType === 'manual_reveal_by_player' 단서는 시스템이 자동 공개하지 않는다.
// 이미 그 단서를 조사(claim)한 플레이어 본인만 '공개하기' 액션으로 룸 전체에 노출할 수 있다.
export async function publishClue(roomCode, uid, scenario, clueId) {
  const clue = findClueDef(scenario, clueId)
  if (!clue) throw new Error(`알 수 없는 단서: ${clueId}`)
  if (clue.unlockType !== 'manual_reveal_by_player') {
    throw new Error('이 단서는 수동 공개 대상이 아닙니다')
  }

  const clueRef = ref(db, `rooms/${roomCode}/clues/${clueId}`)
  const snap = await get(clueRef)
  const state = snap.val()
  if (!state || state.claimedBy !== uid) {
    throw new Error('본인이 조사한 단서만 공개할 수 있습니다')
  }

  await set(ref(db, `rooms/${roomCode}/clues/${clueId}/publishedToRoom`), true)
}
