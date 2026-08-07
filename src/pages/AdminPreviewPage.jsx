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

function Checkbox({ label, checked, onChange, editMode }) {
  if (!editMode) {
    if (!checked) return null
    return <span className="pill pill-solid" style={{ marginBottom: 10 }}>{label}</span>
  }
  return (
    <label className="row" style={{ fontSize: 12, gap: 6, marginBottom: 10 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

// 지목 옵션·엔딩 조건·결론 단계 구조처럼 리스트/중첩 객체로 이루어진 값은 전용 폼 대신
// JSON 텍스트로 직접 편집한다 — 필드마다 전용 UI를 만드는 대신, 구조가 시나리오마다
// 크게 달라질 수 있는 부분(조건식, 분류 항목 등)을 하나로 커버하기 위한 실용적 선택.
function JsonField({ label, value, onChange, editMode, rows = 6 }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [error, setError] = useState(null)

  if (!editMode) {
    if (value === undefined || value === null) return null
    return (
      <div style={{ marginBottom: 10 }}>
        {label && <div className="dim" style={{ fontSize: 11 }}>{label}</div>}
        <pre style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: '4px 0 0', fontFamily: 'monospace' }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    )
  }

  const handleBlur = () => {
    try {
      const parsed = text.trim() === '' ? undefined : JSON.parse(text)
      setError(null)
      onChange(parsed)
    } catch {
      setError('JSON 형식이 올바르지 않습니다 — 고쳐야 저장됩니다')
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label className="dim" style={{ fontSize: 11, display: 'block' }}>{label}</label>}
      <textarea
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        style={{
          display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4,
          fontSize: 12, lineHeight: 1.5, fontFamily: 'monospace',
        }}
      />
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 11, margin: '4px 0 0' }}>{error}</p>}
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
        {!!draft.playerCharacter && (
          <Field
            grow
            label="조사 제한시간(분) — 비워두면 타이머 없음"
            value={draft.meta?.soloTimeLimitMinutes}
            editMode={editMode}
            onChange={(v) => {
              // Firestore setDoc은 undefined 필드값을 허용하지 않으므로, 비웠을 때는
              // 값을 undefined로 설정하는 대신 키 자체를 meta에서 제거한다.
              const meta = { ...draft.meta }
              if (v === '') delete meta.soloTimeLimitMinutes
              else meta.soloTimeLimitMinutes = Number(v) || 0
              onChange({ ...draft, meta })
            }}
          />
        )}
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
  const updateAdlibLine = (i, patch) => {
    const lines = character.adlibLines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    onChange({ ...character, adlibLines: lines })
  }
  const updateThreePlayerVariant = (patch) =>
    onChange({ ...character, threePlayerVariant: { ...(character.threePlayerVariant ?? { included: true, notes: '' }), ...patch } })

  return (
    <div className="card col">
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="이름" value={character.name} editMode={editMode} onChange={(v) => onChange({ ...character, name: v })} />
        <Field grow label="역할" value={character.role} editMode={editMode} onChange={(v) => onChange({ ...character, role: v })} />
      </div>
      <Checkbox
        label="이 인물이 진범(원인 제공자)입니다"
        checked={character.isCulprit}
        editMode={editMode}
        onChange={(v) => onChange({ ...character, isCulprit: v })}
      />
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="성격 유형" value={character.personalityType} editMode={editMode} onChange={(v) => onChange({ ...character, personalityType: v })} />
        <Field grow label="성격 설명" value={character.personalityDescription} editMode={editMode} multiline small onChange={(v) => onChange({ ...character, personalityDescription: v })} />
      </div>
      <Field label="공개 정보" value={character.publicInfo} editMode={editMode} multiline onChange={(v) => onChange({ ...character, publicInfo: v })} />
      <Field label="상세 정보" value={character.detailInfo} editMode={editMode} multiline onChange={(v) => onChange({ ...character, detailInfo: v })} />
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="협력 유인" value={character.cooperationIncentive} editMode={editMode} multiline small onChange={(v) => onChange({ ...character, cooperationIncentive: v })} />
        <Field grow label="경쟁/은폐 유인" value={character.competitionIncentive} editMode={editMode} multiline small onChange={(v) => onChange({ ...character, competitionIncentive: v })} />
      </div>
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
      {(character.epilogueA !== undefined || character.epilogueB !== undefined) && (
        <>
          <Field
            label="개인 에필로그 A — 자기보고: 밝혀졌다"
            value={character.epilogueA}
            editMode={editMode}
            multiline
            small
            onChange={(v) => onChange({ ...character, epilogueA: v })}
          />
          <Field
            label="개인 에필로그 B — 자기보고: 끝까지 숨겼다"
            value={character.epilogueB}
            editMode={editMode}
            multiline
            small
            onChange={(v) => onChange({ ...character, epilogueB: v })}
          />
        </>
      )}
      {character.adlibIntro !== undefined && (
        <Field label="연기 참고 — 자기소개" value={character.adlibIntro} editMode={editMode} multiline small onChange={(v) => onChange({ ...character, adlibIntro: v })} />
      )}
      {character.adlibLines?.map((line, i) => (
        <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <Field grow label="상황" value={line.trigger} editMode={editMode} small onChange={(v) => updateAdlibLine(i, { trigger: v })} />
          <Field grow label="대사" value={line.line} editMode={editMode} small onChange={(v) => updateAdlibLine(i, { line: v })} />
        </div>
      ))}
      <Checkbox
        label="3인 플레이에도 등장함"
        checked={character.threePlayerVariant?.included !== false}
        editMode={editMode}
        onChange={(v) => updateThreePlayerVariant({ included: v })}
      />
      {editMode && character.threePlayerVariant?.included === false && (
        <Field
          label="3인 변형 메모"
          value={character.threePlayerVariant?.notes}
          editMode={editMode}
          multiline
          small
          onChange={(v) => updateThreePlayerVariant({ notes: v })}
        />
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
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <Field grow label="AP 비용" value={clue.apCost} editMode={editMode} onChange={(v) => onChange({ ...clue, apCost: Number(v) || 0 })} />
        <Field
          grow
          label="관련 인물 id (owner, 비워두면 공용)"
          value={clue.owner ?? ''}
          editMode={editMode}
          onChange={(v) => onChange({ ...clue, owner: v === '' ? null : v })}
        />
      </div>
      <div className="row" style={{ gap: 14 }}>
        <Checkbox label="핵심 단서" checked={clue.isCriticalClue} editMode={editMode} onChange={(v) => onChange({ ...clue, isCriticalClue: v })} />
        <Checkbox label="레드헤링(함정 단서)" checked={clue.isRedHerring} editMode={editMode} onChange={(v) => onChange({ ...clue, isRedHerring: v })} />
      </div>
      {(clue.unlockType === 'combo' || clue.unlockType === 'conditional' || clue.unlockNote) && (
        <Field label="해금 안내" value={clue.unlockNote} editMode={editMode} multiline small onChange={(v) => onChange({ ...clue, unlockNote: v })} />
      )}
      {clue.unlockCondition !== undefined && (
        <Field
          label="해금 조건 (unlockCondition — 1인용 전용)"
          value={clue.unlockCondition ?? ''}
          editMode={editMode}
          small
          onChange={(v) => onChange({ ...clue, unlockCondition: v === '' ? null : v })}
        />
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
      {ending.when !== undefined && (
        <JsonField
          label="발동 조건 (when — 멀티플레이, JSON)"
          value={ending.when}
          editMode={editMode}
          rows={5}
          onChange={(v) => onChange({ ...ending, when: v })}
        />
      )}
      {ending.condition !== undefined && ending.when === undefined && (
        <Field
          label="발동 조건 (condition — 1인용, 예: accusationCorrect == true AND moralChoice == 'reveal_all')"
          value={ending.condition}
          editMode={editMode}
          multiline
          small
          onChange={(v) => onChange({ ...ending, condition: v })}
        />
      )}
      {ending.condition !== undefined && ending.when !== undefined && (
        <p className="dim" style={{ fontSize: 11, margin: 0 }}>
          (참고: 이 엔딩에는 사용되지 않는 예전 condition 텍스트가 남아있습니다 — 실제 판정은 위 when만 봅니다.)
        </p>
      )}
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

  // narration/finalReflectionCheck/epilogueCards/threePlayerVariant/resolutionPhase처럼
  // 구조가 시나리오마다 크게 다른 최상위 필드는 JsonField로 통째로 편집한다.
  const updateTopLevelField = (key, value) => {
    setDraft({ ...draft, [key]: value })
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

      {draft.narration !== undefined && (
        <>
          <h2 className="page-title" style={{ fontSize: 18 }}>내레이션 대본</h2>
          <div className="card col" style={{ marginBottom: 20 }}>
            <JsonField
              value={draft.narration}
              editMode={editMode}
              rows={10}
              onChange={(v) => updateTopLevelField('narration', v)}
            />
          </div>
        </>
      )}

      {draft.threePlayerVariant !== undefined && (
        <>
          <h2 className="page-title" style={{ fontSize: 18 }}>3인용 변형</h2>
          <div className="card col" style={{ marginBottom: 20 }}>
            <p className="dim" style={{ fontSize: 12, margin: 0 }}>
              캐릭터 통합형 3인 변형(threePlayerVariant.integratedCharacter)이나 그 밖의 3인 전용 설정을 JSON으로 직접 수정합니다.
            </p>
            <JsonField
              value={draft.threePlayerVariant}
              editMode={editMode}
              rows={10}
              onChange={(v) => updateTopLevelField('threePlayerVariant', v)}
            />
          </div>
        </>
      )}

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

      <h2 className="page-title" style={{ fontSize: 18 }}>결론 단계</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>
          지목·도덕적 선택 등 각 스텝의 문구·선택지·분류 항목을 JSON으로 직접 수정합니다. 캐릭터를 가리키는 옵션 값은 반드시 캐릭터
          id와 정확히 일치해야 지목/정답 판정이 제대로 됩니다.
        </p>
        <JsonField
          value={draft.resolutionPhase}
          editMode={editMode}
          rows={14}
          onChange={(v) => updateTopLevelField('resolutionPhase', v)}
        />
      </div>

      {draft.finalReflectionCheck !== undefined && (
        <>
          <h2 className="page-title" style={{ fontSize: 18 }}>자기보고 질문 (finalReflectionCheck)</h2>
          <div className="card col" style={{ marginBottom: 20 }}>
            <JsonField
              value={draft.finalReflectionCheck}
              editMode={editMode}
              rows={10}
              onChange={(v) => updateTopLevelField('finalReflectionCheck', v)}
            />
          </div>
        </>
      )}

      <h2 className="page-title" style={{ fontSize: 18 }}>엔딩</h2>
      <div className="col" style={{ marginBottom: 20 }}>
        {draft.endings.map((ending, i) => (
          <EndingEditCard key={ending.id} ending={ending} editMode={editMode} onChange={(next) => updateEnding(i, next)} />
        ))}
      </div>

      {draft.epilogueCards !== undefined && (
        <>
          <h2 className="page-title" style={{ fontSize: 18 }}>공감 에필로그 카드 (epilogueCards)</h2>
          <div className="card col" style={{ marginBottom: 20 }}>
            <JsonField
              value={draft.epilogueCards}
              editMode={editMode}
              rows={8}
              onChange={(v) => updateTopLevelField('epilogueCards', v)}
            />
          </div>
        </>
      )}

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
