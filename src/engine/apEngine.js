import { ref, runTransaction, get } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'
import { isClueVisibleTo } from './visibility'

export function getPhaseApBudget(scenario, phase, playerCount) {
  const phaseDef = scenario.clues[phase]
  const bonus = playerCount === 3 ? phaseDef.apBonusFor3Players : 0
  return phaseDef.apPerPlayer + bonus
}

export function findClueDef(scenario, clueId) {
  return (
    scenario.clues.phase1.items.find((c) => c.id === clueId) ??
    scenario.clues.phase2.items.find((c) => c.id === clueId)
  )
}

// 조합형(unlockType: 'combo') 단서는 선행 단서 전부가 "이 플레이어 본인에게 보이는"
// 상태여야 열람 가능해진다 — 본인이 직접 확보했거나, 확보한 사람이 방에 공개했거나.
// 팀 전체가 아니라 플레이어별로 판정하므로, 두 선행 단서를 서로 다른 사람이 나눠
// 갖고 있다면 누군가 자기 단서를 '공개하기'로 공유해야만 조합이 풀린다.
export function isComboReady(scenario, clue, roomClues, uid, myCharacterId) {
  if (clue.unlockType !== 'combo') return true
  return (clue.requiresClueIds ?? []).every((id) => {
    const prereqClue = findClueDef(scenario, id)
    return prereqClue && isClueVisibleTo(prereqClue, roomClues?.[id], uid, myCharacterId)
  })
}

// 두 개의 별도 RTDB 트랜잭션(단서 선점 → AP 차감)으로 처리한다. 완전한 원자성은
// 아니지만 3~4인 교실 규모의 낮은 동시 쓰기 경합에서는 충분한 트레이드오프.
export async function claimClue(roomCode, uid, scenario, clueId, phase) {
  const clue = findClueDef(scenario, clueId)
  if (!clue) throw new Error(`알 수 없는 단서: ${clueId}`)

  if (clue.unlockType === 'combo') {
    const [cluesSnap, characterIdSnap] = await Promise.all([
      get(ref(db, `rooms/${roomCode}/clues`)),
      get(ref(db, `rooms/${roomCode}/players/${uid}/characterId`)),
    ])
    if (!isComboReady(scenario, clue, cluesSnap.val(), uid, characterIdSnap.val())) {
      throw new Error('아직 조합 조건이 충족되지 않았습니다 — 선행 단서를 먼저 확보하거나 팀원이 공개해야 합니다')
    }
  }

  // owner는 "이 단서가 누구에 관한 것인가"를 뜻한다 — 그 인물 역의 플레이어 본인은
  // 자기 자신을 조사할 수 없고, 다른 플레이어들만 캐물어 알아낼 수 있다.
  if (clue.owner) {
    const myCharacterIdSnap = await get(ref(db, `rooms/${roomCode}/players/${uid}/characterId`))
    if (myCharacterIdSnap.val() === clue.owner) {
      throw new Error('자기 자신에 대한 단서는 스스로 조사할 수 없습니다 — 다른 플레이어가 캐물어야 합니다')
    }
  }

  const clueRef = ref(db, `rooms/${roomCode}/clues/${clueId}`)
  const claimResult = await runTransaction(clueRef, (current) => {
    if (current && current.claimedBy && current.claimedBy !== uid) return current // 이미 다른 사람이 선점
    return { ...current, claimedBy: uid, claimedAt: Date.now() }
  })
  if (!claimResult.committed || claimResult.snapshot.val()?.claimedBy !== uid) {
    throw new Error('이미 다른 플레이어가 조사한 단서입니다')
  }

  const apRef = ref(db, `rooms/${roomCode}/players/${uid}/ap/${phase}`)
  const apResult = await runTransaction(apRef, (current) => {
    const remaining = current ?? 0
    if (remaining < clue.apCost) return undefined // abort
    return remaining - clue.apCost
  })
  if (!apResult.committed) {
    // AP 부족 — 선점만 롤백(단서 자체는 공용 자원이 아니라 이미 이 uid 소유이므로 되돌리지 않고 에러만 반환)
    throw new Error('AP가 부족합니다')
  }

  return clue
}
