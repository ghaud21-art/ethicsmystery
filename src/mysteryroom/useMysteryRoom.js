// 미스터리룸 한 판의 동기화 상태와 행동.
// 방 데이터 구조 (mysteryRooms/{code}):
//   meta      { scenarioId, hostUid, playerCount, createdAt, status }
//   players   { [uid]: { name, role, connected, joinedAt } }
//   roleClaims{ [roleId]: uid }
//   state     { scene, startedAt, attempts, failedTotal, hintsUsed, clues, concepts,
//               history, badVisited, feedback, voteRound, evalRev, debateDone }
//   votes     { [scene]: { [round]: { [uid]: choiceIndex } } }
//   ready     { [scene]: { [uid]: true } }
//   boards    { [scene]: { rev, ...퍼즐 상태 } }
//   agree     { [scene]: { [uid]: rev } }
//   shared    { [key]: { by } }
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getStore, getLocalUid, isLocalMode } from './store'
import { myRoleSet, resolveRoles } from './roles'
import { resolveGate, tallyVotes } from './engine'
import { evaluatePuzzle } from './puzzles/evaluate'

export const HINT_AFTER_FAILS = 2

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function useMrUid() {
  const { uid } = useAuth()
  return isLocalMode() ? getLocalUid() : uid
}

// 방 만들기/참가는 방 화면에 들어가기 전에 쓰므로 훅 밖의 함수로 둔다.
export async function createMysteryRoom({ scenarioId, playerCount, name, uid }) {
  const store = getStore()
  for (let i = 0; i < 5; i++) {
    const code = randomCode()
    const exists = await store.get(`${code}/meta`)
    if (exists) continue
    await store.set(code, {
      meta: { scenarioId, hostUid: uid, playerCount, createdAt: Date.now(), status: 'waiting' },
      players: { [uid]: { name, role: null, connected: true, joinedAt: Date.now() } },
    })
    return code
  }
  throw new Error('방 코드를 만들지 못했습니다. 다시 시도해 주세요.')
}

export async function joinMysteryRoom({ code, name, uid, scenarioId }) {
  const store = getStore()
  const meta = await store.get(`${code}/meta`)
  if (!meta) throw new Error('존재하지 않는 방 코드입니다')
  if (meta.scenarioId !== scenarioId) throw new Error('다른 룸의 방 코드입니다')
  const players = (await store.get(`${code}/players`)) ?? {}
  if (!players[uid] && Object.keys(players).length >= meta.playerCount) throw new Error('방이 가득 찼습니다')
  if (!players[uid] && meta.status !== 'waiting') throw new Error('이미 시작한 방입니다')
  await store.update(`${code}/players/${uid}`, { name, connected: true, joinedAt: players[uid]?.joinedAt ?? Date.now() })
}

