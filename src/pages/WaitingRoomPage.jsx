import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RoomPageShell from '../components/RoomPageShell.jsx'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import NarrationScript from '../components/NarrationScript.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { getPlayableCharacters } from '../engine/characterAssignment.js'

function WaitingRoomInner({ scenario }) {
  const { scenarioId, roomCode } = useParams()
  const navigate = useNavigate()
  const { uid } = useAuth()
  const { room, loading, selectCharacter, clearCharacterSelection, startGame } = useRoom()
  const [selectError, setSelectError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (room?.meta?.phase === 'phase1') {
      navigate(`/scenario/${scenarioId}/room/${roomCode}/play`)
    }
  }, [room, scenarioId, roomCode, navigate])

  if (loading) return <div className="dim">불러오는 중...</div>
  if (!room) return <div className="card">방을 찾을 수 없습니다.</div>

  const players = Object.entries(room.players ?? {})
  const isHost = room.meta.hostUid === uid
  const roomFull = players.length === room.meta.playerCount
  const allSelected = players.every(([, p]) => !!p.characterId)
  const canStart = roomFull && allSelected
  const myCharacterId = room.players?.[uid]?.characterId
  const characters = getPlayableCharacters(scenario, room.meta.playerCount)

  const handleSelect = async (characterId) => {
    setSelectError(null)
    setBusy(true)
    try {
      await selectCharacter(characterId)
    } catch (e) {
      setSelectError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    setSelectError(null)
    setBusy(true)
    try {
      await clearCharacterSelection()
    } catch (e) {
      setSelectError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Masthead showBack />
      <StepProgress activeIndex={1} />

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
        PARTY ROSTER
      </div>
      <h1 className="page-title">모둠 준비 확인</h1>
      <div className="page-title-rule" />
      <p className="dim" style={{ marginBottom: 20 }}>
        방 코드 <strong style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>{roomCode}</strong>를 다른 플레이어에게 알려주세요 ({room.meta.playerCount}인용)
      </p>

      <div className="card col">
        {players.map(([pUid, p]) => {
          const pCharacter = characters.find((c) => c.id === p.characterId)
          return (
            <div key={pUid} className="row" style={{ justifyContent: 'space-between', padding: '8px 10px', background: 'var(--panel2)', borderRadius: 3 }}>
              <div className="row">
                <div
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'rgba(201,162,39,.16)', color: 'var(--gold-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12,
                  }}
                >
                  {p.name?.[0] ?? '?'}
                </div>
                <strong>{p.name}</strong>
                <span className="dim" style={{ fontSize: 12 }}>
                  {pUid === room.meta.hostUid ? '(방장)' : ''}{pUid === uid ? ' (나)' : ''}
                </span>
              </div>
              <span className={`pill ${pCharacter ? 'pill-solid' : 'pill-muted'}`}>
                {pCharacter ? pCharacter.name : '캐릭터 선택 중...'}
              </span>
            </div>
          )
        })}
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>
          {players.length}/{room.meta.playerCount}명 모임
        </p>
      </div>

      {scenario.narration?.opening && (
        <NarrationScript title="오프닝 내레이션" lines={scenario.narration.opening} characters={scenario.characters} />
      )}

      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
        </svg>
        캐릭터 선택
      </div>
      <p className="dim" style={{ marginBottom: 14 }}>맡고 싶은 캐릭터를 선택하세요. 한 사람당 한 명씩만 선택할 수 있어요.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 8 }}>
        {characters.map((c) => {
          const takenByUid = players.find(([, p]) => p.characterId === c.id)?.[0]
          const takenByName = takenByUid ? room.players[takenByUid]?.name : null
          const isMine = takenByUid === uid
          return (
            <div
              key={c.id}
              className="card col"
              style={{
                marginBottom: 0,
                borderColor: isMine ? 'var(--gold)' : 'var(--line)',
                boxShadow: isMine ? '0 0 0 1px var(--gold), var(--glow)' : undefined,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontFamily: 'var(--font-head)' }}>{c.name}</strong>
                {takenByUid && !isMine && <span className="pill pill-muted">{takenByName} 선택함</span>}
                {isMine && <span className="pill pill-solid">내 캐릭터</span>}
              </div>
              <span className="dim" style={{ fontSize: 12 }}>{c.role}</span>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{c.publicInfo}</p>
              {isMine ? (
                <button onClick={handleClear} disabled={busy} style={{ alignSelf: 'flex-start' }}>
                  선택 취소
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => handleSelect(c.id)}
                  disabled={busy || !!takenByUid}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {takenByUid ? '이미 선택됨' : '이 캐릭터 선택'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: -2 }}>
        게임이 시작되기 전까지는 언제든 다른 캐릭터로 바꾸거나 선택을 취소할 수 있어요.
      </p>
      {selectError && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{selectError}</p>}

      {isHost ? (
        <button className="primary" onClick={startGame} disabled={!canStart} style={{ width: '100%', textAlign: 'left', marginTop: 14 }}>
          {!roomFull
            ? `인원이 다 모이면 시작할 수 있어요 (${players.length}/${room.meta.playerCount})`
            : !allSelected
              ? '모두 캐릭터를 선택하면 시작할 수 있어요'
              : '게임 시작'}
        </button>
      ) : (
        <p className="dim" style={{ marginTop: 14 }}>
          {myCharacterId ? '방장이 시작하기를 기다리는 중...' : '캐릭터를 선택해주세요.'}
        </p>
      )}
    </div>
  )
}

export default function WaitingRoomPage() {
  const { scenarioId, roomCode } = useParams()
  return (
    <RoomPageShell scenarioId={scenarioId} roomCode={roomCode}>
      {(scenario) => <WaitingRoomInner scenario={scenario} />}
    </RoomPageShell>
  )
}
