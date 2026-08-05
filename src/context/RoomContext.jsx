import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { ref, onValue, set, update, remove, onDisconnect, get } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'
import { useAuth } from './AuthContext'
import { getPhaseApBudget, claimClue as claimClueEngine } from '../engine/apEngine'
import { publishClue as publishClueEngine } from '../engine/manualReveal'
import { assignCharactersToPlayers } from '../engine/characterAssignment'

const RoomContext = createContext(null)

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function RoomProvider({ scenario, roomCode, children }) {
  const { uid } = useAuth()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roomCode) {
      setLoading(false)
      return
    }
    const roomRef = ref(db, `rooms/${roomCode}`)
    const unsubscribe = onValue(roomRef, (snap) => {
      setRoom(snap.val())
      setLoading(false)
    })
    return unsubscribe
  }, [roomCode])

  const registerPresence = useCallback(
    (code, myUid) => {
      const playerRef = ref(db, `rooms/${code}/players/${myUid}`)
      onDisconnect(playerRef).update({ connected: false })
    },
    [],
  )

  const createRoom = useCallback(
    async (playerCount, displayName) => {
      const code = randomRoomCode()
      await set(ref(db, `rooms/${code}`), {
        meta: {
          scenarioId: scenario.scenarioId,
          playerCount,
          phase: 'waiting',
          hostUid: uid,
          createdAt: Date.now(),
        },
        players: {
          [uid]: { name: displayName, characterId: null, connected: true, ap: {} },
        },
      })
      registerPresence(code, uid)
      return code
    },
    [scenario, uid, registerPresence],
  )

  const joinRoom = useCallback(
    async (code, displayName) => {
      const snap = await get(ref(db, `rooms/${code}/meta`))
      if (!snap.exists()) throw new Error('존재하지 않는 방 코드입니다')
      await update(ref(db, `rooms/${code}/players/${uid}`), {
        name: displayName,
        characterId: null,
        connected: true,
        ap: {},
      })
      registerPresence(code, uid)
    },
    [uid, registerPresence],
  )

  const startGame = useCallback(async () => {
    if (!room) return
    const playerUids = Object.keys(room.players)
    const assignment = assignCharactersToPlayers(scenario, room.meta.playerCount, playerUids)
    const apBudget = getPhaseApBudget(scenario, 'phase1', room.meta.playerCount)
    const updates = { 'meta/phase': 'phase1' }
    playerUids.forEach((pUid) => {
      updates[`players/${pUid}/characterId`] = assignment[pUid]
      updates[`players/${pUid}/ap/phase1`] = apBudget
    })
    await update(ref(db, `rooms/${roomCode}`), updates)
  }, [room, roomCode, scenario])

  const advanceToPhase2 = useCallback(async () => {
    const apBudget = getPhaseApBudget(scenario, 'phase2', room.meta.playerCount)
    const updates = { 'meta/phase': 'phase2' }
    Object.keys(room.players).forEach((pUid) => {
      updates[`players/${pUid}/ap/phase2`] = apBudget
    })
    await update(ref(db, `rooms/${roomCode}`), updates)
  }, [room, roomCode, scenario])

  const advanceToResolution = useCallback(async () => {
    await update(ref(db, `rooms/${roomCode}/meta`), { phase: 'resolution' })
  }, [roomCode])

  const claimClue = useCallback(
    (clueId, phase) => claimClueEngine(roomCode, uid, scenario, clueId, phase),
    [roomCode, uid, scenario],
  )

  const publishClue = useCallback(
    (clueId) => publishClueEngine(roomCode, uid, scenario, clueId),
    [roomCode, uid, scenario],
  )

  const submitAccusation = useCallback(
    (characterIdOrUnknown) =>
      set(ref(db, `rooms/${roomCode}/resolution/accusations/${uid}`), characterIdOrUnknown),
    [roomCode, uid],
  )

  const submitMoralChoice = useCallback(
    (choice) => set(ref(db, `rooms/${roomCode}/resolution/moralChoices/${uid}`), choice),
    [roomCode, uid],
  )

  const finishGame = useCallback(async () => {
    await update(ref(db, `rooms/${roomCode}/meta`), { phase: 'ended' })
  }, [roomCode])

  const leaveAndCleanupRoom = useCallback(async () => {
    await remove(ref(db, `rooms/${roomCode}`))
  }, [roomCode])

  const value = useMemo(
    () => ({
      room,
      loading,
      createRoom,
      joinRoom,
      startGame,
      advanceToPhase2,
      advanceToResolution,
      claimClue,
      publishClue,
      submitAccusation,
      submitMoralChoice,
      finishGame,
      leaveAndCleanupRoom,
    }),
    [
      room,
      loading,
      createRoom,
      joinRoom,
      startGame,
      advanceToPhase2,
      advanceToResolution,
      claimClue,
      publishClue,
      submitAccusation,
      submitMoralChoice,
      finishGame,
      leaveAndCleanupRoom,
    ],
  )

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoom() {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error('useRoom must be used within RoomProvider')
  return ctx
}
