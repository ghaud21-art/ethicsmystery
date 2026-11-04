import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Masthead from '../../components/Masthead.jsx'
import { loadMysteryRoom } from '../loader'
import { createMysteryRoom, joinMysteryRoom, useMrUid } from '../useMysteryRoom'
import { isLocalMode } from '../store'
import { Icon } from '../components/common'
import '../mysteryroom.css'

const NICK_KEY = 'ethicsmystery.mysteryroom.nickname'

export default function MysteryIntroPage() {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const uid = useMrUid()
  const [room, setRoom] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [name, setName] = useState(() => localStorage.getItem(NICK_KEY) ?? '')
  const [count, setCount] = useState(4)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadMysteryRoom(scenarioId)
      .then((r) => {
        setRoom(r)
        const counts = r.meta.supportedPlayerCounts
        setCount(counts.includes(4) ? 4 : counts[counts.length - 1])
      })
      .catch(setLoadError)
  }, [scenarioId])

  if (loadError) return <div className="page"><Masthead showBack /><div className="card">룸을 불러오지 못했습니다: {loadError.message}</div></div>
  if (!room) return <div className="page dim">불러오는 중...</div>

  const playable = isLocalMode() || room.published

  const run = async (fn) => {
    if (!name.trim()) return setError('닉네임을 입력해 주세요')
    if (!uid) return setError('접속 준비 중입니다. 잠시 후 다시 눌러 주세요')
    setBusy(true)
    setError(null)
    try {
      localStorage.setItem(NICK_KEY, name.trim())
      const c = await fn()
      navigate(`/mystery/${scenarioId}/${c}${window.location.search ? '' : ''}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Masthead showBack />
      {isLocalMode() && <div className="mr-banner">로컬 테스트 모드: Firebase 없이 이 브라우저의 탭끼리만 동기화됩니다.</div>}
      <div className="kicker"><Icon name="door" />MYSTERY ROOM</div>
      <h1 className="page-title">{room.meta.title}</h1>
      <div className="page-title-rule" />
      {room.meta.subtitle && <p className="dim" style={{ marginTop: -6 }}>{room.meta.subtitle}</p>}

      <div className="card col">
        <p style={{ margin: 0, lineHeight: 1.8 }}>{room.story?.setting}</p>
        <p className="dim" style={{ margin: 0, lineHeight: 1.8 }}>{room.story?.intro}</p>
        <div className="row" style={{ gap: 6 }}>
          {room.rooms.map((r, i) => (
            <span key={r.id} className="pill pill-outline">{i + 1}. {r.name}</span>
          ))}
          <span className="pill pill-muted">최종 토론</span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className="stat-chip"><Icon name="clock" size={13} />{room.meta.estimatedMinutes}분</span>
          <span className="stat-chip"><Icon name="user" size={13} />{Math.min(...room.meta.supportedPlayerCounts)}~{Math.max(...room.meta.supportedPlayerCounts)}인</span>
        </div>
      </div>

      <div className="card col">
        <strong>등장인물</strong>
        {room.roles.map((r) => (
          <div key={r.id} className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
            <span><strong>{r.name}</strong> <span className="dim">{r.job}</span></span>
            <span className="dim" style={{ fontSize: 12 }}>{r.perspective}</span>
          </div>
        ))}
        <p className="dim" style={{ fontSize: 11, margin: 0 }}>인원이 역할보다 적으면 한 사람이 역할을 함께 맡습니다.</p>
      </div>

      {!playable ? (
        <div className="card">아직 준비 중인 룸입니다.</div>
      ) : (
        <div className="card col">
          <label className="dim" style={{ fontSize: 12 }}>닉네임 (이름·학번·학교명은 쓰지 마세요)</label>
          <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="닉네임" />

          <div className="divider" style={{ margin: '8px 0' }} />
          <strong style={{ fontSize: 14 }}>방 만들기</strong>
          <div className="row">
            {room.meta.supportedPlayerCounts.map((n) => (
              <button key={n} className={`mr-small ${count === n ? 'mr-selected' : ''}`} onClick={() => setCount(n)}>{n}인</button>
            ))}
          </div>
          <button className="primary" disabled={busy} style={{ alignSelf: 'flex-start' }} onClick={() => run(() => createMysteryRoom({ scenarioId, playerCount: count, name: name.trim(), uid }))}>
            {count}인 방 만들기
          </button>

          <div className="divider" style={{ margin: '8px 0' }} />
          <strong style={{ fontSize: 14 }}>방 코드로 들어가기</strong>
          <div className="row">
            <input value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD" style={{ width: 110, fontFamily: 'var(--font-mono)', letterSpacing: '0.2em' }} />
            <button disabled={busy || code.length !== 4} onClick={() => run(async () => (await joinMysteryRoom({ code, name: name.trim(), uid, scenarioId }), code))}>
              들어가기
            </button>
          </div>
          {error && <p style={{ color: 'var(--blood-light)', fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      )}
    </div>
  )
}
