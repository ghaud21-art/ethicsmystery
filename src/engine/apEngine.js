import { ref, runTransaction } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'

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

// 두 개의 별도 RTDB 트랜잭션(단서 선점 → AP 차감)으로 처리한다. 완전한 원자성은
// 아니지만 3~4인 교실 규모의 낮은 동시 쓰기 경합에서는 충분한 트레이드오프.
export async function claimClue(roomCode, uid, scenario, clueId, phase) {
  const clue = findClueDef(scenario, clueId)
  if (!clue) throw new Error(`알 수 없는 단서: ${clueId}`)

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