export function useMysteryRoom(room, code) {
  const store = getStore()
  const uid = useMrUid()
  const [data, setData] = useState(undefined)
  const [now, setNow] = useState(Date.now())
  const busyRef = useRef(false)

  useEffect(() => store.subscribe(code, setData), [store, code])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const meta = data?.meta
  const players = data?.players ?? {}
  const playerUids = Object.keys(players).sort((a, b) => (players[a].joinedAt ?? 0) - (players[b].joinedAt ?? 0))
  const state = data?.state
  const playerCount = meta?.playerCount ?? 1
  const me = players[uid]
  const myRoles = useMemo(() => myRoleSet(room, playerCount, me?.role), [room, playerCount, me?.role])
  const roleInfo = useMemo(() => resolveRoles(room, playerCount), [room, playerCount])
  const isHost = meta?.hostUid === uid
  const scene = state ? room.scenes[state.scene] : null
  const shared = data?.shared ?? {}

  const owns = useCallback((owner) => owner == null || myRoles.has(owner), [myRoles])
  const canSee = useCallback((owner, shareKey) => owns(owner) || !!shared[shareKey], [owns, shared])

  // ---- 상태 전이 ----
  const goTo = useCallback(
    async (from, to, patchFn) => {
      const res = await store.transaction(`${code}/state`, (cur) => {
        if (!cur || cur.scene !== from) return undefined
        const next = { ...cur }
        if (patchFn) patchFn(next)
        const target = room.scenes[to]
        next.scene = to
        next.sceneAt = Date.now()
        next.history = [...(cur.history ?? []), to]
        next.voteRound = 1
        next.feedback = null
        next.split = null
        if (target?.end?.kind === 'bad') next.badVisited = true
        if (target?.learn) next.concepts = { ...(next.concepts ?? {}), ...Object.fromEntries(target.learn.map((k) => [k, true])) }
        return next
      })
      // 떠난 장면의 준비·투표·동의 표시를 지워, 다시 돌아왔을 때 저절로 넘어가지 않게 한다.
      if (res.committed) {
        await store.update(code, { [`ready/${from}`]: null, [`votes/${from}`]: null, [`agree/${from}`]: null })
      }
    },
    [store, code, room],
  )

  // 관문 장면은 도착하는 즉시 판정한다.
  useEffect(() => {
    if (scene?.gate && state) {
      const to = resolveGate(scene, state)
      if (to) goTo(state.scene, to)
    }
  }, [scene, state, goTo])

  // 시간 초과
  const elapsed = state?.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0
  const limit = (room.meta.estimatedMinutes ?? 30) * 60
  const remaining = Math.max(0, limit - elapsed)
  useEffect(() => {
    if (state && remaining === 0 && !scene?.end && room.timeoutScene) goTo(state.scene, room.timeoutScene)
  }, [state, remaining, scene, room, goTo])

  // 선택지 투표 집계
  const votes = state ? data?.votes?.[state.scene]?.[state.voteRound ?? 1] : null
  useEffect(() => {
    if (!state || !scene?.choices || scene.choices.length < 2) return
    const round = state.voteRound ?? 1
    const result = tallyVotes(votes, playerUids, round, meta?.hostUid)
    if (!result.done) return
    if (result.split) {
      store.transaction(`${code}/state`, (cur) => {
        if (!cur || cur.scene !== state.scene || (cur.voteRound ?? 1) !== round) return undefined
        return { ...cur, voteRound: round + 1, split: { round, counts: votes } }
      })
    } else {
      const choice = scene.choices[result.choice]
      if (choice) goTo(state.scene, choice.to)
    }
  }, [votes, state, scene, playerUids, meta, store, code, goTo])

  // "다음" 준비 집계 (선택지 1개짜리, next, requireShared)
  const readyMap = state ? data?.ready?.[state.scene] ?? {} : {}
  useEffect(() => {
    if (!state || !scene) return
    const target = scene.next ?? (scene.choices?.length === 1 ? scene.choices[0].to : null)
    if (!target || scene.type === 'debate') return
    if (playerUids.length && playerUids.every((u) => readyMap[u])) goTo(state.scene, target)
  }, [readyMap, state, scene, playerUids, goTo])

  // 퍼즐 제출 동의 집계 → 채점
  const board = state ? data?.boards?.[state.scene] ?? {} : {}
  const agreeMap = state ? data?.agree?.[state.scene] ?? {} : {}
  useEffect(() => {
    if (!state || !scene?.puzzle || state.feedback) return
    const rev = board.rev ?? 0
    if (!playerUids.length || !playerUids.every((u) => agreeMap[u] === rev)) return
    if (busyRef.current) return
    busyRef.current = true
    const sceneId = state.scene
    const puzzle = scene.puzzle
    const result = evaluatePuzzle(puzzle, board)
    store
      .transaction(`${code}/state`, (cur) => {
        if (!cur || cur.scene !== sceneId || cur.evalRev?.[sceneId] === rev) return undefined
        const next = { ...cur, evalRev: { ...(cur.evalRev ?? {}), [sceneId]: rev } }
        if (result.correct) {
          if (puzzle.clue) next.clues = { ...(cur.clues ?? {}), [puzzle.clue]: result.tainted ? 'tainted' : 'clean' }
          if (puzzle.learn) next.concepts = { ...(cur.concepts ?? {}), ...Object.fromEntries(puzzle.learn.map((k) => [k, true])) }
          next.pendingSolve = { scene: sceneId, tainted: !!result.tainted, why: result.why ?? null }
        } else {
          const counted = (puzzle.attempts ?? 3) < 99
          next.attempts = { ...(cur.attempts ?? {}), [sceneId]: (cur.attempts?.[sceneId] ?? 0) + 1 }
          if (counted) next.failedTotal = (cur.failedTotal ?? 0) + 1
          next.feedback = { scene: sceneId, hits: result.hits, total: result.total, why: result.why ?? null, line: puzzle.wrongLine ?? null }
        }
        return next
      })
      .then(() => store.remove(`${code}/agree/${sceneId}`))
      .finally(() => {
        busyRef.current = false
      })
  }, [agreeMap, board, state, scene, playerUids, store, code])

  // 정답 처리 후 다음 장면으로 (거짓 출구면 경고를 먼저 보여 준다)
  useEffect(() => {
    if (!state?.pendingSolve || state.pendingSolve.scene !== state.scene) return
    if (state.pendingSolve.tainted) return // 화면에서 확인 버튼으로 넘어간다
    goTo(state.scene, scene.puzzle.onSolve, (n) => (n.pendingSolve = null))
  }, [state, scene, goTo])

  // ---- 행동 ----
  const actions = useMemo(
    () => ({
      pickRole: async (roleId) => {
        const res = await store.transaction(`${code}/roleClaims/${roleId}`, (cur) => (cur && cur !== uid ? undefined : uid))
        if (!res.committed || res.value !== uid) throw new Error('이미 다른 사람이 고른 역할입니다')
        const prev = players[uid]?.role
        if (prev && prev !== roleId) await store.remove(`${code}/roleClaims/${prev}`)
        await store.set(`${code}/players/${uid}/role`, roleId)
      },
      startGame: async () => {
        await store.update(code, {
          'meta/status': 'playing',
          state: { scene: room.start, startedAt: Date.now(), sceneAt: Date.now(), history: [room.start], voteRound: 1, failedTotal: 0 },
        })
      },
      vote: (idx) => store.set(`${code}/votes/${state.scene}/${state.voteRound ?? 1}/${uid}`, idx),
      ready: () => store.set(`${code}/ready/${state.scene}/${uid}`, true),
      share: (key) => store.set(`${code}/shared/${key}`, { by: uid }),
      updateBoard: (fn) =>
        store.transaction(`${code}/boards/${state.scene}`, (cur) => {
          const next = fn({ ...(cur ?? {}) })
          return { ...next, rev: (cur?.rev ?? 0) + 1 }
        }),
      agree: () => store.set(`${code}/agree/${state.scene}/${uid}`, board.rev ?? 0),
      unagree: () => store.remove(`${code}/agree/${state.scene}/${uid}`),
      dismissFeedback: () =>
        store.transaction(`${code}/state`, (cur) => (cur?.feedback ? { ...cur, feedback: null } : undefined)),
      confirmTainted: () => goTo(state.scene, scene.puzzle.onSolve, (n) => (n.pendingSolve = null)),
      openHint: () => store.set(`${code}/state/hintsUsed/${state.scene}`, true),
      retry: (to) => goTo(state.scene, to),
      // 4단계(토론)에서 실제 토론 화면으로 바뀐다
      finishDebatePlaceholder: () => goTo(state.scene, scene.next, (n) => (n.debateDone = true)),
      learnConcept: (k) => k && store.set(`${code}/state/concepts/${k}`, true),
    }),
    [store, code, uid, players, room, state, board, scene, goTo],
  )

  return {
    loading: data === undefined,
    data,
    uid,
    meta,
    players,
    playerUids,
    me,
    isHost,
    state,
    scene,
    shared,
    myRoles,
    roleInfo,
    owns,
    canSee,
    votes: votes ?? {},
    readyMap,
    board,
    agreeMap,
    remaining,
    elapsed,
    now,
    solo: playerUids.length === 1,
    actions,
  }
}
