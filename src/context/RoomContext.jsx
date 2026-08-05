import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { ref, onValue, set, update, remove, onDisconnect, get, runTransaction } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'
import { useAuth } from './AuthContext'
import { getPhaseApBudget, claimClue as claimClueEngine } from '../engine/apEngine'
import { publishClue as publishClueEngine } from '../engine/manualReveal'
import { saveActiveRoom, clearActiveRoom } from '../utils/activeRoom'

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
      saveActiveRoom({ scenarioId: scenario.scenarioId, roomCode: code })
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
      saveActiveRoom({ scenarioId: scenario.scenarioId, roomCode: code })
    },
    [scenario, uid, registerPresence],
  )

  // 캐릭터는 방장이 배정하지 않고 각 플레이어가 직접 고른다. characterClaims/{charId}로
  // 중복 선택을 막고(트랜잭션), 이전에 고른 캐릭터가 있으면 그 선점을 풀어준다.
  const selectCharacter = useCallback(
    async (characterId) => {
      const prevCharacterId = room?.players?.[uid]?.characterId
      const claimResult = await runTransaction(ref(db, `rooms/${roomCode}/characterClaims/${characterId}`), (current) => {
        if (current && current !== uid) return current // 이미 다른 사람이 선점
        return uid
      })
      if (!claimResult.committed || claimResult.snapshot.val() !== uid) {
        throw new Error('이미 다른 플레이어가 선택한 캐릭터입니다')
      }
      if (prevCharacterId && prevCharacterId !== characterId) {
        await remove(ref(db, `rooms/${roomCode}/characterClaims/${prevCharacterId}`))
      }
      await set(ref(db, `rooms/${roomCode}/players/${uid}/characterId`), characterId)
    },
    [room, roomCode, uid],
  )

  // 실수로 선택한 캐릭터를 명시적으로 취소한다 — characterClaims 선점을 풀고
  // players/{uid}/characterId를 비워, 다시 아무 캐릭터나 고를 수 있는 상태로 되돌린다.
  const clearCharacterSelection = useCallback(async () => {
    const myCharacterId = room?.players?.[uid]?.characterId
    if (!myCharacterId) return
    await remove(ref(db, `rooms/${roomCode}/characterClaims/${myCharacterId}`))
    await set(ref(db, `rooms/${roomCode}/players/${uid}/characterId`), null)
  }, [room, roomCode, uid])

  const startGame = useCallback(async () => {
    if (!room) return
    const apBudget = getPhaseApBudget(scenario, 'phase1', room.meta.playerCount)
    const updates = { 'meta/phase': 'phase1', 'meta/phaseStartedAt': Date.now() }
    Object.keys(room.players).forEach((pUid) => {
      updates[`players/${pUid}/ap/phase1`] = apBudget
    })
    await update(ref(db, `rooms/${roomCode}`), updates)
  }, [room, roomCode, scenario])

  const advanceToPhase2 = useCallback(async () => {
    const apBudget = getPhaseApBudget(scenario, 'phase2', room.meta.playerCount)
    const updates = { 'meta/phase': 'phase2', 'meta/phaseStartedAt': Date.now() }
    Object.keys(room.players).forEach((pUid) => {
      updates[`players/${pUid}/ap/phase2`] = apBudget
    })
    await update(ref(db, `rooms/${roomCode}`), updates)
  }, [room, roomCode, scenario])

  const advanceToResolution = useCallback(async () => {
    await update(ref(db, `rooms/${roomCode}/meta`), { phase: 'resolution', phaseStartedAt: Date.now() })
  }, [roomCode])

  // targetPhase: 'phase2' | 'resolution' — 다음 단계로 넘어가는 데 동의했음을 표시.
  const markReady = useCallback(
    (targetPhase) => set(ref(db, `rooms/${roomCode}/ready/${targetPhase}/${uid}`), true),
    [roomCode, uid],
  )

  const markBriefingSeen = useCallback(
    () => set(ref(db, `rooms/${roomCode}/players/${uid}/briefingSeen`), true),
    [roomCode, uid],
  )

  const claimClue = useCallback(
    (clueId, phase) => claimClueEngine(roomCode, uid, scenario, clueId, phase, room?.meta?.playerCount),
    [roomCode, uid, scenario, room],
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

  // 방 삭제 권한은 방장에게만 있다(보안 규칙). 방장이 아닌 플레이어가 눌러도 최소한
  // 자기 화면은 정상적으로 메인으로 돌아가야 하므로 삭제 실패는 조용히 무시한다.
  const leaveAndCleanupRoom = useCallback(async () => {
    try {
      await remove(ref(db, `rooms/${roomCode}`))
    } catch {
      // 방장이 아니면 삭제 권한이 없다 — 정상적인 상황이므로 무시
    }
    clearActiveRoom()
  }, [roomCode])

  const value = useMemo(
    () => ({
      room,
      loading,
      createRoom,
      joinRoom,
      selectCharacter,
      clearCharacterSelection,
      startGame,
      advanceToPhase2,
      advanceToResolution,
      markReady,
      markBriefingSeen,
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
      selectCharacter,
      clearCharacterSelection,
      startGame,
      advanceToPhase2,
      advanceToResolution,
      markReady,
      markBriefingSeen,
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
