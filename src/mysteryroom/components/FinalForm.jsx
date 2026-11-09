import { useEffect, useState } from 'react'
import { PlayerDots, useMr } from './common'
import { getStore } from '../store'

// 최종 문 양식(토론 없는 룸): 모둠이 함께 칸을 채우고 모두 동의하면 문이 열린다.
// 방 데이터: forms/{scene} = { rev, values: { 칸id: 글 } }, formAgree/{scene}/{uid} = rev
const len = (s) => String(s ?? '').trim().length

function FormField({ field, value, onSave }) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const dirty = text !== (value ?? '')
  const min = field.minChars ?? 10
  return (
    <div className="col" style={{ gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 700 }}>
        {field.label} <span className="dim" style={{ fontWeight: 400 }}>({len(text)}/{min}자 이상)</span>
      </label>
      {field.help && <span className="dim" style={{ fontSize: 11 }}>{field.help}</span>}
      <textarea rows={field.rows ?? 2} value={text} placeholder={field.placeholder} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="mr-small" disabled={!dirty} onClick={() => onSave(text.trim())}>선정서에 저장</button>
        {value && !dirty && <span className="dim" style={{ fontSize: 11 }}>저장됨</span>}
      </div>
    </div>
  )
}

export default function FinalForm({ scene }) {
  const { mr } = useMr()
  const store = getStore()
  const sid = mr.state.scene
  const form = scene.form
  const doc = mr.data?.forms?.[sid] ?? {}
  const values = doc.values ?? {}
  const rev = doc.rev ?? 0
  const agree = mr.data?.formAgree?.[sid] ?? {}
  const filled = form.fields.every((f) => len(values[f.id]) >= (f.minChars ?? 10))
  const agreedNow = Object.fromEntries(mr.playerUids.map((u) => [u, filled && agree[u] === rev]))
  const allAgreed = filled && mr.playerUids.every((u) => agreedNow[u])

  useEffect(() => {
    if (!allAgreed) return
    store.transaction(`${mr.code}/state`, (cur) => {
      if (!cur || cur.scene !== sid) return undefined
      const to = scene.next
      return { ...cur, debateDone: true, formResult: { title: form.title, fields: form.fields.map((f) => ({ label: f.label, value: values[f.id] ?? '' })) }, scene: to, sceneAt: Date.now(), history: [...(cur.history ?? []), to], voteRound: 1 }
    })
  }, [allAgreed, store, mr.code, sid, scene.next, form, values])

  const save = (id, v) =>
    store.transaction(`${mr.code}/forms/${sid}`, (cur) => ({ ...(cur ?? {}), values: { ...(cur?.values ?? {}), [id]: v }, rev: (cur?.rev ?? 0) + 1 }))

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="mr-note">
        <div className="mr-note-cap">{form.title}</div>
        {form.note && <p>{form.note}</p>}
      </div>
      {form.fields.map((f) => <FormField key={f.id} field={f} value={values[f.id]} onSave={(v) => save(f.id, v)} />)}
      <div className="mr-submit">
        {!mr.solo && <PlayerDots map={agreedNow} label="선정서 동의" />}
        <button className="primary" style={{ alignSelf: 'flex-start' }} disabled={!filled || agreedNow[mr.uid]} onClick={() => store.set(`${mr.code}/formAgree/${sid}/${mr.uid}`, rev)}>
          {mr.solo ? '마지막 문에 제출' : '이 선정서에 동의'}
        </button>
        <span className="dim" style={{ fontSize: 11 }}>모든 칸을 채우고 모두 동의하면 제출됩니다. 누가 칸을 고치면 동의가 풀립니다.</span>
      </div>
    </div>
  )
}
