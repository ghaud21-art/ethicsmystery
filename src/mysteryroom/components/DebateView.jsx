import { useEffect, useMemo, useState } from 'react'
import { Icon, MaterialTable, PlayerDots, fmtTime, useMr } from './common'
import { ISSUE_CARDS, STAGE_LABEL, useDebate } from '../useDebate'
import { roleById } from '../roles'

const len = (s) => String(s ?? '').trim().length

// 발언에 붙일 수 있는 근거: 얻은 단서, 볼 수 있는 자료, 공유된 렌즈, 배운 개념.
// 고를 때 무엇인지 알 수 있도록 설명(detail)과 원문을 함께 담는다.
function lensText(room, key) {
  const parts = key.split(':')
  const rid = parts.pop()
  if (parts[0] === 'ml') return room.materials[parts[1]]?.lens?.[rid]?.text
  return room.scenes[parts[1]]?.body?.[Number(parts[2])]?.lens?.[rid]?.text
}

function useEvidence() {
  const { room, mr } = useMr()
  return useMemo(() => {
    const list = []
    room.rooms.forEach((r) => {
      if (mr.state.clues?.[r.clue]) list.push({ key: `clue:${r.clue}`, group: '단서', label: `단서 ${r.clue} · ${r.name}`, detail: room.clueNames?.[r.clue] })
    })
    Object.entries(room.materials).forEach(([id, m]) => {
      if (mr.canSee(m.owner, `m:${id}`)) list.push({ key: `m:${id}`, group: '자료', label: m.title, detail: m.kind === 'table' ? null : m.text, material: id })
    })
    Object.keys(mr.shared).forEach((k) => {
      if (k.startsWith('l:') || k.startsWith('ml:')) {
        const rid = k.split(':').pop()
        list.push({ key: k, group: '관점 렌즈', label: `${roleById(room, rid)?.name}의 시선`, detail: lensText(room, k) })
      }
    })
    room.concepts.forEach((c) => mr.state.concepts?.[c.k] && list.push({ key: `k:${c.k}`, group: '개념', label: c.name, detail: c.lines.join(' ') }))
    return list
  }, [room, mr.state, mr.shared, mr.canSee])
}

