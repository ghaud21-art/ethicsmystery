import { Icon, MaterialCard, NoteCard, PlayerDots, fmtTime, useMr } from './common'
import { PuzzleArea } from './puzzles'
import { computeGrade, GRADE_TEXT } from '../engine'

function ChoiceVote({ scene }) {
  const { mr } = useMr()
  const now = mr.now
  const round = mr.state.voteRound ?? 1
  const myVote = mr.votes[mr.uid]
  const voted = Object.fromEntries(mr.playerUids.map((u) => [u, mr.votes[u] !== undefined]))
  const solo = mr.playerUids.length === 1
  const left = scene.timer && mr.state.sceneAt ? Math.max(0, scene.timer - Math.floor((now - mr.state.sceneAt) / 1000)) : null
  const split = mr.state.split
  return (
    <div className="col" style={{ gap: 10 }}>
      {split && (
        <div className="mr-split">
          의견이 갈렸어요:{' '}
          {scene.choices.map((c, i) => `‘${c.t}’ ${Object.values(split.counts ?? {}).filter((v) => v === i).length}명`).join(', ')}.
          <br />서로 이유를 말해 보세요. 다시 고르면 이번에는 다수결로 정합니다.
        </div>
      )}
      {left !== null && !solo && (
        <div className="mr-status"><Icon name="clock" size={12} />이야기 나누는 시간 {fmtTime(left)}{left === 0 ? ' · 이제 골라 주세요' : ''}</div>
      )}
      <div className="mr-choices">
        {scene.choices.map((c, i) => (
          <button key={i} className={`mr-choice ${myVote === i ? 'mr-selected' : ''}`} onClick={() => mr.actions.vote(i)}>
            {c.t}
          </button>
        ))}
      </div>
      {!solo && (
        <>
          <PlayerDots map={voted} label={round > 1 ? '다시 고른 사람' : '고른 사람'} />
          <span className="dim" style={{ fontSize: 11 }}>모두 고르면 한꺼번에 공개됩니다. 고르기 전에 서로 의견을 나눠 보세요.</span>
        </>
      )}
    </div>
  )
}

function ReadyButton({ disabled, label = '다음' }) {
  const { mr } = useMr()
  const iReady = !!mr.readyMap[mr.uid]
  const solo = mr.playerUids.length === 1
  return (
    <div className="col" style={{ gap: 8 }}>
      <button className="primary" style={{ alignSelf: 'flex-start' }} disabled={disabled || iReady} onClick={mr.actions.ready}>
        {iReady ? '다른 사람을 기다리는 중' : `${label} →`}
      </button>
      {!solo && <PlayerDots map={mr.readyMap} label="준비" />}
    </div>
  )
}

function RequireShared({ scene }) {
  const { room, mr } = useMr()
  const all = mr.solo || scene.requireShared.every((m) => mr.shared[`m:${m}`])
  return (
    <div className="col" style={{ gap: 10 }}>
      {scene.requireShared.map((m) => <MaterialCard key={m} id={m} />)}
      {!mr.solo && <div className="mr-status">
        공유된 기록 {scene.requireShared.filter((m) => mr.shared[`m:${m}`]).length}/{scene.requireShared.length}
        {!all && ' · 모든 기록이 공유되어야 넘어갈 수 있어요'}
      </div>}
      <ReadyButton disabled={!all} />
      <span className="dim" style={{ fontSize: 11 }}>{room.roles.length > mr.playerUids.length ? '통합된 역할의 기록도 맡은 사람이 공유합니다.' : ''}</span>
    </div>
  )
}

function DebatePlaceholder({ scene }) {
  const { mr } = useMr()
  return (
    <div className="mr-feedback" style={{ background: 'rgba(94,145,224,0.1)', borderColor: 'rgba(94,145,224,0.4)' }}>
      <div className="mr-feedback-line">최종 토론</div>
      <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.6 }}>
        최종 토론 화면(발언 라운드, 질문 카드, 반전 카드, 합의)은 다음 단계에서 들어갑니다. 지금은 시험용 버튼으로 넘어갑니다.
      </p>
      {mr.isHost ? <button onClick={mr.actions.finishDebatePlaceholder}>토론을 마친 것으로 하고 넘어가기 (시험용)</button> : <span className="dim">방장이 넘어가기를 누르면 진행됩니다.</span>}
    </div>
  )
}

function Ending({ scene }) {
  const { mr } = useMr()
  const grade = computeGrade(scene.end.kind, mr.state)
  const canRetry = scene.end.kind === 'bad' && scene.end.retry
  return (
    <div className="col" style={{ gap: 12, alignItems: 'flex-start' }}>
      <div className="row" style={{ gap: 16, alignItems: 'center' }}>
        <div className="mr-ending-grade">{canRetry ? 'B' : grade}</div>
        <div>
          <div className="kicker" style={{ margin: 0 }}>{scene.end.kind === 'true' ? 'TRUE ENDING' : scene.end.kind === 'good' ? 'GOOD ENDING' : scene.end.kind === 'bad' ? 'BAD ENDING' : 'TIME OVER'}</div>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18 }}>{scene.end.name}</div>
          <div className="dim" style={{ fontSize: 12 }}>{GRADE_TEXT[canRetry ? 'B' : grade]}</div>
        </div>
      </div>
      <div className="mr-note" style={{ width: '100%' }}><div className="mr-note-cap">통찰</div><p>{scene.end.line}</p></div>
      {canRetry && (
        <>
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>그 방 입구에서 한 번 더 도전할 수 있습니다. 다시 탈출하면 S까지 받을 수 있어요.</p>
          <button className="primary" onClick={() => mr.actions.retry(scene.end.retry)}>그 방 입구에서 다시 도전</button>
        </>
      )}
      {!canRetry && <p className="dim" style={{ margin: 0, fontSize: 12 }}>결과 화면(성찰 질문, 이미지 저장, 선생님께 제출)은 다음 단계에서 이어집니다.</p>}
    </div>
  )
}

export default function SceneView() {
  const { room, mr } = useMr()
  const sceneId = mr.state.scene
  const scene = mr.scene
  const roomInfo = room.rooms.find((r) => r.id === scene.room)
  const singleChoice = scene.choices?.length === 1

  let interaction = null
  if (scene.end) interaction = <Ending scene={scene} />
  else if (scene.puzzle) interaction = <PuzzleArea key={sceneId} sceneId={sceneId} puzzle={scene.puzzle} />
  else if (scene.type === 'debate') interaction = <DebatePlaceholder scene={scene} />
  else if (scene.requireShared) interaction = <RequireShared scene={scene} />
  else if (scene.choices?.length > 1) interaction = <ChoiceVote key={sceneId} scene={scene} />
  else if (singleChoice) interaction = <ReadyButton label={scene.choices[0].t} />
  else if (scene.next) interaction = <ReadyButton />
  else if (scene.gate) interaction = <div className="dim">문이 단서를 읽고 있다...</div>

  return (
    <div className="card">
      <div className="mr-scene-kicker">{scene.kicker ?? roomInfo?.name ?? '미스터리룸'}</div>
      <h2 className="mr-scene-title">{scene.title}</h2>
      <div className="mr-body">
        {(scene.body ?? []).map((b, i) =>
          typeof b === 'string' ? <p key={i}>{b}</p> : b.material ? <MaterialCard key={i} id={b.material} /> : <NoteCard key={i} block={b} keyPrefix={`l:${sceneId}:${i}`} />,
        )}
      </div>
      {interaction && <div style={{ marginTop: 14 }}>{interaction}</div>}
    </div>
  )
}
