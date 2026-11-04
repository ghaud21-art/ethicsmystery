import { useEffect, useState } from 'react'
import { getStore } from '../store'
import { loadMysteryRoom } from '../loader'
import { STAGE_LABEL } from '../useDebate'
import { fmtTime } from '../components/common'
import '../mysteryroom.css'

// 교사용 진행 현황(융합 보드). 최근 6시간 안에 만든 방을 실시간으로 보여 준다.
// 모둠별 현재 방과 장면, 단서(방마다 융합 요소 표시), 실패·힌트, 토론 단계와 입장 분포.
const RECENT_MS = 6 * 60 * 60 * 1000

export default function MysteryLiveBoard() {
  const [rooms, setRooms] = useState(null)
  const [error, setError] = useState(null)
  const [defs, setDefs] = useState({})
  const [now, setNow] = useState(Date.now())

  useEffect(() => getStore().subscribe('', (v) => setRooms(v ?? {}), (e) => setError(e.message)), [])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const list = Object.entries(rooms ?? {})
    .filter(([, r]) => r?.meta && now - (r.meta.createdAt ?? 0) < RECENT_MS)
    .sort((a, b) => (b[1].meta.createdAt ?? 0) - (a[1].meta.createdAt ?? 0))

  // 룸 정의(제목, 장면)는 처음 보일 때 한 번만 불러온다.
  useEffect(() => {
    const ids = [...new Set(list.map(([, r]) => r.meta.scenarioId))].filter((id) => !(id in defs))
    ids.forEach((id) =>
      loadMysteryRoom(id)
        .then((def) => setDefs((d) => ({ ...d, [id]: def })))
        .catch(() => setDefs((d) => ({ ...d, [id]: null }))),
    )
  }, [list, defs])

  const unlockHint = (code, scene) => getStore().set(`${code}/state/hintsUnlocked/${scene}`, true)

  return (
    <div className="col">
      <h2 className="page-title" style={{ fontSize: 19 }}>미스터리 룸 진행 현황</h2>
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>최근 6시간 안에 만든 방이 실시간으로 보입니다. 전면 화면에 띄워 모둠별 진행을 함께 볼 수 있어요.</p>
      {error ? (
        <p className="dim" style={{ fontSize: 12 }}>진행 현황을 불러오지 못했습니다. Realtime Database 규칙(mysteryRooms)을 배포했는지 확인해 주세요. ({error})</p>
      ) : !rooms ? (
        <div className="dim">불러오는 중...</div>
      ) : list.length === 0 ? (
        <p className="dim">진행 중인 방이 없어요.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="mr-board-row mr-board-head">
            <span>방 코드</span><span>룸 · 지금 위치</span><span>단서 (융합 요소)</span><span>인원</span><span>실패</span><span>힌트</span><span>남은 시간</span>
          </div>
          {list.map(([code, r]) => {
            const def = defs[r.meta.scenarioId]
            const st = r.state
            const scene = def && st ? def.scenes[st.scene] : null
            const roomName = def?.rooms.find((x) => x.id === scene?.room)?.name
            const players = Object.values(r.players ?? {})
            const limit = (def?.meta.estimatedMinutes ?? 30) * 60
            const left = st?.startedAt ? Math.max(0, limit - Math.floor((now - st.startedAt) / 1000)) : null
            const deb = r.debate
            const stanceLabel = (id) => def?.debate?.stances?.find((s) => s.id === id)?.label ?? id
            const dist = (map) => Object.entries(Object.values(map ?? {}).reduce((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {})).map(([k, n]) => `${stanceLabel(k)} ${n}`).join(', ')
            return (
              <div key={code}>
                <div className="mr-board-row">
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold-light)' }}>{code}</strong>
                  <span>
                    {def?.meta.title ?? r.meta.scenarioId}
                    <br />
                    <span className="dim" style={{ fontSize: 12 }}>
                      {!st ? '모둠 준비 중' : scene?.end ? `엔딩: ${scene.end.name}` : `${roomName ?? ''} ${scene?.title ?? st.scene}`}
                    </span>
                  </span>
                  <span className="row" style={{ gap: 4 }}>
                    {(def?.rooms ?? []).map((x) => (
                      <span key={x.id} className="mr-tag" style={{ opacity: st?.clues?.[x.clue] ? 1 : 0.35 }} title={x.name}>
                        {x.fusion ?? x.clue}
                      </span>
                    ))}
                  </span>
                  <span>{players.length}/{r.meta.playerCount}</span>
                  <span>{st?.failedTotal ?? 0}</span>
                  <span>{Object.keys(st?.hintsUsed ?? {}).length}</span>
                  <span>
                    {scene?.end ? '종료' : left !== null ? fmtTime(left) : '-'}
                    {scene?.puzzle && !st.hintsUnlocked?.[st.scene] && (
                      <button className="mr-small" style={{ display: 'block', marginTop: 4 }} onClick={() => unlockHint(code, st.scene)}>힌트 열어 주기</button>
                    )}
                  </span>
                </div>
                {deb && (
                  <div className="dim" style={{ fontSize: 12, padding: '0 12px 10px' }}>
                    토론: {STAGE_LABEL[deb.stage ?? 'pre']}
                    {deb.before && ` · 토론 전 [${dist(deb.before)}]`}
                    {deb.after && ` → 토론 후 [${dist(deb.after)}]`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
