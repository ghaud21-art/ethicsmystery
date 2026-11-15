import { useEffect, useState } from 'react'
import { getStore } from '../store'
import { loadMysteryRoom } from '../loader'
import { STAGE_LABEL } from '../useDebate'
import { fmtTime } from '../components/common'
import { setPause } from '../engine'
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
  const release = (code) => getStore().set(`${code}/release`, true)
  // 전체 주목: 진행 중인 방 모두의 화면을 '선생님을 봐 주세요'로 덮고 타이머를 멈춘다.
  const activeCodes = list.filter(([, r]) => r.state && !defs[r.meta.scenarioId]?.scenes?.[r.state.scene]?.end).map(([c]) => c)
  const attentionOn = list.some(([, r]) => r.state?.pause?.reasons?.att)
  const setAttention = (codes, on) =>
    codes.forEach((c) => getStore().transaction(`${c}/state`, (cur) => (cur ? setPause(cur, 'att', on) : undefined)))
  // 체크포인트: 룸별로 체크포인트 장면을 모아, 도착한 모둠 수와 '모두 열기' 버튼을 보여 준다.
  const checkpoints = []
  for (const [sid, def] of Object.entries(defs)) {
    if (!def) continue
    const roomsOf = list.filter(([, r]) => r.meta.scenarioId === sid && r.state)
    if (!roomsOf.length) continue
    for (const [sceneId, sc] of Object.entries(def.scenes)) {
      if (sc.type !== 'checkpoint') continue
      const id = sc.checkpoint?.id ?? sceneId
      const arrived = roomsOf.filter(([, r]) => r.state.scene === sceneId).length
      const opened = roomsOf.filter(([, r]) => r.cp?.[id]).length
      checkpoints.push({ sid, title: def.meta.title, id, label: sc.checkpoint?.title ?? sc.title, arrived, total: roomsOf.length, opened, codes: roomsOf.map(([c]) => c) })
    }
  }
  const openCp = (cp) => cp.codes.forEach((c) => getStore().set(`${c}/cp/${cp.id}`, true))
  const endedCodes = list.filter(([, r]) => {
    const sc = defs[r.meta.scenarioId]?.scenes?.[r.state?.scene]
    return sc?.end && sc.end.kind !== 'bad' && !r.release
  }).map(([c]) => c)

  return (
    <div className="col">
      <h2 className="page-title" style={{ fontSize: 19 }}>미스터리 룸 진행 현황</h2>
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>최근 6시간 안에 만든 방이 실시간으로 보입니다. 전면 화면에 띄워 모둠별 진행을 함께 볼 수 있어요.</p>
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>엔딩에 도착한 모둠은 ‘선생님의 다음 안내를 기다려 주세요’ 화면에서 멈춥니다. 정리할 때 ‘성찰 열기’를 누르면 결과 카드와 성찰 질문이 열립니다.</p>
      {activeCodes.length > 0 && (
        <div className="row" style={{ gap: 8 }}>
          <button className={attentionOn ? '' : 'primary'} onClick={() => setAttention(attentionOn ? list.map(([c]) => c) : activeCodes, !attentionOn)}>
            {attentionOn ? '전체 주목 해제 (다시 진행)' : `전체 주목 (진행 중 ${activeCodes.length}개 모둠 화면 멈춤)`}
          </button>
          <span className="dim" style={{ fontSize: 11 }}>학생 화면에 ‘선생님을 봐 주세요’가 뜨고 게임 타이머가 멈춥니다.</span>
        </div>
      )}
      {checkpoints.length > 0 && (
        <div className="card col" style={{ gap: 6 }}>
          <strong style={{ fontSize: 13 }}>선생님 체크포인트</strong>
          {checkpoints.map((cp) => (
            <div key={cp.sid + cp.id} className="row" style={{ gap: 10, justifyContent: 'space-between' }}>
              <span>{cp.title} · <strong>{cp.label}</strong> <span className="dim">도착 {cp.arrived}/{cp.total}모둠{cp.opened === cp.total ? ' · 열림' : ''}</span></span>
              {cp.opened < cp.total && <button className={cp.arrived === cp.total ? 'primary' : ''} onClick={() => openCp(cp)}>모든 모둠 다음 단계 열기</button>}
            </div>
          ))}
          <span className="dim" style={{ fontSize: 11 }}>체크포인트에 도착한 모둠은 대기 화면에서 멈추고 타이머도 멈춥니다. 반 전체 토론을 마친 뒤 열어 주세요. 아직 도착하지 않은 모둠은 도착하자마자 바로 통과합니다.</span>
        </div>
      )}
      {endedCodes.length > 0 && (
        <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={() => endedCodes.forEach(release)}>엔딩에 도착한 {endedCodes.length}개 모둠 성찰 열기</button>
      )}
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
                    {scene?.end ? (r.release ? '종료 · 성찰 열림' : `종료${Object.keys(r.releaseBy ?? {}).length ? ` · 학생 ${Object.keys(r.releaseBy).length}명 직접 열람` : ''}`) : left !== null ? fmtTime(left) : '-'}
                    {scene?.end && scene.end.kind !== 'bad' && !r.release && (
                      <button className="mr-small" style={{ display: 'block', marginTop: 4 }} onClick={() => release(code)}>성찰 열기</button>
                    )}
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
