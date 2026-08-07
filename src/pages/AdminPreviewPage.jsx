import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getScenario, saveScenario } from '../firebase/scenariosApi.js'
import { evaluateEndings } from '../engine/endingEvaluator.js'
import { computeSoloMetrics, evaluateSoloEnding } from '../engine/soloEndingEvaluator.js'
import { resolveAccusationOptions } from '../engine/resolutionOptions.js'
import { resizeImageToDataUrl } from '../utils/fileHelpers.js'

function Field({ label, value, onChange, editMode, multiline, small, grow }) {
  const wrapStyle = { marginBottom: 10, display: 'block', flex: grow ? 1 : undefined, minWidth: grow ? 160 : undefined }
  const controlStyle = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }

  if (!editMode) {
    if (!value) return null
    return (
      <div style={wrapStyle}>
        {label && <div className="dim" style={{ fontSize: 11 }}>{label}</div>}
        <div style={{ fontSize: multiline ? 13 : 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{value}</div>
      </div>
    )
  }
  return (
    <div style={wrapStyle}>
      {label && <label className="dim" style={{ fontSize: 11, display: 'block' }}>{label}</label>}
      {multiline ? (
        <textarea
          rows={small ? 2 : 4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...controlStyle, fontSize: 13, lineHeight: 1.5 }}
        />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={controlStyle} />
      )}
    </div>
  )
}

