import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Masthead from '../../components/Masthead.jsx'
import { loadMysteryRoom } from '../loader'
import { useMysteryRoom } from '../useMysteryRoom'
import { isLocalMode } from '../store'
import { roleById } from '../roles'
import { Icon, MrContext, fmtTime } from '../components/common'
import SceneView from '../components/SceneView'
import SidePanel from '../components/SidePanel'
import '../mysteryroom.css'

function WaitingRoom({ room, mr, code }) {
  const [error, setError] = useState(null)
  const joined = mr.playerUids.length
  const allPicked = mr.playerUids.every((u) => mr.players[u].role)
  const canStart = joined === mr.meta.playerCount && allPicked
  const claims = Object.fromEntries(mr.playerUids.filter((u) => mr.players[u].role).map((u) => [mr.players[u].role, u]))

  return (
    <div className="page">
      <Masthead showBack />
      <div className="kicker"><Icon name="user" />TEAM</div>
      <h1 className="page-title">모둠 준비</h1>
      <div className="page-title-rule" />
      <p className="dim">
        방 코드 <strong style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>{code}</strong> 를 모둠원에게 알려 주세요. ({joined}/{mr.meta.playerCount}명 입장)
      </p>

      <div className="card col">
        <strong>역할 고르기</strong>
        {mr.roleInfo.active.map((rid) => {
          const r = roleById(room, rid)
          const takenBy = claims[rid]
          const mine = takenBy === mr.uid
          const also = mr.roleInfo.includes[rid].filter((x) => x !== rid).map((x) => roleById(room, x))
          return (
            <div key={rid} className={`mr-option ${mine ? 'on' : ''}`} onClick={() => !takenBy && mr.actions.pickRole(rid).catch((e) => setError(e.message))} style={{ cursor: takenBy && !mine ? 'default' : 'pointer', opacity: takenBy && !mine ? 0.55 : 1 }}>
              <span className="mr-radio" />
              <span style={{ flex: 1 }}>
                <strong>{r.name}</strong> <span className="dim">{r.job}</span>
                <br />
                <span style={{ fontSize: 12 }}>관점: {r.perspective}</span>
                {also.length > 0 && <span className="dim" style={{ display: 'block', fontSize: 11 }}>함께 맡음: {also.map((a) => `${a.name}(${a.job})`).join(', ')}</span>}
              </span>
              <span className="dim" style={{ fontSize: 12 }}>{takenBy ? mr.players[takenBy]?.name : ''}</span>
            </div>
          )
        })}
        {error && <p style={{ color: 'var(--blood-light)', fontSize: 12, margin: 0 }}>{error}</p>}
      </div>

      <div className="card col">
        <strong>입장한 사람</strong>
        {mr.playerUids.map((u) => (
          <div key={u} className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
            <span>{mr.players[u].name}{u === mr.meta.hostUid ? ' · 방장' : ''}{u === mr.uid ? ' (나)' : ''}</span>
            <span className="dim">{mr.players[u].role ? roleById(room, mr.players[u].role).name : '역할 고르는 중'}</span>
          </div>
        ))}
        {mr.isHost ? (
          <button className="primary" disabled={!canStart} style={{ alignSelf: 'flex-start' }} onClick={mr.actions.startGame}>
            {canStart ? '시작하기' : '모두 입장하고 역할을 고르면 시작할 수 있어요'}
          </button>
        ) : (
          <span className="dim" style={{ fontSize: 12 }}>방장이 시작하면 바로 진행됩니다.</span>
        )}
      </div>
    </div>
  )
}

function Play({ room, mr }) {
  const scene = mr.scene
  const curRoomIdx = room.rooms.findIndex((r) => r.id === scene?.room)
  return (
    <div className="page-wide">
      <div className="mr-topbar">
        <span className="mr-title">{room.meta.title}</span>
        <span className="dim" style={{ fontSize: 12 }}>
          {mr.me?.name} · {(mr.roleInfo.includes[mr.me?.role] ?? []).map((rid) => roleById(room, rid)?.name).join(', ')}
        </span>
        <span className={`mr-timer ${mr.remaining < 300 ? 'warn' : ''}`}><Icon name="clock" size={16} />{fmtTime(mr.remaining)}</span>
      </div>
      <div className="mr-rooms">
        {room.rooms.map((r, i) => {
          const got = mr.state.clues?.[r.clue]
          return (
            <div key={r.id} className={`mr-room-step ${i === curRoomIdx ? 'active' : ''} ${got ? 'done' : ''}`}>
              <span className="mr-clue-badge">{got ? <Icon name="check" size={12} /> : r.clue}</span>
              <span>{r.name}</span>
            </div>
          )
        })}
      </div>
      <div className="mr-layout">
        <SceneView />
        <SidePanel />
      </div>
    </div>
  )
}

function RoomInner({ room, code }) {
  const mr = useMysteryRoom(room, code)
  if (mr.loading) return <div className="page dim">불러오는 중...</div>
  if (!mr.meta) return <div className="page"><Masthead showBack /><div className="card">방을 찾을 수 없습니다.</div></div>
  if (!mr.me) return <div className="page"><Masthead showBack /><div className="card">이 방의 참가자가 아닙니다. 룸 소개 화면에서 방 코드로 들어와 주세요.</div></div>
  return (
    <MrContext.Provider value={{ room, mr }}>
      {isLocalMode() && <div className="mr-banner page-wide">로컬 테스트 모드</div>}
      {mr.state ? <Play room={room} mr={mr} /> : <WaitingRoom room={room} mr={mr} code={code} />}
    </MrContext.Provider>
  )
}

export default function MysteryRoomPage() {
  const { scenarioId, code } = useParams()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    loadMysteryRoom(scenarioId).then(setRoom).catch(setError)
  }, [scenarioId])
  if (error) return <div className="page"><div className="card">룸을 불러오지 못했습니다: {error.message}</div></div>
  if (!room) return <div className="page dim">불러오는 중...</div>
  return <RoomInner room={room} code={code} />
}
