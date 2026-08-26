import { ref, runTransaction, get } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'
import { isClueVisibleTo, isClueAutoRevealed } from './visibility'
import { getEffectiveCharacterId } from './characterAssignment'

// scenario.clues.sharedApPool===true인 시나리오는 phase1/phase2가 AP를 따로 받지
// 않고, 게임 시작 시 한 번 받은 공동 예산을 두 단계에 걸쳐 자유롭게 나눠 쓴다
// (예: phase1에서 아껴서 phase2에 더 쓰는 전략적 배분). RTDB 경로는
// players/{uid}/ap/shared 하나만 쓰고, phase1/phase2 각각의 ap 경로는 쓰지 않는다.
export function isSharedApPool(scenario) {
  return scenario.clues.sharedApPool === true
}

export function getApFieldName(scenario, phase) {
  return isSharedApPool(scenario) ? 'shared' : phase
}

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
export function isComboReady(scenario, clue, roomClues, uid, myCharacterId, playerCount) {
  if (clue.unlockType !== 'combo') return true
  return (clue.requiresClueIds ?? []).every((id) => {
    const prereqClue = findClueDef(scenario, id)
    return prereqClue && isClueVisibleTo(prereqClue, roomClues?.[id], uid, myCharacterId, scenario, playerCount)
  })
}

// 두 개의 별도 RTDB 트랜잭션(단서 선점 → AP 차감)으로 처리한다. 완전한 원자성은
// 아니지만 3~4인 교실 규모의 낮은 동시 쓰기 경합에서는 충분한 트레이드오프.
export async function claimClue(roomCode, uid, scenario, clueId, phase, playerCount) {
  const clue = findClueDef(scenario, clueId)
  if (!clue) throw new Error(`알 수 없는 단서: ${clueId}`)

  if (isClueAutoRevealed(clue, scenario, playerCount)) {
    throw new Error('이 단서는 이미 모두에게 공개된 정보입니다')
  }

  if (clue.unlockType === 'combo') {
    const [cluesSnap, characterIdSnap] = await Promise.all([
      get(ref(db, `rooms/${roomCode}/clues`)),
      get(ref(db, `rooms/${roomCode}/players/${uid}/characterId`)),
    ])
    if (!isComboReady(scenario, clue, cluesSnap.val(), uid, characterIdSnap.val(), playerCount)) {
      throw new Error('아직 조합 조건이 충족되지 않았습니다 — 선행 단서를 먼저 확보하거나 팀원이 공개해야 합니다')
    }
  }

  // owner는 "이 단서가 누구에 관한 것인가"를 뜻한다. 기본 규칙은 그 인물 역의
  // 플레이어 본인은 자기 자신을 조사할 수 없고 다른 플레이어들만 캐물어 알아낼
  // 수 있다는 것이지만, 두 가지 예외가 있다:
  //  - phaseDef.ownerCanSelfReveal===true — 소유자 본인이 "자백"하듯 무료로,
  //    즉시 방 전체에 공개하며 스스로 공개할 수 있다(단서.owner!==나 인 사람은
  //    기존처럼 AP를 내고 강제 열람).
  //  - clue.revealPolicy==='ownerOnly' — 소유자만 공개할 수 있고, 남은 AP를
  //    내더라도 강제로 열람할 수 없다(자백 전용 단서).
  let isFreeSelfReveal = false
  if (clue.owner) {
    const myCharacterIdSnap = await get(ref(db, `rooms/${roomCode}/players/${uid}/characterId`))
    const effectiveOwner = getEffectiveCharacterId(scenario, clue.owner, playerCount)
    const iAmOwner = myCharacterIdSnap.val() === effectiveOwner
    const phaseDef = scenario.clues[phase]
    const selfRevealAllowed = clue.revealPolicy === 'ownerOnly' || phaseDef?.ownerCanSelfReveal === true

    if (iAmOwner) {
      if (!selfRevealAllowed) {
        throw new Error('자기 자신에 대한 단서는 스스로 조사할 수 없습니다 — 다른 플레이어가 캐물어야 합니다')
      }
      isFreeSelfReveal = true
    } else if (clue.revealPolicy === 'ownerOnly') {
      throw new Error('이 단서는 소유자 본인만 공개할 수 있습니다 — 다른 사람이 강제로 열람할 수 없습니다')
    }
  }

  const clueRef = ref(db, `rooms/${roomCode}/clues/${clueId}`)
  const claimResult = await runTransaction(clueRef, (current) => {
    if (current && current.claimedBy && current.claimedBy !== uid) return current // 이미 다른 사람이 선점
    return {
      ...current,
      claimedBy: uid,
      claimedAt: Date.now(),
      ...(isFreeSelfReveal ? { publishedToRoom: true } : {}),
    }
  })
  if (!claimResult.committed || claimResult.snapshot.val()?.claimedBy !== uid) {
    throw new Error('이미 다른 플레이어가 조사한 단서입니다')
  }

  if (isFreeSelfReveal) return clue // 자발적 공개는 무료 — AP 차감 없음

  const apRef = ref(db, `rooms/${roomCode}/players/${uid}/ap/${getApFieldName(scenario, phase)}`)
  const apResult = await runTransaction(apRef, (current) => {
    const remaining = current ?? 0
    if (remaining < clue.apCost) return undefined // abort
    return remaining - clue.apCost
  })
  if (!apResult.committed) {
    // AP 부족 — 이미 선점한 단서를 롤백한다. 롤백하지 않으면 화면의 AP 상태가
    // 낡았을 때(버튼이 잠깐 활성화된 채로 클릭) AP 없이 단서를 확보하는 구멍이 생긴다.
    await runTransaction(clueRef, (current) => {
      if (current?.claimedBy !== uid) return current // 이례적 — 남의 선점은 건드리지 않는다
      const { claimedBy, claimedAt, publishedToRoom, ...rest } = current
      return Object.keys(rest).length > 0 ? rest : null
    })
    throw new Error('AP가 부족합니다')
  }

  return clue
}