function EvidencePicker({ evidence, chips, setChips }) {
  const { room } = useMr()
  const [open, setOpen] = useState({})
  const groups = ['단서', '자료', '관점 렌즈', '개념']
  return (
    <div className="col" style={{ gap: 6 }}>
      {groups.map((g) => {
        const items = evidence.filter((e) => e.group === g)
        if (!items.length) return null
        return (
          <div key={g} className="col" style={{ gap: 6 }}>
            <div className="mr-ev-group">{g}</div>
            {items.map((e) => {
              const on = chips.includes(e.key)
              const m = e.material ? room.materials[e.material] : null
              return (
                <div key={e.key} className={`mr-ev ${on ? 'on' : ''}`} onClick={() => setChips((c) => (c.includes(e.key) ? c.filter((x) => x !== e.key) : [...c, e.key]))}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
                    <span className="row" style={{ gap: 6, fontSize: 13 }}>
                      <span className="mr-radio" style={{ borderRadius: 4, ...(on ? { background: 'var(--gold)', borderColor: 'var(--gold)' } : {}) }} />
                      <strong>{e.label}</strong>
                    </span>
                    {m?.kind === 'table' && (
                      <button className="mr-small mr-ghost" onClick={(ev) => (ev.stopPropagation(), setOpen((o) => ({ ...o, [e.key]: !o[e.key] })))}>
                        {open[e.key] ? '접기' : '보기'}
                      </button>
                    )}
                  </div>
                  {e.detail && <div className="mr-ev-detail">{e.detail}</div>}
                  {m && open[e.key] && m.kind === 'table' && (
                    <div style={{ marginTop: 6 }} onClick={(ev) => ev.stopPropagation()}><MaterialTable m={m} /></div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function chipLabel(room, key) {
  const [kind, id] = key.split(':')
  if (kind === 'clue') return `단서 ${id}`
  if (kind === 'm') return room.materials[id]?.title ?? id
  if (kind === 'k') return room.concepts.find((c) => c.k === id)?.name ?? id
  return `${roleById(room, key.split(':').pop())?.name}의 시선`
}

function StanceOptions({ value, onPick, stances, disabled, exclude }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      {stances.filter((s) => s.id !== exclude).map((s) => (
        <div key={s.id} className={`mr-option ${value === s.id ? 'on' : ''}`} onClick={() => !disabled && onPick(s.id)}>
          <span className="mr-radio" />
          <span><strong>{s.label}</strong><br /><span className="dim" style={{ fontSize: 12 }}>{s.claim}</span></span>
        </div>
      ))}
    </div>
  )
}

function Distribution({ map, stances, uids }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {stances.map((s) => (
        <span key={s.id} className="pill pill-outline">{s.label} {uids.filter((u) => map?.[u] === s.id).length}명</span>
      ))}
    </div>
  )
}

function SavedField({ label, value, minChars, onSave, placeholder, rows = 2 }) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const dirty = text !== (value ?? '')
  return (
    <div className="col" style={{ gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 700 }}>
        {label} {minChars ? <span className="dim" style={{ fontWeight: 400 }}>({len(text)}/{minChars}자 이상)</span> : <span className="dim" style={{ fontWeight: 400 }}>(선택)</span>}
      </label>
      <textarea rows={rows} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="mr-small" disabled={!dirty} onClick={() => onSave(text.trim())}>모둠 합의문에 저장</button>
        {value && !dirty && <span className="dim" style={{ fontSize: 11 }}>저장됨</span>}
      </div>
    </div>
  )
}

export default function DebateView() {
  const { room, mr } = useMr()
  const code = mr.code
  const db = useDebate(room, mr, code)
  const { d, cfg, stage, stages, stageDone, stanceOf, stanceById, team, conclusion, teamOk, allAgreed, actions, pairValid } = db
  const evidence = useEvidence()
  const uids = mr.playerUids
  const me = mr.uid
  const myStance = stanceById(stanceOf(me))
  const sec = cfg.stageSeconds?.[stage]
  const left = sec && d.stageAt ? Math.max(0, sec - Math.floor((mr.now - d.stageAt) / 1000)) : null
  const nameOf = (u) => mr.players[u]?.name ?? '?'

  // 모두 합의문에 동의하면 토론을 마치고 관문으로 간다.
  useEffect(() => {
    if (stage === 'agree' && allAgreed) actions.finish()
  }, [stage, allAgreed, actions])

  // 발언 라운드 상태
  const [chips, setChips] = useState([])
  const [line, setLine] = useState('')
  const speaker = uids.find((u) => !d.speeches?.[u])

  // 질문 카드
  const [qTo, setQTo] = useState('')
  const [qText, setQText] = useState('')
  const others = uids.filter((u) => u !== me)
  const opposite = others.filter((u) => stanceOf(u) !== stanceOf(me))
  const qTargets = opposite.length ? opposite : others
  const incoming = uids.filter((u) => d.questions?.[u]?.to === me)
  const [answers, setAnswers] = useState({})

  // 입장 교환
  const [swapTo, setSwapTo] = useState('')
  const [swapLine, setSwapLine] = useState('')

  const stageIdx = stages.indexOf(stage)
  const lastStage = stageIdx === stages.length - 1

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="mr-note">
        <div className="mr-note-cap"><Icon name="door" size={12} />토론 질문</div>
        <p style={{ fontFamily: 'var(--font-head)', fontSize: 16 }}>{cfg.question}</p>
      </div>

      <div className="mr-rooms" style={{ marginBottom: 0 }}>
        {stages.map((s, i) => (
          <div key={s} className={`mr-room-step ${s === stage ? 'active' : ''} ${i < stageIdx ? 'done' : ''}`} style={{ padding: '6px 8px' }}>
            <span className="mr-clue-badge">{i < stageIdx ? <Icon name="check" size={11} /> : i + 1}</span>
            <span>{STAGE_LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 6 }}>
          {(cfg.issueCards ?? []).map((k) => ISSUE_CARDS[k] && (
            <span key={k} className="pill pill-blue" title={ISSUE_CARDS[k].question}>{ISSUE_CARDS[k].label}</span>
          ))}
        </div>
        {left !== null && <span className={`mr-timer ${left === 0 ? 'warn' : ''}`} style={{ fontSize: 15 }}><Icon name="clock" size={14} />{fmtTime(left)}</span>}
      </div>
      <div className="dim" style={{ fontSize: 12, lineHeight: 1.7 }}>
        {(cfg.issueCards ?? []).map((k) => ISSUE_CARDS[k] && <div key={k}>· {ISSUE_CARDS[k].label}: {ISSUE_CARDS[k].question}</div>)}
      </div>

      {myStance && (
        <div className="mr-mat" style={{ borderColor: 'var(--gold-dark)' }}>
          <div className="mr-mat-title"><span>내가 맡은 입장: {myStance.label}</span>{d.swaps?.[me] && <span className="mr-tag">교환함</span>}</div>
          <p>{myStance.claim}</p>
          <p className="dim" style={{ fontSize: 11, marginTop: 4 }}>배정된 입장이 내 생각과 달라도 괜찮아요. 그 입장의 가장 좋은 근거를 찾아 말해 보세요.</p>
        </div>
      )}

      {/* ---- 단계별 화면 ---- */}
      {stage === 'pre' && (
        <div className="col" style={{ gap: 10 }}>
          <strong style={{ fontSize: 14 }}>토론 전, 내 생각은? (모두 고르면 공개)</strong>
          <StanceOptions stances={cfg.stances} value={d.before?.[me]} onPick={actions.setBefore} />
          {stageDone.pre ? <Distribution map={d.before} stances={cfg.stances} uids={uids} /> : !mr.solo && <PlayerDots map={d.before} label="고른 사람" />}
        </div>
      )}

      {stage === 'speak' && (
        <div className="col" style={{ gap: 10 }}>
          <strong style={{ fontSize: 14 }}>한 사람씩 30초. 근거를 하나 이상 붙여야 발언이 끝납니다.</strong>
          {uids.map((u, i) => {
            const sp = d.speeches?.[u]
            return (
              <div key={u} className="mr-mat" style={{ borderColor: u === speaker ? 'var(--gold)' : undefined }}>
                <div className="mr-mat-title">
                  <span>{i + 1}. {nameOf(u)} · {stanceById(stanceOf(u))?.label}</span>
                  {sp ? <span className="mr-tag">발언 완료</span> : u === speaker ? <span className="mr-tag blue">발언 차례</span> : null}
                </div>
                {sp && (
                  <>
                    <div className="row" style={{ gap: 4 }}>{sp.chips.map((c) => <span key={c} className="mr-tag blue">{chipLabel(room, c)}</span>)}</div>
                    {sp.line && <p style={{ marginTop: 6 }}>{sp.line}</p>}
                  </>
                )}
              </div>
            )
          })}
          {speaker === me && (
            <div className="col" style={{ gap: 8 }}>
              <strong style={{ fontSize: 13 }}>내 발언에 붙일 근거 (눌러서 고르기, 여러 개 가능)</strong>
              <EvidencePicker evidence={evidence} chips={chips} setChips={setChips} />
              <textarea rows={2} value={line} onChange={(e) => setLine(e.target.value)} placeholder="말한 내용을 한 줄로 남기기 (선택)" />
              <button className="primary" style={{ alignSelf: 'flex-start' }} disabled={!chips.length} onClick={() => actions.speak(chips, line.trim())}>발언 완료</button>
            </div>
          )}
          {speaker && speaker !== me && <span className="dim" style={{ fontSize: 12 }}>{nameOf(speaker)}의 발언을 들어 주세요.</span>}
        </div>
      )}

      {stage === 'question' && (
        <div className="col" style={{ gap: 10 }}>
          <strong style={{ fontSize: 14 }}>다른 입장인 사람 한 명에게 질문을 보내고, 받은 질문에 답하세요.</strong>
          {!d.questions?.[me] ? (
            <div className="col" style={{ gap: 6 }}>
              <div className="row">
                {qTargets.map((u) => (
                  <button key={u} className={`mr-small ${qTo === u ? 'mr-selected' : ''}`} onClick={() => setQTo(u)}>{nameOf(u)} · {stanceById(stanceOf(u))?.label}</button>
                ))}
              </div>
              <textarea rows={2} value={qText} onChange={(e) => setQText(e.target.value)} placeholder="예: 즉시 중단하면 상담을 기다리는 학생들은 어떻게 하나요?" />
              <button style={{ alignSelf: 'flex-start' }} disabled={!qTo || len(qText) < 5} onClick={() => actions.ask(qTo, qText.trim())}>질문 보내기</button>
            </div>
          ) : (
            <span className="dim" style={{ fontSize: 12 }}>질문을 보냈습니다.</span>
          )}
          {incoming.map((u) => {
            const q = d.questions[u]
            return (
              <div key={u} className="mr-mat" style={{ borderColor: 'var(--gold)' }}>
                <div className="mr-mat-title"><span>{nameOf(u)}의 질문</span></div>
                <p>{q.text}</p>
                {q.answer ? (
                  <p style={{ marginTop: 6 }}><strong>내 답:</strong> {q.answer}</p>
                ) : (
                  <>
                    <textarea rows={2} style={{ marginTop: 6, width: '100%' }} value={answers[u] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [u]: e.target.value }))} placeholder="답하기" />
                    <button className="mr-small" style={{ marginTop: 6 }} disabled={len(answers[u]) < 2} onClick={() => actions.answer(u, answers[u].trim())}>답 보내기</button>
                  </>
                )}
              </div>
            )
          })}
          {uids.filter((u) => d.questions?.[u] && d.questions[u].to !== me).map((u) => (
            <div key={u} className="mr-mat">
              <div className="mr-mat-title"><span>{nameOf(u)} → {nameOf(d.questions[u].to)}</span></div>
              <p>{d.questions[u].text}</p>
              {d.questions[u].answer && <p className="dim" style={{ marginTop: 4 }}>답: {d.questions[u].answer}</p>}
            </div>
          ))}
        </div>
      )}

      {['twist', 'agree'].includes(stage) && (cfg.twistCards ?? []).length > 0 && (
        <div className="col" style={{ gap: 8 }}>
          {cfg.twistCards.map((t) => (
            <div key={t.id} className="mr-split" style={{ marginBottom: 0 }}>
              <strong>반전 카드</strong> <span className="dim">({stanceById(t.target)?.label} 쪽을 흔든다)</span>
              <br />{t.text}
            </div>
          ))}
        </div>
      )}

      {stage === 'twist' && (
        <div className="col" style={{ gap: 8 }}>
          <strong style={{ fontSize: 14 }}>반전 카드를 듣고 입장을 바꾸고 싶다면, 한 번 바꿀 수 있어요.</strong>
          {d.swaps?.[me] ? (
            <span className="dim" style={{ fontSize: 12 }}>‘{stanceById(d.swaps[me].to)?.label}’로 바꿨습니다: {d.swaps[me].line}</span>
          ) : (
            <>
              <StanceOptions stances={cfg.stances} value={swapTo} onPick={setSwapTo} exclude={stanceOf(me)} />
              <textarea rows={2} value={swapLine} onChange={(e) => setSwapLine(e.target.value)} placeholder="바꾼 입장으로 한 문장 말하기 (10자 이상)" />
              <button style={{ alignSelf: 'flex-start' }} disabled={!swapTo || len(swapLine) < 10} onClick={() => actions.swap(swapTo, swapLine.trim())}>입장 바꾸기</button>
            </>
          )}
          {uids.filter((u) => d.swaps?.[u] && u !== me).map((u) => (
            <span key={u} className="dim" style={{ fontSize: 12 }}>{nameOf(u)}: ‘{stanceById(d.swaps[u].to)?.label}’로 교환 · {d.swaps[u].line}</span>
          ))}
        </div>
      )}

      {stage === 'agree' && (
        <div className="col" style={{ gap: 12 }}>
          <strong style={{ fontSize: 14 }}>모둠 결론 투표</strong>
          <StanceOptions stances={cfg.stances} value={d.votes?.[me]} onPick={actions.vote} />
          {conclusion ? <div className="mr-status">모둠 결론: <strong style={{ color: 'var(--gold-light)' }}>{stanceById(conclusion)?.label}</strong></div> : !mr.solo && <PlayerDots map={d.votes} label="투표" />}

          {cfg.valueConflict && (
            <div className="mr-mat col" style={{ gap: 8 }}>
              <strong style={{ fontSize: 13 }}>이 쟁점에서 충돌하는 두 가치 (두 장 고르기)</strong>
              <div className="row" style={{ gap: 6 }}>
                {cfg.valueConflict.cards.map((v) => {
                  const on = (team.values ?? []).includes(v)
                  return (
                    <button
                      key={v}
                      className={`mr-small ${on ? 'mr-selected' : 'mr-ghost'}`}
                      onClick={() => {
                        const cur = team.values ?? []
                        const next = on ? cur.filter((x) => x !== v) : [...cur, v].slice(-2)
                        actions.editTeam({ values: next })
                      }}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
              {(team.values ?? []).length === 2 && !pairValid && (
                <span style={{ fontSize: 12, color: 'var(--blood-light)' }}>이 두 가치는 이 쟁점에서 서로 부딪친다고 보기 어려워요. 무엇과 무엇이 맞서는지 다시 생각해 보세요.</span>
              )}
              <SavedField
                label="가치 충돌 문장"
                value={team.valueSentence}
                minChars={cfg.valueConflict.minChars ?? 30}
                placeholder={cfg.valueConflict.template ?? '‘___’와(과) ‘___’이(가) 충돌한다. 왜냐하면 ___ 때문이다.'}
                onSave={(v) => actions.editTeam({ valueSentence: v })}
                rows={3}
              />
            </div>
          )}

          <SavedField label="조건 1" value={team.conditions?.[0]} minChars={5} placeholder="예: 대리변수 점검을 마친 뒤 사용한다" onSave={(v) => actions.editTeam({ conditions: [v, team.conditions?.[1] ?? ''] })} />
          <SavedField label="조건 2" value={team.conditions?.[1]} minChars={5} placeholder="예: 성별별 추천 결과를 매 학기 공개한다" onSave={(v) => actions.editTeam({ conditions: [team.conditions?.[0] ?? '', v] })} />
          <SavedField label="반대 입장의 가장 강한 근거 인정" value={team.acknowledge} minChars={cfg.conditions?.acknowledgeMinChars ?? 20} placeholder="‘~라는 점은 인정한다. 왜냐하면 ~’" onSave={(v) => actions.editTeam({ acknowledge: v })} rows={3} />
          <SavedField label="조건부 양보" value={team.concession} minChars={cfg.conditions?.concessionMinChars ?? 15} placeholder="‘~라면 우리는 ~까지 받아들일 수 있다’" onSave={(v) => actions.editTeam({ concession: v })} />
          <SavedField label="소수 의견" value={team.minority} placeholder="결론과 다른 생각이 있다면 남겨 두세요" onSave={(v) => actions.editTeam({ minority: v })} />

          <strong style={{ fontSize: 13 }}>토론 후, 내 생각은?</strong>
          <StanceOptions stances={cfg.stances} value={d.after?.[me]} onPick={actions.setAfter} />

          <div className="mr-submit">
            {!mr.solo && <PlayerDots map={Object.fromEntries(uids.map((u) => [u, d.agree?.[u] === (team.rev ?? 0)]))} label="합의문 동의" />}
            <button className="primary" style={{ alignSelf: 'flex-start' }} disabled={!teamOk || d.agree?.[me] === (team.rev ?? 0)} onClick={actions.agree}>
              {mr.solo ? '마지막 문에 제출' : '이 합의문에 동의'}
            </button>
            <span className="dim" style={{ fontSize: 11 }}>결론 투표{cfg.valueConflict ? ', 가치 충돌 문장' : ''}, 조건 2개, 인정 문장, 양보 문장, 모두의 ‘토론 후 생각’이 채워져야 제출할 수 있어요. 합의문이 바뀌면 동의가 풀립니다.</span>
          </div>
        </div>
      )}

      {!lastStage && (
        <div className="row" style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
          {stageDone[stage] ? (
            <button className="primary" onClick={actions.next}>다음 단계: {STAGE_LABEL[stages[stageIdx + 1]]} →</button>
          ) : mr.isHost ? (
            <button className="mr-ghost" onClick={actions.next}>시간이 없으면 건너뛰기 (방장)</button>
          ) : (
            <span className="dim" style={{ fontSize: 12 }}>모두 마치면 다음 단계로 넘어갈 수 있어요.</span>
          )}
        </div>
      )}
    </div>
  )
}
