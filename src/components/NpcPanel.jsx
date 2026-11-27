import { useState } from 'react'
import { getNpcs } from '../engine/characterAssignment.js'
import {
  npcSilent, npcWrongTotal, npcSecretVisibleTo, npcSecretOpenedBy, presentableItems, presentToNpc, publishNpcSecret,
  npcInvestigationClue, DEFAULT_NPC_WRONG_LIMIT,
} from '../engine/npcEngine.js'

// NPC 심문 — 1단계: 공개 진술과 조사 카드 안내 / 2단계: 단서를 내밀어 비밀을 연다.
export default function NpcPanel({ scenario, room, uid, myCharacterId, roomCode, phase }) {
  const playerCount = room.meta?.playerCount
  const npcs = getNpcs(scenario, playerCount)
  if (!npcs.length) return null
  return (
    <div style={{ marginTop: 22 }}>
      <h2 className="page-title" style={{ fontSize: 18 }}>NPC 심문</h2>
      <p className="dim" style={{ fontSize: 12, marginTop: -4, lineHeight: 1.6 }}>
        이번 판에서 아무도 맡지 않은 인물입니다. 공개 진술은 누구나 볼 수 있어요.
        {phase === 'phase1'
          ? ' 조사 카드는 위 단서 목록에서 AP로 조사할 수 있고, 다음 단계(심층 대질)에서 단서를 내밀어 숨긴 이야기를 열 수 있습니다.'
          : ' 가진 단서 1장을 내밀어 보세요. 알맞은 열쇠 단서면 비밀이 한 층 열리고, 아니면 회피합니다. 틀린 단서를 너무 많이 내밀면 입을 닫습니다.'}
      </p>
      <div className="col">
        {npcs.map((npc) => (
          <NpcCard key={npc.id} npc={npc} scenario={scenario} room={room} uid={uid} myCharacterId={myCharacterId} roomCode={roomCode} phase={phase} />
        ))}
      </div>
    </div>
  )
}

function NpcCard({ npc, scenario, room, uid, myCharacterId, roomCode, phase }) {
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const playerCount = room.meta?.playerCount
  const items = presentableItems(scenario, room, uid, myCharacterId, playerCount)
  const silent = npcSilent(room, npc)
  const limit = npc.wrongLimit ?? DEFAULT_NPC_WRONG_LIMIT
  const wrong = npcWrongTotal(room, npc.id)
  const inv = npcInvestigationClue(scenario, npc)
  const levels = (npc.keys ?? []).map((k) => k.level)

  const present = async () => {
    const item = items.find((i) => i.key === pick)
    if (!item) return
    setBusy(true)
    try {
      setResult(await presentToNpc(roomCode, uid, scenario, room, npc, item))
    } catch (e) {
      setResult({ kind: 'error', text: e.message })
    } finally {
      setBusy(false)
      setPick('')
    }
  }

  return (
    <div className="card col" style={{ marginBottom: 0, borderLeft: '2px solid var(--gold)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>
          <div className="avatar-circle">{npc.name[0]}</div>
          <div>
            <strong style={{ fontFamily: 'var(--font-head)' }}>{npc.name}</strong>
            <div className="dim" style={{ fontSize: 12 }}>{npc.role}{npc.fromCharacter ? ' · 이번 판 NPC' : ' · 상시 NPC'}</div>
          </div>
        </div>
        {silent && <span className="pill pill-muted">입을 닫음</span>}
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>“{npc.publicStatement}”</p>
      {inv && <p className="dim" style={{ margin: 0, fontSize: 12 }}>조사 카드: <strong>{inv.title}</strong> (단서 목록에서 조사)</p>}

      {[...new Set(levels)].sort().map((lv) => {
        const visible = npcSecretVisibleTo(room, uid, npc.id, lv)
        if (!visible) return null
        const key = npc.keys.find((k) => k.level === lv)
        const iOpened = !!room.players?.[uid]?.npc?.[npc.id]?.[`l${lv}`]
        const published = Object.values(room.players ?? {}).some((p) => p?.npc?.[npc.id]?.[`l${lv}Pub`])
        const openers = npcSecretOpenedBy(room, npc.id, lv).map((u) => room.players?.[u]?.name).filter(Boolean)
        return (
          <div key={lv} style={{ background: 'rgba(201,162,39,.12)', borderLeft: '2px solid var(--gold)', padding: 10, borderRadius: 4 }}>
            <div className="kicker" style={{ marginBottom: 4 }}>{lv === 1 ? '첫 번째 비밀' : '두 번째 비밀'} · {openers.join(', ')} 열람</div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{key?.secret}</p>
            {published ? (
              <span className="pill pill-solid" style={{ marginTop: 6, display: 'inline-block' }}>모둠에 공개됨</span>
            ) : iOpened ? (
              <button style={{ marginTop: 6, fontSize: 12 }} onClick={() => publishNpcSecret(roomCode, uid, npc.id, lv)}>모둠에 공개하기</button>
            ) : null}
          </div>
        )
      })}

      {phase === 'phase2' && (
        <div className="col" style={{ gap: 6 }}>
          {silent ? (
            <p className="dim" style={{ margin: 0, fontSize: 12 }}>틀린 단서를 {limit}번 받아 {npc.name}은(는) 더 이상 말하지 않는다. (이미 열 수 있는 비밀이 있다면 열쇠 단서로는 여전히 열 수 있다)</p>
          ) : (
            <span className="dim" style={{ fontSize: 12 }}>모둠 전체의 남은 오답 기회 {Math.max(0, limit - wrong)}회</span>
          )}
          <div className="row" style={{ gap: 6 }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
              <option value="">내밀 단서 고르기…</option>
              {items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
            </select>
            <button className="primary" disabled={!pick || busy} onClick={present}>내밀기</button>
          </div>
          {!items.length && <span className="dim" style={{ fontSize: 12 }}>아직 내밀 수 있는 단서가 없다. 단서를 확보하거나 팀원이 공개하면 쓸 수 있다.</span>}
          {result && (
            <div className="mr-feedback" style={{ padding: 8, fontSize: 13 }}>
              {result.kind === 'opened' && <>{npc.name}의 {result.level === 1 ? '첫 번째' : '두 번째'} 비밀이 열렸다. 지금은 당신만 볼 수 있다 — 모둠에 공개할지 정하세요.</>}
              {result.kind === 'evade' && <>{npc.name}: “{result.text}” <span className="dim">(오답 +1)</span></>}
              {result.kind === 'already' && <>이미 들은 이야기다.</>}
              {result.kind === 'notYet' && <>{npc.name}은(는) 그 이야기까지 할 생각이 없어 보인다. 먼저 첫 번째 비밀을 열어야 한다.</>}
              {result.kind === 'silent' && <>{npc.name}은(는) 고개를 돌린다. 더 이상 말하지 않는다.</>}
              {result.kind === 'error' && <>{result.text}</>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