function ScenarioInfoSection({ draft, editMode, onChange }) {
  const [thumbBusy, setThumbBusy] = useState(false)
  const [thumbError, setThumbError] = useState(null)

  const updateMeta = (patch) => onChange({ ...draft, meta: { ...draft.meta, ...patch } })

  const handleThumbnail = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbBusy(true)
    setThumbError(null)
    try {
      const dataUrl = await resizeImageToDataUrl(file, { maxWidth: 700, quality: 0.8 })
      onChange({ ...draft, thumbnailDataUrl: dataUrl })
    } catch (err) {
      setThumbError(err.message)
    } finally {
      setThumbBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="card col">
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        {draft.thumbnailDataUrl && (
          <img src={draft.thumbnailDataUrl} alt="썸네일" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
        )}
        {editMode && (
          <div className="col" style={{ gap: 4 }}>
            <label className="dim" style={{ fontSize: 12 }}>썸네일 이미지</label>
            <input type="file" accept="image/*" onChange={handleThumbnail} disabled={thumbBusy} />
            {thumbBusy && <span className="dim" style={{ fontSize: 11 }}>업로드 중...</span>}
            {thumbError && <span style={{ color: 'var(--blood-light)', fontSize: 11 }}>{thumbError}</span>}
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="제목" value={draft.meta?.title} editMode={editMode} onChange={(v) => updateMeta({ title: v })} />
        <Field grow label="부제목" value={draft.meta?.subtitle} editMode={editMode} onChange={(v) => updateMeta({ subtitle: v })} />
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="단원명" value={draft.unit} editMode={editMode} onChange={(v) => onChange({ ...draft, unit: v })} />
        <Field grow label="난이도" value={draft.difficulty} editMode={editMode} onChange={(v) => onChange({ ...draft, difficulty: v })} />
        <Field
          grow
          label="예상 소요시간(분)"
          value={draft.meta?.estimatedMinutes}
          editMode={editMode}
          onChange={(v) => updateMeta({ estimatedMinutes: Number(v) || 0 })}
        />
      </div>
      <Field label="학습 목표" value={draft.meta?.learningObjective} editMode={editMode} multiline onChange={(v) => updateMeta({ learningObjective: v })} />
      <Field
        label="테마 태그 (쉼표로 구분)"
        value={draft.meta?.themes?.join(', ')}
        editMode={editMode}
        onChange={(v) => updateMeta({ themes: v.split(',').map((t) => t.trim()).filter(Boolean) })}
      />
      <Field
        label="사건 개요"
        value={draft.prologue?.sharedText}
        editMode={editMode}
        multiline
        onChange={(v) => onChange({ ...draft, prologue: { ...draft.prologue, sharedText: v } })}
      />
    </div>
  )
}

function CharacterEditCard({ character, editMode, onChange }) {
  const updateLayer = (i, content) => {
    const layers = character.secretLayers.map((l, idx) => (idx === i ? { ...l, content } : l))
    onChange({ ...character, secretLayers: layers })
  }
  return (
    <div className="card col">
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="이름" value={character.name} editMode={editMode} onChange={(v) => onChange({ ...character, name: v })} />
        <Field grow label="역할" value={character.role} editMode={editMode} onChange={(v) => onChange({ ...character, role: v })} />
        {character.isCulprit && <span className="pill pill-solid" style={{ marginTop: 18 }}>진범</span>}
      </div>
      <Field label="공개 정보" value={character.publicInfo} editMode={editMode} multiline onChange={(v) => onChange({ ...character, publicInfo: v })} />
      <Field label="상세 정보" value={character.detailInfo} editMode={editMode} multiline onChange={(v) => onChange({ ...character, detailInfo: v })} />
      {character.secretLayers?.map((layer, i) => (
        <Field
          key={i}
          label={`비밀 ${layer.layer ?? i + 1} (${layer.type ?? ''})`}
          value={layer.content}
          editMode={editMode}
          multiline
          onChange={(v) => updateLayer(i, v)}
        />
      ))}
      {character.epilogueCard && (
        <>
          <Field
            label="에필로그 — 비밀이 드러나지 않았을 때"
            value={character.epilogueCard.hidden}
            editMode={editMode}
            multiline
            small
            onChange={(v) => onChange({ ...character, epilogueCard: { ...character.epilogueCard, hidden: v } })}
          />
          <Field
            label="에필로그 — 비밀이 드러났을 때"
            value={character.epilogueCard.revealed}
            editMode={editMode}
            multiline
            small
            onChange={(v) => onChange({ ...character, epilogueCard: { ...character.epilogueCard, revealed: v } })}
          />
        </>
      )}
    </div>
  )
}

function ClueEditCard({ clue, editMode, found, onToggleFound, onChange }) {
  return (
    <div className="card col" style={{ marginBottom: 0, borderColor: found ? 'var(--gold)' : 'var(--line)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="dim" style={{ fontSize: 11 }}>
          {clue.owner ? `owner: ${clue.owner}` : clue.unlockType === 'combo' ? '조합 단서' : '공용'} · AP {clue.apCost}
        </span>
        <button onClick={onToggleFound} className={found ? 'primary' : ''} style={{ fontSize: 11, padding: '3px 8px' }}>
          {found ? '확보됨 (미리보기)' : '미확보 — 클릭해 확보 표시'}
        </button>
      </div>
      <Field label="제목" value={clue.title} editMode={editMode} onChange={(v) => onChange({ ...clue, title: v })} />
      {'location' in clue && (
        <Field label="장소" value={clue.location} editMode={editMode} onChange={(v) => onChange({ ...clue, location: v })} />
      )}
      <Field label="내용" value={clue.content} editMode={editMode} multiline onChange={(v) => onChange({ ...clue, content: v })} />
      <Field label="함의" value={clue.implication} editMode={editMode} multiline small onChange={(v) => onChange({ ...clue, implication: v })} />
      {(clue.unlockType === 'combo' || clue.unlockType === 'conditional' || clue.unlockNote) && (
        <Field label="해금 안내" value={clue.unlockNote} editMode={editMode} multiline small onChange={(v) => onChange({ ...clue, unlockNote: v })} />
      )}
    </div>
  )
}

function EndingEditCard({ ending, editMode, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await resizeImageToDataUrl(file, { maxWidth: 900, quality: 0.8 })
      onChange({ ...ending, imageDataUrl: dataUrl })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="card col">
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        {ending.imageDataUrl && (
          <img src={ending.imageDataUrl} alt={ending.title} style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
        )}
        {editMode && (
          <div className="col" style={{ gap: 4 }}>
            <label className="dim" style={{ fontSize: 12 }}>엔딩 이미지</label>
            <input type="file" accept="image/*" onChange={handleImage} disabled={busy} />
            {busy && <span className="dim" style={{ fontSize: 11 }}>업로드 중...</span>}
            {error && <span style={{ color: 'var(--blood-light)', fontSize: 11 }}>{error}</span>}
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="제목" value={ending.title} editMode={editMode} onChange={(v) => onChange({ ...ending, title: v })} />
        <Field grow label="테마 태그" value={ending.themeTag} editMode={editMode} onChange={(v) => onChange({ ...ending, themeTag: v })} />
      </div>
      <Field label="엔딩 서술" value={ending.message} editMode={editMode} multiline onChange={(v) => onChange({ ...ending, message: v })} />
      <Field label="성찰 포인트 (insight)" value={ending.insight} editMode={editMode} multiline small onChange={(v) => onChange({ ...ending, insight: v })} />
    </div>
  )
}

function EditorInner({ scenarioId }) {
  const navigate = useNavigate()
  const [original, setOriginal] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editMode, setEditMode] = useState(true)
  const [foundClueIds, setFoundClueIds] = useState(new Set())
  const [accused, setAccused] = useState('unknown')
  const [moralChoice, setMoralChoice] = useState('reveal_all')
  const [previewEnding, setPreviewEnding] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getScenario(scenarioId).then((s) => {
      setOriginal(s)
      setDraft(s)
      const firstOption = s.resolutionPhase?.steps.find((step) => step.id === 'accusation')?.options?.[0]
      if (firstOption) setAccused(firstOption)
    })
  }, [scenarioId])

  if (!draft) return <div className="dim">불러오는 중...</div>

  const isDirty = JSON.stringify(draft) !== JSON.stringify(original)

  const updateCharacter = (index, next) => {
    const characters = draft.characters.map((c, i) => (i === index ? next : c))
    setDraft({ ...draft, characters })
    setSaved(false)
  }

  const updateClue = (phase, index, next) => {
    const items = draft.clues[phase].items.map((c, i) => (i === index ? next : c))
    setDraft({ ...draft, clues: { ...draft.clues, [phase]: { ...draft.clues[phase], items } } })
    setSaved(false)
  }

  const updatePhaseNote = (phase, note) => {
    setDraft({ ...draft, clues: { ...draft.clues, [phase]: { ...draft.clues[phase], clueDesignNote: note } } })
    setSaved(false)
  }

  const updateEnding = (index, next) => {
    const endings = draft.endings.map((e, i) => (i === index ? next : e))
    setDraft({ ...draft, endings })
    setSaved(false)
  }

  const updateReflectionPrompt = (index, value) => {
    const reflectionPrompts = draft.reflectionPrompts.map((p, i) => (i === index ? value : p))
    setDraft({ ...draft, reflectionPrompts })
    setSaved(false)
  }

  const toggleFound = (clueId) => {
    setFoundClueIds((prev) => {
      const next = new Set(prev)
      if (next.has(clueId)) next.delete(clueId)
      else next.add(clueId)
      return next
    })
    setPreviewEnding(null)
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveScenario(draft)
      setOriginal(draft)
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const isSolo = !!draft.playerCharacter

  const handleEvaluateEnding = () => {
    let endingId
    if (isSolo) {
      const fakeRun = { viewedClueIds: [...foundClueIds], accusation: accused, moralChoice }
      endingId = evaluateSoloEnding(draft, computeSoloMetrics(draft, fakeRun))
    } else {
      const criticalIds = new Set(
        [...(draft.clues?.phase1?.items ?? []), ...(draft.clues?.phase2?.items ?? [])].filter((c) => c.isCriticalClue).map((c) => c.id),
      )
      const criticalCluesFoundCount = [...foundClueIds].filter((id) => criticalIds.has(id)).length
      endingId = evaluateEndings(draft, { accused, moralChoiceMajority: moralChoice, foundClueIds, criticalCluesFoundCount })
    }
    setPreviewEnding(draft.endings.find((e) => e.id === endingId))
  }

  const accusationOptions = resolveAccusationOptions(draft, undefined)

  return (
    <div className="page-wide">
      <Masthead showBack />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{draft.meta?.title ?? draft.scenarioId} — 플레이형 편집</h1>
        <div className="row" style={{ gap: 10 }}>
          <label className="row" style={{ fontSize: 13, gap: 4 }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
            편집 모드
          </label>
          <button className="primary" onClick={handleSave} disabled={!isDirty || busy}>
            {busy ? '저장 중...' : saved ? '저장됨' : '변경사항 저장'}
          </button>
        </div>
      </div>
      <p className="dim" style={{ marginBottom: 16, fontSize: 12 }}>
        인원이 모이지 않아도 관리자 혼자 전체 콘텐츠를 확인/수정할 수 있는 화면입니다. "확보됨" 표시는 저장되지 않고 이 화면에서의
        미리보기·엔딩 테스트용으로만 쓰입니다.
      </p>
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}

      <h2 className="page-title" style={{ fontSize: 18 }}>시나리오 정보</h2>
      <div style={{ marginBottom: 20 }}>
        <ScenarioInfoSection draft={draft} editMode={editMode} onChange={(next) => { setDraft(next); setSaved(false) }} />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>캐릭터</h2>
      <div className="col" style={{ marginBottom: 20 }}>
        {draft.characters.map((c, i) => (
          <CharacterEditCard key={c.id} character={c} editMode={editMode} onChange={(next) => updateCharacter(i, next)} />
        ))}
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>단서 — {draft.clues.phase1.label}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 20 }}>
        {draft.clues.phase1.items.map((clue, i) => (
          <ClueEditCard
            key={clue.id}
            clue={clue}
            editMode={editMode}
            found={foundClueIds.has(clue.id)}
            onToggleFound={() => toggleFound(clue.id)}
            onChange={(next) => updateClue('phase1', i, next)}
          />
        ))}
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>단서 — {draft.clues.phase2.label}</h2>
      {isSolo && (
        <Field
          label="진행 순서 힌트 (1인용 심층 대질 화면에 학생에게 노출됨)"
          value={draft.clues.phase2.clueDesignNote}
          editMode={editMode}
          multiline
          small
          onChange={(v) => updatePhaseNote('phase2', v)}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 20 }}>
        {draft.clues.phase2.items.map((clue, i) => (
          <ClueEditCard
            key={clue.id}
            clue={clue}
            editMode={editMode}
            found={foundClueIds.has(clue.id)}
            onToggleFound={() => toggleFound(clue.id)}
            onChange={(next) => updateClue('phase2', i, next)}
          />
        ))}
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>엔딩</h2>
      <div className="col" style={{ marginBottom: 20 }}>
        {draft.endings.map((ending, i) => (
          <EndingEditCard key={ending.id} ending={ending} editMode={editMode} onChange={(next) => updateEnding(i, next)} />
        ))}
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>성찰 질문</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        {draft.reflectionPrompts.map((prompt, i) => (
          <Field
            key={i}
            label={`질문 ${i + 1}`}
            value={prompt}
            editMode={editMode}
            multiline
            small
            onChange={(v) => updateReflectionPrompt(i, v)}
          />
        ))}
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>엔딩 분기 테스트</h2>
      <div className="card col" style={{ marginBottom: 24 }}>
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>
          위에서 "확보됨"으로 표시한 단서 {foundClueIds.size}개를 기준으로, 지목/도덕적 선택 조합에 따라 어떤 엔딩이 나오는지 바로
          확인할 수 있습니다.
        </p>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
          <div className="col" style={{ gap: 4 }}>
            <label className="dim" style={{ fontSize: 12 }}>지목</label>
            <select value={accused} onChange={(e) => setAccused(e.target.value)}>
              {accusationOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <label className="dim" style={{ fontSize: 12 }}>도덕적 선택</label>
            <select value={moralChoice} onChange={(e) => setMoralChoice(e.target.value)}>
              <option value="reveal_all">모두 공개했다</option>
              <option value="conceal_some">일부는 덮었다</option>
            </select>
          </div>
          <button className="primary" onClick={handleEvaluateEnding} style={{ alignSelf: 'flex-end' }}>
            이 조합의 엔딩 확인
          </button>
        </div>
        {previewEnding && (
          <div className="card" style={{ borderColor: 'var(--gold)', marginBottom: 0 }}>
            {previewEnding.imageDataUrl && (
              <img src={previewEnding.imageDataUrl} alt={previewEnding.title} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: 8 }} />
            )}
            <strong style={{ fontFamily: 'var(--font-head)' }}>{previewEnding.title}</strong>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: '6px 0 0' }}>{previewEnding.message}</p>
            <p className="dim" style={{ fontSize: 12, margin: '6px 0 0' }}>{previewEnding.themeTag}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPreviewPage() {
  const { scenarioId } = useParams()
  const { isAdmin, ready } = useAuth()

  if (!ready) return <div className="page dim">불러오는 중...</div>
  if (!isAdmin) return <div className="page card">관리자만 접근할 수 있습니다. <a href="#/admin">관리자 로그인으로 이동</a></div>

  return <EditorInner scenarioId={scenarioId} />
}
