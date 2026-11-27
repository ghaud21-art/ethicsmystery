import { ref, set, runTransaction } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'
import { getNpcs } from './characterAssignment'
import { isClueVisibleTo } from './visibility'
import { findClueDef } from './apEngine'

// NPC 심문 (가면 회의 시리즈). 상태는 보안 규칙을 바꾸지 않도록 각 플레이어 자신의 경로에 둔다.
//   rooms/{code}/players/{uid}/npc/{npcId} = { wrong, l1, l2, l1Pub, l2Pub }
// npcCard: { publicStatement, evade, wrongLimit?, investigationClueId?,
//            keys: [{ level: 1|2, clueIds?: [], npcSecrets?: ['npcId:1'], secret, hint? }] }
export const DEFAULT_NPC_WRONG_LIMIT = 2

export function npcWrongTotal(room, npcId) {
  return Object.values(room?.players ?? {}).reduce((sum, p) => sum + (p?.npc?.[npcId]?.wrong ?? 0), 0)
}

export function npcSilent(room, npc) {
  return npcWrongTotal(room, npc.id) >= (npc.wrongLimit ?? DEFAULT_NPC_WRONG_LIMIT)
}

// 이 플레이어가 그 비밀을 볼 수 있는가 — 직접 열었거나 누군가 모둠에 공개했을 때
export function npcSecretVisibleTo(room, uid, npcId, level) {
  if (room?.players?.[uid]?.npc?.[npcId]?.[`l${level}`]) return true
  return Object.values(room?.players ?? {}).some((p) => p?.npc?.[npcId]?.[`l${level}Pub`])
}

export function npcSecretOpenedBy(room, npcId, level) {
  return Object.entries(room?.players ?? {}).filter(([, p]) => p?.npc?.[npcId]?.[`l${level}`]).map(([u]) => u)
}

// 방에서 누구든 연 NPC 비밀 'npcId:level' 집합 (엔딩 조건용)
export function openedNpcSecretIds(room, scenario, playerCount) {
  const out = new Set()
  for (const npc of getNpcs(scenario, playerCount)) {
    for (const level of [1, 2]) if (npcSecretOpenedBy(room, npc.id, level).length) out.add(`${npc.id}:${level}`)
  }
  return out
}

// 내가 NPC에게 내밀 수 있는 것: 내게 보이는 단서 + 내게 보이는 다른 NPC의 열린 비밀
export function presentableItems(scenario, room, uid, myCharacterId, playerCount) {
  const clueStates = room?.clues ?? {}
  const clues = [...scenario.clues.phase1.items, ...scenario.clues.phase2.items]
    .filter((c) => isClueVisibleTo(c, clueStates[c.id], uid, myCharacterId, scenario, playerCount))
    .map((c) => ({ key: `clue:${c.id}`, label: c.title, clueId: c.id }))
  const secrets = getNpcs(scenario, playerCount).flatMap((n) =>
    [1, 2].filter((lv) => npcSecretVisibleTo(room, uid, n.id, lv)).map((lv) => ({ key: `npc:${n.id}:${lv}`, label: `${n.name}의 ${lv === 1 ? '첫 번째' : '두 번째'} 비밀`, npcSecret: `${n.id}:${lv}` })),
  )
  return [...clues, ...secrets]
}

function keyMatches(key, item) {
  if (item.clueId && (key.clueIds ?? []).includes(item.clueId)) return true
  if (item.npcSecret && (key.npcSecrets ?? []).includes(item.npcSecret)) return true
  return false
}

// 결과: { kind: 'opened', level, secret } | { kind: 'evade', text } | { kind: 'already' } | { kind: 'notYet' } | { kind: 'silent' }
export async function presentToNpc(roomCode, uid, scenario, room, npc, item) {
  const base = `rooms/${roomCode}/players/${uid}/npc/${npc.id}`
  const keys = (npc.keys ?? []).filter((k) => keyMatches(k, item)).sort((a, b) => a.level - b.level)
  const fresh = keys.find((k) => !npcSecretVisibleTo(room, uid, npc.id, k.level))
  if (keys.length && !fresh) return { kind: 'already' }
  if (fresh) {
    if (fresh.level === 2 && !npcSecretVisibleTo(room, uid, npc.id, 1)) return { kind: 'notYet' }
    await set(ref(db, `${base}/l${fresh.level}`), true)
    return { kind: 'opened', level: fresh.level, secret: fresh.secret }
  }
  if (npcSilent(room, npc)) return { kind: 'silent' }
  await runTransaction(ref(db, `${base}/wrong`), (cur) => (cur ?? 0) + 1)
  return { kind: 'evade', text: npc.evade }
}

export async function publishNpcSecret(roomCode, uid, npcId, level) {
  await set(ref(db, `rooms/${roomCode}/players/${uid}/npc/${npcId}/l${level}Pub`), true)
}

export function npcInvestigationClue(scenario, npc) {
  return npc.investigationClueId ? findClueDef(scenario, npc.investigationClueId) : null
}
