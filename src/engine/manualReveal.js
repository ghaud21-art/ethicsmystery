import { ref, get, set } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'
import { findClueDef } from './apEngine'

// 시스템은 어떤 단서도 자동으로 방 전체에 공개하지 않는다 — 단서를 확보(claim)한
// 플레이어 본인만 '공개하기' 액션으로 다른 사람에게 노출할지 선택할 수 있다.
// 이 선택 자체가 성찰 프롬프트("단서를 몇 번 공유했고 몇 번 숨겼는가")와 직결된다.
export async function publishClue(roomCode, uid, scenario, clueId) {
  const clue = findClueDef(scenario, clueId)
  if (!clue) throw new Error(`알 수 없는 단서: ${clueId}`)

  const clueRef = ref(db, `rooms/${roomCode}/clues/${clueId}`)
  const snap = await get(clueRef)
  const state = snap.val()
  if (!state || state.claimedBy !== uid) {
    throw new Error('본인이 조사한 단서만 공개할 수 있습니다')
  }

  await set(ref(db, `rooms/${roomCode}/clues/${clueId}/publishedToRoom`), true)
}
