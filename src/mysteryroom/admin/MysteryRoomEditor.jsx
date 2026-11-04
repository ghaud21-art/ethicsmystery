import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Masthead from '../../components/Masthead.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { getScenario, saveScenario } from '../../firebase/scenariosApi.js'
import { decodeNested } from '../firestoreCodec'
import { validateRoom } from '../schema'
import { MaterialTable } from '../components/common'
import { isLocalMode } from '../store'
import '../mysteryroom.css'

// 개발 서버의 로컬 모드에서는 견본 파일로 편집 화면을 확인한다(저장은 하지 않음).
const DEV_LOCAL = import.meta.env.DEV && isLocalMode()

// 미스터리룸 플레이형 편집: 장면을 플레이 순서대로 따라가며 그 자리에서 고친다.
// 왼쪽 장면 목록 → 가운데 미리보기(선택지를 누르면 그 장면으로 이동) → 아래 편집 폼.
// 퍼즐 설정, 관문처럼 구조가 복잡한 값은 JSON으로 고친다. 저장 전에 룸 검사를 한다.

const clone = (v) => JSON.parse(JSON.stringify(v))

function Field({ label, value, onChange, multiline, rows = 3, width }) {
  return (
    <label style={{ display: 'block', marginBottom: 10, flex: width ? undefined : 1, width, minWidth: 140 }}>
      <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>{label}</span>
      {multiline ? (
        <textarea rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', fontSize: 13, lineHeight: 1.55 }} />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }} />
      )}
    </label>
  )
}

function JsonField({ label, value, onChange, rows = 8 }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [err, setErr] = useState(null)
  useEffect(() => setText(JSON.stringify(value ?? null, null, 2)), [value])
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>{label} (JSON, 칸 밖을 누르면 반영)</span>
      <textarea
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            onChange(text.trim() === '' || text.trim() === 'null' ? undefined : JSON.parse(text))
            setErr(null)
          } catch {
            setErr('JSON 형식이 올바르지 않습니다. 고쳐야 반영됩니다.')
          }
        }}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
      />
      {err && <span style={{ color: 'var(--blood-light)', fontSize: 11 }}>{err}</span>}
    </label>
  )
}

// 플레이 순서(시작 장면부터 연결을 따라가며)로 장면을 늘어놓는다. 연결되지 않은 장면은 끝에.
function sceneOrder(room) {
  const order = []
  const seen = new Set()
  const queue = [room.start]
  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id) || !room.scenes[id]) continue
    seen.add(id)
    order.push(id)
    const s = room.scenes[id]
    const nexts = [s.next, s.puzzle?.onSolve, s.end?.retry, ...(s.choices ?? []).map((c) => c.to), ...(s.gate ?? []).map((g) => g.to)]
    nexts.forEach((n) => n && queue.push(String(n)))
  }
  if (room.timeoutScene && !seen.has(room.timeoutScene)) {
    order.push(room.timeoutScene)
    seen.add(room.timeoutScene)
  }
  const orphans = Object.keys(room.scenes).filter((id) => !seen.has(id))
  return { order, orphans }
}

function sceneBadge(s) {
  if (s.end) return { text: s.end.kind.toUpperCase(), cls: s.end.kind === 'bad' ? 'blood' : '' }
  if (s.puzzle) return { text: s.puzzle.module === 'lock' ? '자물쇠' : '퍼즐', cls: '' }
  if (s.type === 'debate') return { text: '토론', cls: '' }
  if (s.gate) return { text: '관문', cls: '' }
  if (s.choices?.length > 1) return { text: '선택', cls: 'blue' }
  return null
}

// ---- 장면 미리보기 (학생 화면처럼, 혼자 모든 자료를 보는 상태) ----
function ScenePreview({ room, id, go }) {
  const s = room.scenes[id]
  const roomInfo = room.rooms.find((r) => r.id === s.room)
  const roleName = (rid) => room.roles.find((r) => r.id === rid)?.name ?? rid
  return (
    <div className="card">
      <div className="mr-scene-kicker">{s.kicker ?? roomInfo?.name ?? '미스터리룸'} · 장면 {id}</div>
      <h2 className="mr-scene-title">{s.title}</h2>
      <div className="mr-body">
        {(s.body ?? []).map((b, i) =>
          typeof b === 'string' ? (
            <p key={i}>{b}</p>
          ) : b.roleCard ? (
            <div key={i} className="mr-mat" style={{ borderColor: 'var(--gold)' }}><div className="mr-mat-title">내 관점 카드 (학생마다 자기 역할 카드가 보임)</div></div>
          ) : b.material ? (
            <div key={i} className="mr-mat"><div className="mr-mat-title">{room.materials[b.material]?.title}</div></div>
          ) : (
            <div key={i} className="mr-note">
              <div className="mr-note-cap">{b.note}</div>
              {(b.lines ?? []).map((l, j) => <p key={j}>{l}</p>)}
              {Object.entries(b.lens ?? {}).map(([rid, l]) => (
                <div key={rid} className="mr-lens"><div className="mr-lens-who">{roleName(rid)}의 시선 (깊이 보기)</div>{l.text}</div>
              ))}
            </div>
          ),
        )}
      </div>
      <div className="col" style={{ gap: 8, marginTop: 12 }}>
        {s.choices?.map((c, i) => (
          <button key={i} className="mr-choice" onClick={() => go(c.to)}>{c.t} <span className="dim">→ {c.to}</span></button>
        ))}
        {s.next && <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={() => go(s.next)}>다음 → {s.next}</button>}
        {s.puzzle && (
          <div className="mr-mat">
            <div className="mr-mat-title"><span>퍼즐: {s.puzzle.module}{s.puzzle.clue ? ` · 단서 ${s.puzzle.clue}` : ''}</span></div>
            <p className="dim">정답을 맞히면 → {s.puzzle.onSolve}. 퍼즐 화면은 ‘테스트 플레이’에서 직접 풀어 볼 수 있어요.</p>
            <button className="mr-small" style={{ marginTop: 6 }} onClick={() => go(s.puzzle.onSolve)}>정답 처리하고 다음으로</button>
          </div>
        )}
        {s.gate?.map((g, i) => (
          <button key={i} className="mr-choice" onClick={() => go(g.to)}>관문 조건 ‘{g.if}’ → {g.to}</button>
        ))}
        {s.type === 'debate' && <p className="dim" style={{ margin: 0 }}>최종 토론 화면이 나옵니다(토론·성찰 탭에서 편집). {s.next && <button className="mr-small" onClick={() => go(s.next)}>토론 뒤 → {s.next}</button>}</p>}
        {s.end && (
          <div className="mr-note">
            <div className="mr-note-cap">{s.end.kind.toUpperCase()} 엔딩 · {s.end.name}</div>
            <p>{s.end.line}</p>
            {s.end.retry && <button className="mr-small" style={{ marginTop: 6 }} onClick={() => go(s.end.retry)}>다시 도전 → {s.end.retry}</button>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- 장면 편집 폼 ----
function SceneForm({ room, id, setScene, renameScene, deleteScene }) {
  const s = room.scenes[id]
  const ids = Object.keys(room.scenes)
  const set = (patch) => setScene(id, { ...s, ...patch })
  const setBody = (body) => set({ body })
  const body = s.body ?? []
  const move = (i, d) => {
    const b = [...body]
    const j = i + d
    if (j < 0 || j >= b.length) return
    ;[b[i], b[j]] = [b[j], b[i]]
    setBody(b)
  }
  const [newId, setNewId] = useState(id)
  useEffect(() => setNewId(id), [id])

  return (
    <div className="card col">
      <strong>장면 {id} 편집</strong>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <Field label="제목" value={s.title} onChange={(v) => set({ title: v })} />
        <Field label="머리말(비우면 방 이름)" value={s.kicker} onChange={(v) => set({ kicker: v || undefined })} />
        <label style={{ minWidth: 140 }}>
          <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>방</span>
          <select value={s.room ?? ''} onChange={(e) => set({ room: e.target.value || undefined })} style={{ width: '100%' }}>
            <option value="">(방 밖)</option>
            {room.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      </div>

      <strong style={{ fontSize: 13 }}>본문</strong>
      {body.map((b, i) => (
        <div key={i} className="mr-mat">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="mr-tag">{typeof b === 'string' ? '문단' : b.roleCard ? '관점 카드' : b.material ? '자료' : '메모 카드'}</span>
            <span className="row" style={{ gap: 4 }}>
              <button className="mr-small" onClick={() => move(i, -1)}>위로</button>
              <button className="mr-small" onClick={() => move(i, 1)}>아래로</button>
              <button className="mr-small" onClick={() => setBody(body.filter((_, j) => j !== i))}>삭제</button>
            </span>
          </div>
          {typeof b === 'string' ? (
            <Field label="문단" multiline value={b} onChange={(v) => setBody(body.map((x, j) => (j === i ? v : x)))} />
          ) : b.roleCard ? (
            <span className="dim" style={{ fontSize: 12 }}>이 자리에 학생마다 자기 관점 카드가 나옵니다.</span>
          ) : b.material ? (
            <label>
              <select value={b.material} onChange={(e) => setBody(body.map((x, j) => (j === i ? { material: e.target.value } : x)))}>
                {Object.entries(room.materials).map(([mid, m]) => <option key={mid} value={mid}>{m.title}</option>)}
              </select>
            </label>
          ) : (
            <>
              <Field label="메모 제목" value={b.note} onChange={(v) => setBody(body.map((x, j) => (j === i ? { ...x, note: v } : x)))} />
              <Field label="내용 (줄마다 한 문단)" multiline value={(b.lines ?? []).join('\n')} onChange={(v) => setBody(body.map((x, j) => (j === i ? { ...x, lines: v.split('\n') } : x)))} />
              <span className="dim" style={{ fontSize: 11 }}>관점 렌즈 (그 역할에게만 ‘깊이 보기’로 보임. 비우면 없음)</span>
              {room.roles.map((r) => (
                <div key={r.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <Field
                    label={`${r.name}의 시선`}
                    multiline
                    rows={2}
                    value={b.lens?.[r.id]?.text}
                    onChange={(v) => {
                      const lens = { ...(b.lens ?? {}) }
                      if (v.trim()) lens[r.id] = { ...(lens[r.id] ?? {}), text: v }
                      else delete lens[r.id]
                      setBody(body.map((x, j) => (j === i ? { ...x, lens: Object.keys(lens).length ? lens : undefined } : x)))
                    }}
                  />
                  {b.lens?.[r.id] && (
                    <label style={{ width: 160 }}>
                      <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>따라오는 개념</span>
                      <select
                        value={b.lens[r.id].concept ?? ''}
                        onChange={(e) => setBody(body.map((x, j) => (j === i ? { ...x, lens: { ...x.lens, [r.id]: { ...x.lens[r.id], concept: e.target.value || undefined } } } : x)))}
                        style={{ width: '100%' }}
                      >
                        <option value="">(없음)</option>
                        {room.concepts.map((c) => <option key={c.k} value={c.k}>{c.name}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      ))}
      <div className="row">
        <button className="mr-small" onClick={() => setBody([...body, ''])}>+ 문단</button>
        <button className="mr-small" onClick={() => setBody([...body, { note: '메모', lines: [''] }])}>+ 메모 카드</button>
        <button className="mr-small" onClick={() => setBody([...body, { roleCard: true }])}>+ 관점 카드</button>
        <label className="row" style={{ gap: 4, fontSize: 12 }}>
          <input type="checkbox" checked={!!s.readAloud} onChange={(e) => set({ readAloud: e.target.checked || undefined })} />
          돌아가며 소리 내어 읽기 (문단마다 읽을 사람 표시)
        </label>
        {Object.keys(room.materials).length > 0 && <button className="mr-small" onClick={() => setBody([...body, { material: Object.keys(room.materials)[0] }])}>+ 자료</button>}
      </div>

      {!s.puzzle && !s.end && !s.gate && s.type !== 'debate' && (
        <>
          <strong style={{ fontSize: 13 }}>선택지 (2개 이상이면 모둠 투표, 1개면 ‘다음’ 버튼 문구)</strong>
          {(s.choices ?? []).map((c, i) => (
            <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
              <Field label={`선택지 ${i + 1}`} value={c.t} onChange={(v) => set({ choices: s.choices.map((x, j) => (j === i ? { ...x, t: v } : x)) })} />
              <label style={{ width: 160, marginBottom: 10 }}>
                <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>이동할 장면</span>
                <select value={c.to} onChange={(e) => set({ choices: s.choices.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} style={{ width: '100%' }}>
                  {ids.map((x) => <option key={x} value={x}>{x} · {room.scenes[x].title}</option>)}
                </select>
              </label>
              <button className="mr-small" style={{ marginBottom: 10 }} onClick={() => set({ choices: s.choices.filter((_, j) => j !== i) })}>삭제</button>
            </div>
          ))}
          <div className="row">
            <button className="mr-small" onClick={() => set({ choices: [...(s.choices ?? []), { t: '새 선택지', to: id }], next: undefined })}>+ 선택지</button>
            {!s.choices?.length && (
              <label className="row" style={{ gap: 6 }}>
                <span className="dim" style={{ fontSize: 12 }}>또는 ‘다음’으로 갈 장면</span>
                <select value={s.next ?? ''} onChange={(e) => set({ next: e.target.value || undefined })}>
                  <option value="">(없음)</option>
                  {ids.map((x) => <option key={x} value={x}>{x} · {room.scenes[x].title}</option>)}
                </select>
              </label>
            )}
          </div>
          <Field label="작은 토론 타이머(초, 비우면 없음)" value={s.timer ?? ''} width={220} onChange={(v) => set({ timer: Number(v) || undefined })} />
        </>
      )}

      {s.end && (
        <>
          <strong style={{ fontSize: 13 }}>엔딩</strong>
          <div className="row" style={{ gap: 10 }}>
            <Field label="엔딩 이름" value={s.end.name} onChange={(v) => set({ end: { ...s.end, name: v } })} />
            <label style={{ width: 140 }}>
              <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>종류</span>
              <select value={s.end.kind} onChange={(e) => set({ end: { ...s.end, kind: e.target.value } })} style={{ width: '100%' }}>
                {['true', 'good', 'bad', 'timeout'].map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
          </div>
          <Field label="통찰 한 문장" multiline rows={2} value={s.end.line} onChange={(v) => set({ end: { ...s.end, line: v } })} />
          {s.end.kind === 'bad' && (
            <label>
              <span className="dim" style={{ fontSize: 11 }}>다시 도전할 장면 </span>
              <select value={s.end.retry ?? ''} onChange={(e) => set({ end: { ...s.end, retry: e.target.value || undefined } })}>
                <option value="">(없음)</option>
                {ids.map((x) => <option key={x} value={x}>{x} · {room.scenes[x].title}</option>)}
              </select>
            </label>
          )}
        </>
      )}

      {s.puzzle && (
        <>
          <strong style={{ fontSize: 13 }}>퍼즐</strong>
          <div className="row" style={{ gap: 10 }}>
            <Field label="틀렸을 때 이야기 문장" value={s.puzzle.wrongLine} onChange={(v) => set({ puzzle: { ...s.puzzle, wrongLine: v } })} />
            <label style={{ width: 180 }}>
              <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>정답 후 이동할 장면</span>
              <select value={s.puzzle.onSolve} onChange={(e) => set({ puzzle: { ...s.puzzle, onSolve: e.target.value } })} style={{ width: '100%' }}>
                {ids.map((x) => <option key={x} value={x}>{x} · {room.scenes[x].title}</option>)}
              </select>
            </label>
          </div>
          <Field label="힌트 (줄마다 하나)" multiline rows={2} value={(s.puzzle.hints ?? []).join('\n')} onChange={(v) => set({ puzzle: { ...s.puzzle, hints: v.split('\n').filter(Boolean) } })} />
          <JsonField label={`퍼즐 설정 (${s.puzzle.module})`} value={s.puzzle.config} rows={14} onChange={(v) => set({ puzzle: { ...s.puzzle, config: v } })} />
        </>
      )}

      {s.gate && <JsonField label="관문 조건 (위에서부터 처음 맞는 것으로 이동)" value={s.gate} rows={6} onChange={(v) => set({ gate: v })} />}
      {s.requireShared && <JsonField label="공유해야 넘어가는 자료 id" value={s.requireShared} rows={3} onChange={(v) => set({ requireShared: v })} />}
      <JsonField label="이 장면에서 얻는 개념 (learn)" value={s.learn} rows={2} onChange={(v) => set({ learn: v })} />

      <div className="row" style={{ borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
        <input value={newId} onChange={(e) => setNewId(e.target.value.trim())} style={{ width: 120 }} />
        <button className="mr-small" disabled={!newId || newId === id || room.scenes[newId]} onClick={() => renameScene(id, newId)}>장면 번호 바꾸기</button>
        <button className="mr-small" style={{ marginLeft: 'auto', borderColor: 'var(--blood-light)', color: 'var(--blood-light)' }} onClick={() => deleteScene(id)}>이 장면 삭제</button>
      </div>
    </div>
  )
}

function InfoTab({ draft, setDraft }) {
  const meta = (patch) => setDraft({ ...draft, meta: { ...draft.meta, ...patch } })
  return (
    <div className="col">
      <div className="card col">
        <strong>룸 정보</strong>
        <div className="row" style={{ gap: 10 }}>
          <Field label="제목" value={draft.meta.title} onChange={(v) => meta({ title: v })} />
          <Field label="부제목" value={draft.meta.subtitle} onChange={(v) => meta({ subtitle: v })} />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Field label="단원" value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} />
          <Field label="난이도" value={draft.difficulty} width={100} onChange={(v) => setDraft({ ...draft, difficulty: v })} />
          <Field label="제한 시간(분)" value={draft.meta.estimatedMinutes} width={110} onChange={(v) => meta({ estimatedMinutes: Number(v) || 0 })} />
          <Field label="인원 (쉼표로)" value={draft.meta.supportedPlayerCounts.join(', ')} width={140} onChange={(v) => meta({ supportedPlayerCounts: v.split(',').map((x) => Number(x.trim())).filter(Boolean) })} />
        </div>
        <Field label="태그 (쉼표로)" value={(draft.meta.themes ?? []).join(', ')} onChange={(v) => meta({ themes: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
        <Field label="배경 (소개 화면)" multiline value={draft.story?.setting} onChange={(v) => setDraft({ ...draft, story: { ...draft.story, setting: v } })} />
        <Field label="도입 문장 (소개 화면)" multiline rows={2} value={draft.story?.intro} onChange={(v) => setDraft({ ...draft, story: { ...draft.story, intro: v } })} />
      </div>

      <div className="card col">
        <strong>방 3개와 단서</strong>
        {draft.rooms.map((r, i) => (
          <div key={r.id} className="row" style={{ gap: 10 }}>
            <Field label={`방 ${r.id} 이름`} value={r.name} onChange={(v) => setDraft({ ...draft, rooms: draft.rooms.map((x, j) => (j === i ? { ...x, name: v } : x)) })} />
            <Field label="융합 요소 표시 (교사 화면)" value={r.fusion} onChange={(v) => setDraft({ ...draft, rooms: draft.rooms.map((x, j) => (j === i ? { ...x, fusion: v } : x)) })} />
            <Field label={`단서 ${r.clue} 내용`} value={draft.clueNames?.[r.clue]} onChange={(v) => setDraft({ ...draft, clueNames: { ...(draft.clueNames ?? {}), [r.clue]: v } })} />
          </div>
        ))}
      </div>

      <div className="card col">
        <strong>역할 (관점과 자료 담당)</strong>
        {draft.roles.map((r, i) => {
          const setRole = (patch) => setDraft({ ...draft, roles: draft.roles.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
          return (
            <div key={r.id} className="mr-mat">
              <div className="row" style={{ gap: 10 }}>
                <Field label={`${r.id} 이름`} value={r.name} onChange={(v) => setRole({ name: v })} />
                <Field label="직업" value={r.job} onChange={(v) => setRole({ job: v })} />
                <label style={{ width: 160 }}>
                  <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>토론 입장</span>
                  <select value={r.stance ?? ''} onChange={(e) => setRole({ stance: e.target.value || undefined })} style={{ width: '100%' }}>
                    <option value="">(없음)</option>
                    {draft.debate?.stances?.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <Field label="관점" value={r.perspective} onChange={(v) => setRole({ perspective: v })} />
              <Field label="소개" multiline rows={2} value={r.profile} onChange={(v) => setRole({ profile: v })} />
            </div>
          )
        })}
        <JsonField label="인원별 역할 통합 (variants)" value={draft.variants} rows={6} onChange={(v) => setDraft({ ...draft, variants: v })} />
      </div>
    </div>
  )
}

function MaterialsTab({ draft, setDraft }) {
  const roleOpts = draft.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)
  return (
    <div className="col">
      <div className="card col">
        <strong>자료 (역할에게만 보이고, 공유해야 팀이 봄)</strong>
        {Object.entries(draft.materials).map(([id, m]) => {
          const setM = (patch) => setDraft({ ...draft, materials: { ...draft.materials, [id]: { ...m, ...patch } } })
          return (
            <div key={id} className="mr-mat">
              <div className="row" style={{ gap: 10 }}>
                <Field label={`${id} 제목`} value={m.title} onChange={(v) => setM({ title: v })} />
                <label style={{ width: 150 }}>
                  <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>담당 역할</span>
                  <select value={m.owner ?? ''} onChange={(e) => setM({ owner: e.target.value || null })} style={{ width: '100%' }}>
                    <option value="">(공용)</option>
                    {roleOpts}
                  </select>
                </label>
              </div>
              {m.kind === 'table' ? (
                <>
                  <MaterialTable m={m} />
                  <JsonField label="표 (columns, rows)" value={{ columns: m.columns, rows: m.rows }} rows={6} onChange={(v) => v && setM({ columns: v.columns, rows: v.rows })} />
                </>
              ) : (
                <Field label="내용" multiline value={m.text} onChange={(v) => setM({ text: v })} />
              )}
            </div>
          )
        })}
      </div>
      <div className="card col">
        <strong>개념 노트</strong>
        {draft.concepts.map((c, i) => (
          <div key={c.k} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <Field label={`${c.k} 이름`} value={c.name} width={200} onChange={(v) => setDraft({ ...draft, concepts: draft.concepts.map((x, j) => (j === i ? { ...x, name: v } : x)) })} />
            <Field label="설명" multiline rows={2} value={c.lines.join('\n')} onChange={(v) => setDraft({ ...draft, concepts: draft.concepts.map((x, j) => (j === i ? { ...x, lines: v.split('\n') } : x)) })} />
          </div>
        ))}
      </div>
    </div>
  )
}

function DebateTab({ draft, setDraft }) {
  const d = draft.debate
  const setD = (patch) => setDraft({ ...draft, debate: { ...d, ...patch } })
  return (
    <div className="col">
      <div className="card col">
        <strong>최종 토론</strong>
        <Field label="토론 질문" value={d.question} onChange={(v) => setD({ question: v })} />
        {d.stances.map((s, i) => (
          <div key={s.id} className="row" style={{ gap: 10 }}>
            <Field label={`입장 ${s.id}`} value={s.label} width={200} onChange={(v) => setD({ stances: d.stances.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
            <Field label="핵심 주장" value={s.claim} onChange={(v) => setD({ stances: d.stances.map((x, j) => (j === i ? { ...x, claim: v } : x)) })} />
          </div>
        ))}
        {(d.twistCards ?? []).map((t, i) => (
          <div key={t.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <label style={{ width: 160 }}>
              <span className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>반전 카드 {i + 1}이 흔드는 입장</span>
              <select value={t.target} onChange={(e) => setD({ twistCards: d.twistCards.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)) })} style={{ width: '100%' }}>
                {d.stances.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <Field label="내용" multiline rows={2} value={t.text} onChange={(v) => setD({ twistCards: d.twistCards.map((x, j) => (j === i ? { ...x, text: v } : x)) })} />
          </div>
        ))}
        <JsonField label="쟁점 카드 (fairness, transparency, accountability, privacy, safety, autonomy 중)" value={d.issueCards} rows={2} onChange={(v) => setD({ issueCards: v })} />
        <JsonField label="단계별 시간(초)" value={d.stageSeconds} rows={4} onChange={(v) => setD({ stageSeconds: v })} />
        <JsonField label="합의 조건 (글자 수)" value={d.conditions} rows={4} onChange={(v) => setD({ conditions: v })} />
        <JsonField label="가치 충돌 문장 (선택: cards, validPairs, minChars, template)" value={d.valueConflict} rows={8} onChange={(v) => setD({ valueConflict: v })} />
      </div>
      <div className="card col">
        <strong>성찰 질문 4개</strong>
        {draft.reflection.map((q, i) => (
          <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <Field label="구분" value={q.link} width={140} onChange={(v) => setDraft({ ...draft, reflection: draft.reflection.map((x, j) => (j === i ? { ...x, link: v } : x)) })} />
            <Field label={`질문 ${i + 1}`} multiline rows={2} value={q.text} onChange={(v) => setDraft({ ...draft, reflection: draft.reflection.map((x, j) => (j === i ? { ...x, text: v } : x)) })} />
          </div>
        ))}
      </div>
    </div>
  )
}

function EditorInner({ scenarioId }) {
  const [original, setOriginal] = useState(null)
  const [draft, setDraftRaw] = useState(null)
  const [tab, setTab] = useState('flow')
  const [cur, setCur] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [errors, setErrors] = useState([])

  useEffect(() => {
    const load = DEV_LOCAL ? fetch(`${import.meta.env.BASE_URL}scenarios/${scenarioId}.json`).then((r) => r.json()) : getScenario(scenarioId)
    load.then((s) => {
      const room = decodeNested(s)
      setOriginal(room)
      setDraftRaw(clone(room))
      setCur(room.start)
    })
  }, [scenarioId])

  const setDraft = (next) => {
    setDraftRaw(next)
    setMsg(null)
  }
  const { order, orphans } = useMemo(() => (draft ? sceneOrder(draft) : { order: [], orphans: [] }), [draft])
  if (!draft) return <div className="page dim">불러오는 중...</div>

  const dirty = JSON.stringify(draft) !== JSON.stringify(original)
  const setScene = (id, s) => setDraft({ ...draft, scenes: { ...draft.scenes, [id]: s } })

  // 장면 번호를 바꾸면 그 장면을 가리키던 모든 연결도 함께 바꾼다.
  const renameScene = (from, to) => {
    const fix = (x) => (x === from ? to : x)
    const scenes = {}
    for (const [id, s] of Object.entries(draft.scenes)) {
      const n = clone(s)
      if (n.next) n.next = fix(n.next)
      if (n.choices) n.choices = n.choices.map((c) => ({ ...c, to: fix(c.to) }))
      if (n.gate) n.gate = n.gate.map((g) => ({ ...g, to: fix(g.to) }))
      if (n.puzzle) n.puzzle.onSolve = fix(n.puzzle.onSolve)
      if (n.end?.retry) n.end.retry = fix(n.end.retry)
      scenes[id === from ? to : id] = n
    }
    setDraft({ ...draft, scenes, start: fix(draft.start), timeoutScene: draft.timeoutScene && fix(draft.timeoutScene) })
    setCur(to)
  }
  const deleteScene = (id) => {
    if (!confirm(`장면 ${id}을(를) 삭제할까요? 이 장면을 가리키는 선택지가 있으면 저장할 때 검사에서 알려 줍니다.`)) return
    const scenes = { ...draft.scenes }
    delete scenes[id]
    setDraft({ ...draft, scenes })
    setCur(draft.start)
  }
  const addScene = () => {
    let n = 1
    while (draft.scenes[`new${n}`]) n++
    const id = `new${n}`
    setDraft({ ...draft, scenes: { ...draft.scenes, [id]: { title: '새 장면', body: [''], next: draft.start } } })
    setCur(id)
    setTab('flow')
  }

  const save = async () => {
    const errs = validateRoom(draft)
    setErrors(errs)
    if (errs.length) return setMsg(`검사에서 ${errs.length}건이 걸려 저장하지 않았습니다. 아래 목록을 고쳐 주세요.`)
    if (DEV_LOCAL) return setMsg('저장했습니다. (개발용 로컬 모드라 실제로는 저장하지 않음)')
    setBusy(true)
    try {
      await saveScenario(draft)
      setOriginal(clone(draft))
      setMsg('저장했습니다.')
    } catch (e) {
      setMsg(`저장하지 못했습니다: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-wide">
      <Masthead showBack />
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{draft.meta.title} — 미스터리 룸 편집</h1>
        <div className="row">
          <button onClick={() => window.open(`${window.location.pathname}?test=1#/mystery/${draft.scenarioId}`, '_blank')} title="저장된 내용으로 테스트합니다">
            테스트 플레이 (저장된 내용)
          </button>
          <button className="primary" disabled={!dirty || busy} onClick={save}>{busy ? '저장 중...' : dirty ? '변경사항 저장' : '저장됨'}</button>
        </div>
      </div>
      {msg && <p style={{ fontSize: 12, color: msg.startsWith('저장했습니다') ? 'var(--gold-light)' : 'var(--blood-light)' }}>{msg}</p>}
      {errors.length > 0 && (
        <div className="mr-feedback" style={{ marginBottom: 12 }}>
          {errors.map((e, i) => <div key={i} style={{ fontSize: 12 }}>· {e}</div>)}
        </div>
      )}

      <div className="tabs">
        {[['flow', '장면 흐름'], ['info', '룸 정보·역할'], ['materials', '자료·개념'], ['debate', '토론·성찰'], ['json', '전체 JSON']].map(([k, l]) => (
          <button key={k} className={`tab-button ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'flow' && (
        <div className="mr-layout" style={{ gridTemplateColumns: '240px minmax(0, 1fr)' }}>
          <div className="card col" style={{ gap: 4, position: 'sticky', top: 10, maxHeight: '85vh', overflowY: 'auto' }}>
            <strong style={{ fontSize: 13 }}>장면 (플레이 순서)</strong>
            {[...order, ...orphans].map((id) => {
              const s = draft.scenes[id]
              const badge = sceneBadge(s)
              const orphan = orphans.includes(id)
              return (
                <div
                  key={id}
                  onClick={() => setCur(id)}
                  style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 6, fontSize: 12, background: cur === id ? 'rgba(201,162,39,0.15)' : undefined, border: `1px solid ${cur === id ? 'var(--gold)' : 'transparent'}` }}
                >
                  <span className="dim" style={{ fontFamily: 'var(--font-mono)' }}>{id}</span> {s.title}
                  {badge && <span className="mr-tag" style={{ marginLeft: 4, ...(badge.cls === 'blood' ? { color: 'var(--blood-light)' } : badge.cls === 'blue' ? { color: '#9db8e8' } : {}) }}>{badge.text}</span>}
                  {orphan && <span className="mr-tag" style={{ marginLeft: 4, color: 'var(--blood-light)' }}>연결 안 됨</span>}
                </div>
              )
            })}
            <button className="mr-small" style={{ marginTop: 6 }} onClick={addScene}>+ 장면 추가</button>
          </div>
          <div className="col" style={{ gap: 0 }}>
            {cur && draft.scenes[cur] && (
              <>
                <ScenePreview room={draft} id={cur} go={(to) => draft.scenes[to] && setCur(String(to))} />
                <SceneForm room={draft} id={cur} setScene={setScene} renameScene={renameScene} deleteScene={deleteScene} />
              </>
            )}
          </div>
        </div>
      )}
      {tab === 'info' && <InfoTab draft={draft} setDraft={setDraft} />}
      {tab === 'materials' && <MaterialsTab draft={draft} setDraft={setDraft} />}
      {tab === 'debate' && <DebateTab draft={draft} setDraft={setDraft} />}
      {tab === 'json' && (
        <div className="card">
          <JsonField label="룸 파일 전체" value={draft} rows={30} onChange={(v) => v && setDraft(v)} />
        </div>
      )}
    </div>
  )
}

export default function MysteryRoomEditor() {
  const { scenarioId } = useParams()
  const { isAdmin, ready } = useAuth()
  if (!ready) return <div className="page dim">불러오는 중...</div>
  if (!isAdmin && !DEV_LOCAL) return <div className="page card">관리자만 접근할 수 있습니다. <a href="#/admin">관리자 로그인으로 이동</a></div>
  return <EditorInner scenarioId={scenarioId} />
}
