import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getScenario, saveScenario, updateScenarioFields } from '../firebase/scenariosApi.js'
import { uploadScenarioMedia, deleteScenarioMedia } from '../firebase/mediaApi.js'
import { evaluateEndings } from '../engine/endingEvaluator.js'
import { computeSoloMetrics, evaluateSoloEnding } from '../engine/soloEndingEvaluator.js'
import { resolveAccusationOptions } from '../engine/resolutionOptions.js'
import { resizeImageToDataUrl } from '../utils/fileHelpers.js'
import { voiceVideoFiles } from '../utils/missedSceneRun.js'

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

// 탐문 수사(1인 AI 문답 추리) 시나리오 전용 편집기 — 머더미스터리와 데이터 구조가
// 완전히 달라(clues.phase1 등이 없음) 별도 화면으로 분리한다.
function TanmunEditorView({ draft, original, editMode, setEditMode, onChange, onSave, busy, saved, error }) {
  const isDirty = JSON.stringify(draft) !== JSON.stringify(original)
  const updateMeta = (patch) => onChange({ ...draft, meta: { ...draft.meta, ...patch } })
  const updateReflectionPrompt = (index, value) => {
    const reflectionPrompts = draft.reflectionPrompts.map((p, i) => (i === index ? value : p))
    onChange({ ...draft, reflectionPrompts })
  }

  return (
    <div className="page-wide">
      <Masthead showBack />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{draft.meta?.title ?? draft.scenarioId} — 탐문 수사 편집</h1>
        <div className="row" style={{ gap: 10 }}>
          <label className="row" style={{ fontSize: 13, gap: 4 }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
            편집 모드
          </label>
          <button className="primary" onClick={onSave} disabled={!isDirty || busy}>
            {busy ? '저장 중...' : saved ? '저장됨' : '변경사항 저장'}
          </button>
        </div>
      </div>
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}

      <div className="card col" style={{ borderColor: draft.aiEnabled === false ? 'var(--blood-light)' : 'var(--gold)', marginBottom: 20 }}>
        <Checkbox
          label="AI 기록관 사용 (끄면 이 시나리오는 학생이 플레이할 수 없게 잠깁니다)"
          checked={draft.aiEnabled !== false}
          editMode
          onChange={(v) => onChange({ ...draft, aiEnabled: v })}
        />
        <Checkbox
          label="학교 인증 없이(게스트) 플레이 허용 — 체크를 풀면 다시 학교 인증이 필요해집니다"
          checked={draft.guestAllowed === true}
          editMode
          onChange={(v) => onChange({ ...draft, guestAllowed: v })}
        />
        <p className="dim" style={{ fontSize: 11, margin: 0 }}>
          현재 상태: {draft.aiEnabled === false ? 'AI 꺼짐 — 플레이 잠김' : 'AI 켜짐 — 플레이 가능'} ·{' '}
          {draft.guestAllowed === true ? '게스트 허용(인증 불필요)' : '학교 인증 필요'}. 두 설정 모두 서버에서도 동일하게 강제됩니다.
        </p>
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>시나리오 정보</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Field grow label="제목" value={draft.meta?.title} editMode={editMode} onChange={(v) => updateMeta({ title: v })} />
          <Field grow label="부제목" value={draft.meta?.subtitle} editMode={editMode} onChange={(v) => updateMeta({ subtitle: v })} />
        </div>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Field grow label="단원명" value={draft.unit} editMode={editMode} onChange={(v) => onChange({ ...draft, unit: v })} />
          <Field grow label="난이도" value={draft.difficulty} editMode={editMode} onChange={(v) => onChange({ ...draft, difficulty: v })} />
          <Field grow label="예상 소요시간(분)" value={draft.meta?.estimatedMinutes} editMode={editMode} onChange={(v) => updateMeta({ estimatedMinutes: Number(v) || 0 })} />
        </div>
        <Field label="학습 목표" value={draft.meta?.learningObjective} editMode={editMode} multiline onChange={(v) => updateMeta({ learningObjective: v })} />
        <Field
          label="테마 태그 (쉼표로 구분)"
          value={draft.meta?.themes?.join(', ')}
          editMode={editMode}
          onChange={(v) => updateMeta({ themes: v.split(',').map((t) => t.trim()).filter(Boolean) })}
        />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>공개 정보 (플레이어에게 처음 보이는 전부)</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <Field label="사건 개요" value={draft.publicInfo} editMode={editMode} multiline onChange={(v) => onChange({ ...draft, publicInfo: v })} />
        <Field
          label="공개 키워드 개수"
          value={draft.publicKeywordCount}
          editMode={editMode}
          onChange={(v) => onChange({ ...draft, publicKeywordCount: Number(v) || 0 })}
        />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>진상 전문 (AI 기록관 판정의 유일한 근거)</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <Field value={draft.truth} editMode={editMode} multiline onChange={(v) => onChange({ ...draft, truth: v })} />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>확정 사실 목록 (판정용)</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <JsonField value={draft.canonicalFacts} editMode={editMode} rows={10} onChange={(v) => onChange({ ...draft, canonicalFacts: v })} />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>Few-shot 판정 예시</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <JsonField value={draft.fewShots} editMode={editMode} rows={12} onChange={(v) => onChange({ ...draft, fewShots: v })} />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>단서 (15문마다 1장 공개)</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <JsonField value={draft.clues} editMode={editMode} rows={10} onChange={(v) => onChange({ ...draft, clues: v })} />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>최종 추리 채점 슬롯</h2>
      <div className="card col" style={{ marginBottom: 20 }}>
        <JsonField value={draft.slots} editMode={editMode} rows={10} onChange={(v) => onChange({ ...draft, slots: v })} />
        <Field label="보너스 기준 (-1문)" value={draft.bonusRule} editMode={editMode} multiline small onChange={(v) => onChange({ ...draft, bonusRule: v })} />
      </div>

      <h2 className="page-title" style={{ fontSize: 18 }}>성찰 질문</h2>
      <div className="card col" style={{ marginBottom: 24 }}>
        {(draft.reflectionPrompts ?? []).map((prompt, i) => (
          <Field key={i} label={`질문 ${i + 1}`} value={prompt} editMode={editMode} multiline small onChange={(v) => updateReflectionPrompt(i, v)} />
        ))}
      </div>
    </div>
  )
}

// 놓친 장면 미디어 슬롯 — 플레이 화면과 같은 자리에서 실제 플레이어로 보여 주고,
// 그 아래 가는 줄에서 업로드/교체/삭제한다. 업로드 즉시 Storage에 올리고 Firestore
// mediaUrls에 반영하므로, '변경사항 저장'을 누르지 않아도 올린 파일은 사라지지 않는다.
function MediaSlot({ scenarioId, fileName, kind, label, mediaUrls, onUrlChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!fileName) return null
  const url = mediaUrls?.[fileName]
  const accept = kind === 'video' ? 'video/*' : kind === 'audio' ? 'audio/*' : 'image/*'

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const newUrl = await uploadScenarioMedia(scenarioId, fileName, file)
      await onUrlChange(fileName, newUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteScenarioMedia(scenarioId, fileName)
      await onUrlChange(fileName, null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const frame = { width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'block' }
  return (
    <div>
      {url &&
        (kind === 'video' ? (
          <video controls src={url} style={{ ...frame, background: '#000' }} />
        ) : kind === 'audio' ? (
          <audio controls src={url} style={{ width: '100%', display: 'block' }} />
        ) : (
          <img src={url} alt="" style={frame} />
        ))}
      {url ? (
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <span className="pill pill-solid">{label}</span>
          <code style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{fileName}</code>
          <label className="row" style={{ fontSize: 11, gap: 4 }}>
            <span className="dim">교체:</span>
            <input type="file" accept={accept} onChange={handleFile} disabled={busy} style={{ fontSize: 11 }} />
          </label>
          <button onClick={handleDelete} disabled={busy} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--blood-light)' }}>
            삭제
          </button>
          {busy && <span style={{ fontSize: 11, color: 'var(--gold-light)' }}>업로드 중...</span>}
        </div>
      ) : (
        <label
          className="row"
          style={{
            gap: 8, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer',
            border: '1px dashed rgba(201,162,39,.45)', borderRadius: 'var(--radius)', padding: '9px 12px',
          }}
        >
          <span className="pill pill-muted">{label}</span>
          <code style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{fileName}</code>
          <input type="file" accept={accept} onChange={handleFile} disabled={busy} style={{ fontSize: 11 }} />
          {busy && <span style={{ fontSize: 11, color: 'var(--gold-light)' }}>업로드 중...</span>}
        </label>
      )}
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 11, margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}

// 플레이 화면과 같은 문단처럼 보이다가, 편집 모드에서만 점선 입력칸이 되는 글.
function EditableText({ value, onChange, editMode, fontSize = 14, dim, placeholder }) {
  if (!editMode) {
    return (
      <p className={dim ? 'dim' : undefined} style={{ margin: 0, fontSize, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
        {value || placeholder}
      </p>
    )
  }
  const rows = Math.max(2, Math.ceil(String(value ?? '').length / 55))
  return (
    <textarea
      value={value ?? ''}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)',
        border: '1px dashed rgba(201,162,39,.45)', borderRadius: 6, color: 'inherit',
        fontFamily: 'inherit', fontSize, lineHeight: 1.8, padding: '6px 9px', resize: 'vertical',
        opacity: dim ? 0.8 : 1,
      }}
    />
  )
}

// 이름·라벨처럼 한 줄짜리 글의 제자리 편집.
function EditableLine({ value, onChange, editMode, style, placeholder }) {
  if (!editMode) return <span style={style}>{value || placeholder}</span>
  return (
    <input
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'rgba(255,255,255,.03)', border: '1px dashed rgba(201,162,39,.45)', borderRadius: 4,
        color: 'inherit', fontFamily: 'inherit', padding: '2px 7px', ...style,
      }}
    />
  )
}

// 돋보기 위치 지정 — 업로드된 포스터/영상 위를 클릭해 각 조사 지점(사실·혼란)의
// 좌표(hotspot x·y, 화면 비율 0~1)를 찍는다. 좌표가 찍힌 지점은 플레이 화면에서
// 그림 위의 돋보기 버튼으로, 찍지 않은 지점은 글 버튼으로 나온다.
function HotspotPlacer({ sc, sci, updateScene, mediaUrls, inspectMode, onInspectModeChange }) {
  const [activeId, setActiveId] = useState(null)
  const visualFile = [sc.intro?.poster, sc.intro?.video].find((f) => f && mediaUrls?.[f])
  const url = visualFile ? mediaUrls[visualFile] : null
  const isVideo = visualFile === sc.intro?.video && visualFile !== sc.intro?.poster

  const spots = [
    ...(sc.facts ?? []).map((f, fi) => ({
      id: f.id, label: f.hotspot?.label ?? f.title, kind: 'fact',
      x: f.hotspot?.x, y: f.hotspot?.y, w: f.hotspot?.w, h: f.hotspot?.h, fi,
    })),
    ...(sc.decoyHotspots ?? []).map((d, di) => ({
      id: d.id ?? `decoy_${di}`, label: d.label, kind: 'decoy',
      x: d.x, y: d.y, w: d.w, h: d.h, di,
    })),
  ]

  const applyCoords = (spot, patch) =>
    updateScene(sci, (s) => {
      if (spot.fi != null) Object.assign(s.facts[spot.fi].hotspot, patch)
      else Object.assign(s.decoyHotspots[spot.di], patch)
    })

  const handleClick = (e) => {
    if (!activeId) return
    const spot = spots.find((s) => s.id === activeId)
    if (!spot) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    const w = spot.w ?? 0.12
    const h = spot.h ?? 0.12
    applyCoords(spot, {
      x: Math.min(Math.max(cx - w / 2, 0), 1 - w),
      y: Math.min(Math.max(cy - h / 2, 0), 1 - h),
      w, h,
    })
    setActiveId(null)
  }

  if (!url) {
    return (
      <div className="card">
        <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>
          포스터나 도입 영상을 올리면 이 자리에서 그림 위를 클릭해 <strong>돋보기(조사 지점) 위치</strong>를
          찍을 수 있습니다. 위치를 찍지 않은 지점은 플레이 화면에서 지금처럼 글 버튼으로 나옵니다.
        </p>
      </div>
    )
  }

  const frame = { width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'block', pointerEvents: 'none' }
  return (
    <div className="card col">
      <div className="kicker" style={{ marginBottom: 2 }}>조사 지점 위치 지정</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => onInspectModeChange('freeclick')}
          style={{ fontSize: 12, padding: '4px 10px', borderColor: inspectMode === 'freeclick' ? 'var(--gold)' : undefined, background: inspectMode === 'freeclick' ? 'rgba(201,162,39,.12)' : undefined }}
        >
          자유 클릭 (힌트 없음·추천)
        </button>
        <button
          onClick={() => onInspectModeChange('marker')}
          style={{ fontSize: 12, padding: '4px 10px', borderColor: inspectMode === 'marker' ? 'var(--gold)' : undefined, background: inspectMode === 'marker' ? 'rgba(201,162,39,.12)' : undefined }}
        >
          돋보기 표시
        </button>
      </div>
      <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.6 }}>
        {inspectMode === 'freeclick'
          ? '자유 클릭: 학생은 아무 힌트 없이 그림에서 수상한 곳을 직접 클릭합니다. 찍어 둔 네모 영역 안이면 발견, 빗나가면 지목 기회만 사라집니다.'
          : '돋보기 표시: 찍어 둔 자리마다 돋보기 버튼이 떠 있고, 학생은 그중에서 골라 조사합니다.'}
        {' '}아래 목록에서 <strong>위치 찍기</strong>를 누른 뒤, 그림에서 그 물건이 있는 곳을 클릭하세요.
      </p>
      <div
        onClick={handleClick}
        style={{ position: 'relative', cursor: activeId ? 'crosshair' : 'default', outline: activeId ? '2px dashed var(--gold)' : 'none', borderRadius: 'var(--radius)' }}
      >
        {isVideo ? (
          <video muted playsInline preload="auto" src={url} style={{ ...frame, background: '#000' }} />
        ) : (
          <img src={url} alt="" style={frame} />
        )}
        {spots
          .filter((s) => s.x != null && s.y != null)
          .map((s) => (
            <div
              key={s.id}
              title={s.label}
              style={{
                position: 'absolute',
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                width: `${(s.w ?? 0.12) * 100}%`,
                height: `${(s.h ?? 0.12) * 100}%`,
                border: `2px dashed ${s.kind === 'fact' ? 'var(--gold-light)' : 'var(--line)'}`,
                borderRadius: 6, pointerEvents: 'none',
                background: s.kind === 'fact' ? 'rgba(201,162,39,.15)' : 'rgba(120,120,120,.12)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: 10, fontWeight: 800, lineHeight: 1, padding: '2px 4px', borderRadius: 3,
                  background: s.kind === 'fact' ? 'rgba(201,162,39,.9)' : 'rgba(30,26,18,.9)',
                  color: s.kind === 'fact' ? '#1a1510' : 'var(--ink-dim)',
                }}
              >
                {s.kind === 'fact' ? '사실' : '혼란'}
              </span>
            </div>
          ))}
      </div>
      <div className="col" style={{ gap: 5 }}>
        {spots.map((s) => (
          <div key={s.id} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`pill ${s.kind === 'fact' ? 'pill-solid' : 'pill-muted'}`}>{s.kind === 'fact' ? '사실' : '혼란'}</span>
            <span style={{ fontSize: 12, flex: 1, minWidth: 140 }}>{s.label}</span>
            {s.x != null ? (
              <>
                <span className="dim" style={{ fontSize: 11 }}>찍힘 ({Math.round((s.x + (s.w ?? 0) / 2) * 100)}%, {Math.round((s.y + (s.h ?? 0) / 2) * 100)}%)</span>
                <button onClick={() => setActiveId(s.id)} style={{ fontSize: 11, padding: '3px 8px', borderColor: activeId === s.id ? 'var(--gold)' : undefined }}>
                  {activeId === s.id ? '그림을 클릭하세요...' : '다시 찍기'}
                </button>
                <button onClick={() => applyCoords(s, { x: null, y: null })} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--blood-light)' }}>
                  제거
                </button>
              </>
            ) : (
              <button onClick={() => setActiveId(s.id)} style={{ fontSize: 11, padding: '3px 8px', borderColor: activeId === s.id ? 'var(--gold)' : undefined }}>
                {activeId === s.id ? '그림을 클릭하세요...' : '위치 찍기'}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="dim" style={{ margin: 0, fontSize: 11 }}>좌표를 바꾼 뒤에는 상단의 <strong>변경사항 저장</strong>을 눌러야 반영됩니다.</p>
    </div>
  )
}

// 놓친 장면 조사 모드(missedscene-2.0) 편집기 — 글은 JSON으로 올리고, 여기서는
// 미디어 파일 업로드와 장소 영상 위 단서 위치 지정만 한다.
function investigationMediaList(d) {
  const out = []
  const add = (group, label, kind, file) => file && out.push({ group, label, kind, file })
  add('브리핑', '브리핑 영상', 'video', d.briefing?.video)
  for (const c of d.startClues ?? []) if (c.kind === 'image') add('브리핑', `시작 자료 · ${c.title}`, 'image', c.image)
  for (const l of d.locations ?? []) {
    const g = `${l.order}. ${l.name}`
    add(g, '장소 영상', 'video', l.video)
    add(g, '장소 컷 이미지 (학생이 단서를 지목하는 현장 사진)', 'image', l.poster)
    for (const c of l.clues ?? []) if (c.kind === 'image') add(g, `단서 이미지 · ${c.title}`, 'image', c.image)
    const ch = (d.characters ?? []).find((x) => x.id === l.character)
    if (ch) {
      add(g, `${ch.name} 첫 번째 진술`, 'video', ch.statement1?.video)
      add(g, `${ch.name} 두 번째 진술`, 'video', ch.statement2?.video)
    }
  }
  for (const dc of d.decisions ?? []) {
    add('전화·결정', `${dc.label} 전화 이미지`, 'image', dc.call?.image)
    add('전화·결정', `${dc.label} 전화 음성`, 'audio', dc.call?.audio)
  }
  for (const e of d.endings ?? []) add('결말', `결말 · ${e.title}`, 'video', e.video)
  const seen = new Set()
  return out.filter((m) => (seen.has(m.file) ? false : seen.add(m.file)))
}

function MissedInvestigationEditorView({ draft, original, onChange, onSave, busy, saved, error }) {
  const isDirty = JSON.stringify(draft) !== JSON.stringify(original)
  const mediaUrls = draft.mediaUrls ?? {}
  const [tab, setTab] = useState('media')
  const [locIdx, setLocIdx] = useState(0)
  const handleMediaUrlChange = async (fileName, url) => {
    const next = { ...mediaUrls }
    if (url) next[fileName] = url
    else delete next[fileName]
    await updateScenarioFields(draft.scenarioId, { mediaUrls: next })
    onChange({ ...draft, mediaUrls: next })
  }
  const slotProps = { scenarioId: draft.scenarioId, mediaUrls, onUrlChange: handleMediaUrlChange }
  const list = investigationMediaList(draft)
  const groups = [...new Set(list.map((m) => m.group))]
  const done = list.filter((m) => mediaUrls[m.file]).length
  const loc = draft.locations?.[locIdx]
  // HotspotPlacer는 1.0 장면 모양(intro/facts/decoyHotspots)을 기대하므로 장소를 그 모양으로 감싼다.
  const adapter = loc && {
    intro: { video: loc.video, poster: loc.poster },
    facts: (loc.clues ?? []).map((c) => ({ ...c, hotspot: { label: c.title, ...(c.hotspot ?? {}) } })),
    decoyHotspots: loc.decoyHotspots ?? [],
  }
  const updateAdapter = (_i, mutate) => {
    const copy = JSON.parse(JSON.stringify(adapter))
    mutate(copy)
    const locations = draft.locations.map((l, i) => (i !== locIdx ? l : {
      ...l,
      clues: l.clues.map((c, ci) => ({ ...c, hotspot: copy.facts[ci].hotspot })),
      decoyHotspots: copy.decoyHotspots,
    }))
    onChange({ ...draft, locations })
  }
  return (
    <div className="page">
      <Masthead showBack />
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13 }}><span className="dim">놓친 장면(조사 모드) 편집</span> · <strong>{draft.meta?.title ?? draft.scenarioId}</strong></div>
        <button className="primary" onClick={onSave} disabled={!isDirty || busy} style={{ fontSize: 12, padding: '5px 12px' }}>
          {busy ? '저장 중...' : saved ? '저장됨' : '변경사항 저장'}
        </button>
      </div>
      <p className="dim" style={{ margin: '0 0 10px', fontSize: 11, lineHeight: 1.6 }}>
        글 내용은 JSON 파일로 고쳐 다시 올립니다(미디어와 공개 상태는 유지됩니다). 미디어 자리에 파일을 올리면 즉시 저장됩니다
        (업로드됨 {done}/{list.length}).{' '}
        <a href={`${window.location.origin}${window.location.pathname}#/missedscene/${draft.scenarioId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-light)' }}>실제 플레이 화면 열기 →</a>
      </p>
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab-button ${tab === 'media' ? 'active' : ''}`} onClick={() => setTab('media')}>미디어 업로드</button>
        <button className={`tab-button ${tab === 'spots' ? 'active' : ''}`} onClick={() => setTab('spots')}>단서 위치 지정</button>
      </div>
      {tab === 'media' && groups.map((g) => {
        const items = list.filter((m) => m.group === g)
        return (
          <div key={g} className="card col">
            <div className="kicker">{g} <span className="dim">({items.filter((m) => mediaUrls[m.file]).length}/{items.length})</span></div>
            {items.map((m) => <MediaSlot key={m.file} {...slotProps} kind={m.kind} label={`${m.label} — ${m.file}`} fileName={m.file} />)}
          </div>
        )
      })}
      {tab === 'spots' && loc && (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {draft.locations.map((l, i) => (
              <button key={l.id} onClick={() => setLocIdx(i)} style={{ fontSize: 12, padding: '4px 10px', borderColor: i === locIdx ? 'var(--gold)' : undefined, background: i === locIdx ? 'rgba(201,162,39,.12)' : undefined }}>
                {l.order}. {l.name} ({(l.clues ?? []).filter((c) => c.hotspot?.x != null).length}/{l.clues?.length ?? 0})
              </button>
            ))}
          </div>
          <p className="dim" style={{ margin: '0 0 8px', fontSize: 11, lineHeight: 1.6 }}>
            ‘사실’ = 이 장소의 단서(가짜 단서 포함), ‘혼란’ = 아무것도 없는 지점. 위치를 찍지 않은 단서는 학생 화면에서 글 버튼으로 나옵니다.
            입문 난이도에서는 찍어 둔 자리에 돋보기가 표시됩니다.
          </p>
          <HotspotPlacer
            key={loc.id}
            sc={adapter}
            sci={0}
            updateScene={updateAdapter}
            mediaUrls={mediaUrls}
            inspectMode={draft.settings?.inspectMode === 'marker' ? 'marker' : 'freeclick'}
            onInspectModeChange={(m) => onChange({ ...draft, settings: { ...draft.settings, inspectMode: m } })}
          />
        </>
      )}
    </div>
  )
}

// 놓친 장면(1인 영상 추리) 전용 플레이형 편집기 — 학생이 보는 플레이 화면을
// 그대로 띄워 두고(장면 탭 + 단계 탭으로 이동), 그 자리에서 글을 고치고
// 각 미디어 자리(영상·음성·이미지)에 파일을 바로 업로드한다.
const MISSED_PHASES = [
  ['intro', '① 도입'],
  ['inspect', '② 영상 조사'],
  ['voices', '③ 두 목소리'],
  ['decide', '④ 결정'],
  ['result', '⑤ 결과·1년 뒤'],
  ['reveal', '⑥ 원리 공개'],
]

function MissedSceneEditorView({ draft, original, editMode, setEditMode, onChange, onSave, busy, saved, error }) {
  const isDirty = JSON.stringify(draft) !== JSON.stringify(original)
  const updateMeta = (patch) => onChange({ ...draft, meta: { ...draft.meta, ...patch } })
  const updateReflectionPrompt = (index, value) => {
    const reflectionPrompts = draft.reflectionPrompts.map((p, i) => (i === index ? value : p))
    onChange({ ...draft, reflectionPrompts })
  }
  const [sceneIdx, setSceneIdx] = useState(0)
  const [phase, setPhase] = useState('intro')
  const [choiceId, setChoiceId] = useState('A')

  const mediaUrls = draft.mediaUrls ?? {}
  const uploadedCount = Object.keys(mediaUrls).length

  // 업로드/삭제 즉시 Firestore 문서에 반영한다 — '변경사항 저장'을 잊어도 URL이 남도록.
  const handleMediaUrlChange = async (fileName, url) => {
    const next = { ...mediaUrls }
    if (url) next[fileName] = url
    else delete next[fileName]
    await updateScenarioFields(draft.scenarioId, { mediaUrls: next })
    onChange({ ...draft, mediaUrls: next })
  }

  // 깊이 중첩된 장면 데이터는 복사 후 콜백으로 고친다.
  const updateScene = (idx, mutate) => {
    const scenes = draft.scenes.map((s, i) => {
      if (i !== idx) return s
      const copy = JSON.parse(JSON.stringify(s))
      mutate(copy)
      return copy
    })
    onChange({ ...draft, scenes })
  }

  const updatePrinciple = (key, patch) =>
    onChange({ ...draft, principles: { ...draft.principles, [key]: { ...draft.principles[key], ...patch } } })

  const slotProps = { scenarioId: draft.scenarioId, mediaUrls, onUrlChange: handleMediaUrlChange }
  const scenes = [...(draft.scenes ?? [])].sort((a, b) => a.order - b.order)
  const sc = scenes[Math.min(sceneIdx, scenes.length - 1)]
  const sci = draft.scenes.indexOf(sc) // updateScene은 원본 배열 기준 인덱스를 쓴다
  const ui = draft.ui ?? {}
  const choice = sc?.choices?.find((c) => c.id === choiceId) ?? sc?.choices?.[0]
  const chi = sc?.choices?.indexOf(choice)
  const variableFact = sc?.facts?.find((f) => f.isVariable)
  const vfi = sc?.facts?.indexOf(variableFact)

  const gotoScene = (i) => {
    setSceneIdx(i)
    setPhase('intro')
    setChoiceId('A')
  }
  const phaseIdx = MISSED_PHASES.findIndex(([k]) => k === phase)
  const nextPhase = () => {
    if (phaseIdx < MISSED_PHASES.length - 1) setPhase(MISSED_PHASES[phaseIdx + 1][0])
    else if (sceneIdx < scenes.length - 1) gotoScene(sceneIdx + 1)
  }
  const nextLabel =
    phase === 'intro' ? '영상을 조사한다 →'
    : phase === 'inspect' ? '조사를 마치고 동료들의 이야기를 듣는다 →'
    : phase === 'voices' ? '이제 결정한다 →'
    : phase === 'decide' ? '결과를 본다 →'
    : phase === 'result' ? '원리 맞히기 →'
    : sceneIdx < scenes.length - 1 ? '다음 장면으로 →' : null

  if (!sc) return <div className="page"><Masthead showBack /><div className="card">장면 데이터가 없습니다.</div></div>

  return (
    <div className="page">
      <Masthead showBack />

      {/* 상단 관리 막대 */}
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13 }}>
          <span className="dim">놓친 장면 편집</span> · <strong>{draft.meta?.title ?? draft.scenarioId}</strong>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="row" style={{ fontSize: 12, gap: 4 }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
            편집 모드
          </label>
          <button className="primary" onClick={onSave} disabled={!isDirty || busy} style={{ fontSize: 12, padding: '5px 12px' }}>
            {busy ? '저장 중...' : saved ? '저장됨' : '변경사항 저장'}
          </button>
        </div>
      </div>
      <p className="dim" style={{ margin: '0 0 10px', fontSize: 11, lineHeight: 1.6 }}>
        학생이 보는 화면 그대로입니다. 점선 칸의 글을 바로 고치고(고친 뒤 <strong>변경사항 저장</strong>),
        미디어 자리에는 파일을 올리면 즉시 저장됩니다 (업로드됨 {uploadedCount}개).{' '}
        <a href={`${window.location.origin}${window.location.pathname}#/missedscene/${draft.scenarioId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-light)' }}>
          실제 플레이 화면 열기 →
        </a>
      </p>
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}

      {/* 장면·단계 이동 */}
      <div className="tabs" style={{ marginBottom: 8 }}>
        {scenes.map((s, i) => (
          <button key={s.id} className={`tab-button ${i === sceneIdx ? 'active' : ''}`} onClick={() => gotoScene(i)}>
            장면 {s.order}
          </button>
        ))}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {MISSED_PHASES.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPhase(k)}
            style={{
              fontSize: 12, padding: '4px 10px',
              borderColor: phase === k ? 'var(--gold)' : undefined,
              background: phase === k ? 'rgba(201,162,39,.12)' : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 장면 머리글 — 플레이 화면과 동일 */}
      <div className="kicker" style={{ marginBottom: 2 }}>
        장면 {sc.order} ·{' '}
        <EditableLine value={sc.job} editMode={editMode} style={{ fontSize: 11 }} onChange={(v) => updateScene(sci, (s) => { s.job = v })} />
      </div>
      <h1 className="page-title" style={{ fontSize: 22 }}>
        <EditableLine value={sc.title} editMode={editMode} style={{ fontSize: 22, fontWeight: 800 }} onChange={(v) => updateScene(sci, (s) => { s.title = v })} />
      </h1>
      <div className="page-title-rule" />

      {/* ---- ① 도입 ---- */}
      {phase === 'intro' && (
        <div className="card col">
          <MediaSlot {...slotProps} kind="video" label="도입 영상" fileName={sc.intro?.video} />
          <MediaSlot {...slotProps} kind="image" label="포스터(영상 썸네일)" fileName={sc.intro?.poster} />
          <MediaSlot {...slotProps} kind="audio" label="도입 내레이션 음성" fileName={sc.intro?.narrationAudio} />
          <EditableText value={sc.intro?.text} editMode={editMode} onChange={(v) => updateScene(sci, (s) => { s.intro.text = v })} />
        </div>
      )}

      {/* ---- ② 영상 조사 ---- */}
      {phase === 'inspect' && (
        <>
          <div className="card col">
            <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>{ui.inspectGuide}</p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {buildMissedSpots(sc).map((spot) => (
                <button key={spot.id} style={{ fontSize: 12, borderColor: spot.kind === 'fact' ? 'var(--gold)' : undefined, color: spot.kind === 'decoy' ? 'var(--ink-dim)' : undefined }}>
                  {spot.label}
                </button>
              ))}
            </div>
            <p className="dim" style={{ margin: 0, fontSize: 11 }}>
              학생에게는 사실·혼란 지점이 구분 없이 섞여 보입니다 (금색 테두리 = 진짜 사실).
              돋보기 위치를 찍은 지점은 글 버튼 대신 그림 위의 돋보기로 나옵니다.
            </p>
          </div>

          <HotspotPlacer
            sc={sc}
            sci={sci}
            updateScene={updateScene}
            mediaUrls={mediaUrls}
            inspectMode={draft.settings?.inspectMode === 'marker' ? 'marker' : 'freeclick'}
            onInspectModeChange={(m) => onChange({ ...draft, settings: { ...draft.settings, inspectMode: m } })}
          />

          {(sc.facts ?? []).map((f, fi) => (
            <div key={f.id} className="card col" style={{ borderColor: f.isVariable ? 'var(--blood-light)' : 'var(--gold)', gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>
                  <EditableLine value={f.title} editMode={editMode} style={{ fontSize: 13, fontWeight: 800 }} onChange={(v) => updateScene(sci, (s) => { s.facts[fi].title = v })} />
                </strong>
                <span className="row" style={{ gap: 6 }}>
                  <span className="pill pill-muted">{f.level}</span>
                  {f.isVariable && <span className="pill pill-solid">변수</span>}
                </span>
              </div>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="dim" style={{ fontSize: 11 }}>조사 지점:</span>
                <EditableLine value={f.hotspot?.label} editMode={editMode} style={{ fontSize: 11 }} onChange={(v) => updateScene(sci, (s) => { s.facts[fi].hotspot.label = v })} />
              </div>
              <EditableText value={f.text} editMode={editMode} fontSize={12} dim onChange={(v) => updateScene(sci, (s) => { s.facts[fi].text = v })} />
              {f.card?.src && (
                <MediaSlot {...slotProps} kind={f.card.type === 'audio' ? 'audio' : 'image'} label="확대 카드" fileName={f.card.src} />
              )}
              {f.isVariable && (
                <>
                  <p className="dim" style={{ margin: '4px 0 0', fontSize: 11 }}>변수 내레이션 (이 사실을 찾은 학생에게 결정 직전에 나옵니다):</p>
                  <EditableText value={f.variableNarration?.text} editMode={editMode} fontSize={12} onChange={(v) => updateScene(sci, (s) => { s.facts[fi].variableNarration.text = v })} />
                  <MediaSlot {...slotProps} kind="audio" label="변수 내레이션 음성" fileName={f.variableNarration?.audio} />
                </>
              )}
            </div>
          ))}

          <div className="card col">
            <div className="kicker" style={{ marginBottom: 2 }}>혼란용 조사 지점 (눌러도 아무것도 없는 곳)</div>
            {(sc.decoyHotspots ?? []).map((d, di) => (
              <div key={d.id ?? di} className="row" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <EditableLine value={d.label} editMode={editMode} style={{ fontSize: 12, minWidth: 140 }} onChange={(v) => updateScene(sci, (s) => { s.decoyHotspots[di].label = v })} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <EditableText value={d.text} editMode={editMode} fontSize={11} dim onChange={(v) => updateScene(sci, (s) => { s.decoyHotspots[di].text = v })} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- ③ 두 목소리 ---- */}
      {phase === 'voices' &&
        (sc.voices ?? []).map((v, vi) => (
          <div key={v.id} className="card col" style={{ borderLeft: '2px solid var(--gold)' }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>
                <EditableLine value={v.speaker} editMode={editMode} style={{ fontSize: 13, fontWeight: 800, width: 90 }} onChange={(val) => updateScene(sci, (s) => { s.voices[vi].speaker = val })} />
                {' '}· <EditableLine value={v.role} editMode={editMode} style={{ fontSize: 12, fontWeight: 400 }} onChange={(val) => updateScene(sci, (s) => { s.voices[vi].role = val })} />
              </strong>
              <span className="pill pill-muted">
                <EditableLine value={v.tone} editMode={editMode} style={{ fontSize: 11 }} onChange={(val) => updateScene(sci, (s) => { s.voices[vi].tone = val })} />
              </span>
            </div>
            {voiceVideoFiles(sc, v).map((file, fi2) => (
              <MediaSlot key={file} {...slotProps} kind="video" label={`동료 ${v.id} 설득 영상 ${fi2 + 1}${fi2 > 0 ? ' (선택)' : ''}`} fileName={file} />
            ))}
            {/* 음성 슬롯은 이미 올린 파일이 있을 때만 — 설득은 영상으로 가기로 해서 새 업로드 자리는 숨긴다 */}
            {mediaUrls[v.audio] && <MediaSlot {...slotProps} kind="audio" label={`동료 ${v.id} 설득 음성`} fileName={v.audio} />}
            <p className="dim" style={{ margin: 0, fontSize: 11 }}>설득 영상은 최대 2개 — 올린 것만, 1→2 순서대로 플레이 화면에 나옵니다.</p>
            <EditableText value={v.text} editMode={editMode} onChange={(val) => updateScene(sci, (s) => { s.voices[vi].text = val })} />
          </div>
        ))}

      {/* ---- ④ 결정 ---- */}
      {phase === 'decide' && (
        <>
          <div className="card col">
            <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>어떻게 하시겠습니까?</strong>
            {(sc.choices ?? []).map((c, ci) => (
              <div key={c.id} className="row" style={{ border: '1px solid', borderColor: c.requires ? 'var(--gold)' : 'var(--line)', borderRadius: 'var(--radius)', padding: '9px 12px', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13 }}>{c.id}.</strong>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <EditableText value={c.label} editMode={editMode} fontSize={13} onChange={(v) => updateScene(sci, (s) => { s.choices[ci].label = v })} />
                </div>
                {c.requires && <span className="pill pill-solid">사실 3개 해금</span>}
              </div>
            ))}
            <p className="dim" style={{ margin: 0, fontSize: 11 }}>{ui.reasonPrompt} (이유 작성 칸이 함께 나옵니다)</p>
          </div>

          {variableFact && (
            <div className="card col" style={{ borderColor: 'var(--blood-light)' }}>
              <div className="kicker" style={{ marginBottom: 2 }}>잠깐 — (변수: {variableFact.title}을 찾은 학생에게만)</div>
              <MediaSlot {...slotProps} kind="audio" label="변수 내레이션 음성" fileName={variableFact.variableNarration?.audio} />
              <EditableText value={variableFact.variableNarration?.text} editMode={editMode} onChange={(v) => updateScene(sci, (s) => { s.facts[vfi].variableNarration.text = v })} />
              <div className="row">
                <button className="primary" style={{ flex: 1, textAlign: 'left' }} disabled>결정을 유지한다</button>
                <button style={{ flex: 1, textAlign: 'left' }} disabled>다시 생각한다</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- ⑤ 결과·1년 뒤 ---- */}
      {phase === 'result' && choice && (
        <>
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            {(sc.choices ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setChoiceId(c.id)}
                style={{ fontSize: 12, padding: '4px 12px', borderColor: choice.id === c.id ? 'var(--gold)' : undefined, background: choice.id === c.id ? 'rgba(201,162,39,.12)' : undefined }}
              >
                선택 {c.id}
              </button>
            ))}
          </div>
          <div className="card col">
            <div className="kicker" style={{ marginBottom: 2 }}>나의 선택 — {choice.label}</div>
            <MediaSlot {...slotProps} kind="video" label="결과 영상" fileName={choice.result?.video} />
            <EditableText value={choice.result?.text} editMode={editMode} onChange={(v) => updateScene(sci, (s) => { s.choices[chi].result.text = v })} />
          </div>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="card" style={{ flex: 1, marginBottom: 0, borderColor: '#4caf7d' }}>
              <p className="dim" style={{ margin: '0 0 4px', fontSize: 11 }}>얻은 것</p>
              <EditableText value={choice.result?.gained} editMode={editMode} fontSize={13} onChange={(v) => updateScene(sci, (s) => { s.choices[chi].result.gained = v })} />
            </div>
            <div className="card" style={{ flex: 1, marginBottom: 0, borderColor: 'var(--blood-light)' }}>
              <p className="dim" style={{ margin: '0 0 4px', fontSize: 11 }}>잃은 것</p>
              <EditableText value={choice.result?.lost} editMode={editMode} fontSize={13} onChange={(v) => updateScene(sci, (s) => { s.choices[chi].result.lost = v })} />
            </div>
          </div>
          <div className="card col" style={{ marginTop: 12 }}>
            <div className="kicker" style={{ marginBottom: 2 }}>{ui.epilogueTitle ?? '1년 뒤'}</div>
            <MediaSlot {...slotProps} kind="video" label="1년 뒤 영상" fileName={choice.epilogue?.video} />
            <EditableText value={choice.epilogue?.text} editMode={editMode} onChange={(v) => updateScene(sci, (s) => { s.choices[chi].epilogue.text = v })} />
          </div>
        </>
      )}

      {/* ---- ⑥ 원리 공개 ---- */}
      {phase === 'reveal' && (
        <>
          <div className="card col" style={{ borderLeft: '2px solid var(--gold)' }}>
            <div className="kicker" style={{ marginBottom: 2 }}>해설 (원리 맞히기 뒤에 보입니다)</div>
            <EditableText value={sc.reveal?.explanation} editMode={editMode} fontSize={13} onChange={(v) => updateScene(sci, (s) => { s.reveal.explanation = v })} />
          </div>
          {['A', 'B'].map((side) => {
            const key = sc.reveal?.answer?.[side]
            const p = draft.principles?.[key]
            if (!p) return null
            const voice = sc.voices?.find((v) => v.id === side)
            return (
              <div key={side} className="card col" style={{ gap: 4 }}>
                <strong style={{ fontSize: 13, fontFamily: 'var(--font-head)' }}>
                  {voice?.speaker} → {p.name} ({p.thinker}) · 교과서 {p.textbookPage}쪽
                </strong>
                <EditableText value={p.summary} editMode={editMode} fontSize={12} dim onChange={(v) => updatePrinciple(key, { summary: v })} />
                <p className="dim" style={{ margin: '4px 0 0', fontSize: 11 }}>교과서 인용문 (비워 두면 표시되지 않음):</p>
                <EditableText value={p.quote} editMode={editMode} fontSize={12} placeholder="교과서 인용문을 입력하세요" onChange={(v) => updatePrinciple(key, { quote: v })} />
              </div>
            )
          })}
          {sc.toneTrap?.enabled && (
            <div className="card col">
              <div className="kicker" style={{ marginBottom: 2 }}>말투 점검</div>
              <EditableText value={sc.toneTrap?.question} editMode={editMode} fontSize={13} onChange={(v) => updateScene(sci, (s) => { s.toneTrap.question = v })} />
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {(sc.toneTrap?.options ?? []).map((opt) => (
                  <button key={opt} disabled style={{ fontSize: 13 }}>{opt}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {nextLabel && (
        <button className="primary" onClick={nextPhase} style={{ width: '100%', textAlign: 'left', marginTop: 4 }}>
          {nextLabel}
        </button>
      )}

      <hr className="divider" style={{ margin: '22px 0 14px' }} />

      {/* 플레이 화면 밖의 정보는 아래에 접어 둔다 */}
      <details className="card" style={{ marginBottom: 12 }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 14 }}>시나리오 정보 (제목·소개·태그)</summary>
        <div className="col" style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <Field grow label="제목" value={draft.meta?.title} editMode={editMode} onChange={(v) => updateMeta({ title: v })} />
            <Field grow label="부제목" value={draft.meta?.subtitle} editMode={editMode} onChange={(v) => updateMeta({ subtitle: v })} />
          </div>
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <Field grow label="단원명" value={draft.meta?.unit} editMode={editMode} onChange={(v) => updateMeta({ unit: v })} />
            <Field grow label="난이도" value={draft.difficulty} editMode={editMode} onChange={(v) => onChange({ ...draft, difficulty: v })} />
            <Field grow label="예상 소요시간(분)" value={draft.meta?.estimatedMinutes} editMode={editMode} onChange={(v) => updateMeta({ estimatedMinutes: Number(v) || 0 })} />
          </div>
          <Field label="게임 소개" value={draft.description} editMode={editMode} multiline onChange={(v) => onChange({ ...draft, description: v })} />
          <Field
            label="테마 태그 (쉼표로 구분)"
            value={draft.meta?.themes?.join(', ')}
            editMode={editMode}
            onChange={(v) => updateMeta({ themes: v.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
        </div>
      </details>

      <details className="card" style={{ marginBottom: 12 }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 14 }}>성찰 질문 {draft.reflectionPrompts?.length ?? 0}개</summary>
        <div className="col" style={{ marginTop: 12 }}>
          {(draft.reflectionPrompts ?? []).map((prompt, i) => (
            <Field key={i} label={`질문 ${i + 1}`} value={prompt} editMode={editMode} multiline small onChange={(v) => updateReflectionPrompt(i, v)} />
          ))}
        </div>
      </details>

      <details className="card" style={{ marginBottom: 24 }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 14 }}>세부 설정 (JSON)</summary>
        <div className="col" style={{ marginTop: 12 }}>
          <JsonField label="진행 설정 (settings)" value={draft.settings} editMode={editMode} rows={8} onChange={(v) => onChange({ ...draft, settings: v })} />
          <JsonField label="화면 문구 (ui)" value={draft.ui} editMode={editMode} rows={8} onChange={(v) => onChange({ ...draft, ui: v })} />
          <JsonField label="마무리 (ending — 결과 화면·타당성 검사·진로 연계)" value={draft.ending} editMode={editMode} rows={8} onChange={(v) => onChange({ ...draft, ending: v })} />
        </div>
      </details>
    </div>
  )
}

// 편집기에서 조사 지점 배치를 플레이와 비슷하게 보여 주기 위한 목록 (섞지 않고 순서대로).
function buildMissedSpots(scene) {
  return [
    ...(scene.facts ?? []).map((f) => ({ id: f.id, kind: 'fact', label: f.hotspot?.label ?? f.title })),
    ...(scene.decoyHotspots ?? []).map((d, i) => ({ id: d.id ?? `decoy_${i}`, kind: 'decoy', label: d.label })),
  ]
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

  // 탐문 수사는 데이터 구조가 완전히 달라 전용 편집기로 분기한다.
  if (draft.contentType === 'tanmun') {
    return (
      <TanmunEditorView
        draft={draft}
        original={original}
        editMode={editMode}
        setEditMode={setEditMode}
        onChange={(next) => { setDraft(next); setSaved(false) }}
        onSave={handleSave}
        busy={busy}
        saved={saved}
        error={error}
      />
    )
  }

  if (draft.contentType === 'missedscene') {
    const View = draft.mode === 'investigation' ? MissedInvestigationEditorView : MissedSceneEditorView
    return (
      <View
        draft={draft}
        original={original}
        editMode={editMode}
        setEditMode={setEditMode}
        onChange={(next) => { setDraft(next); setSaved(false) }}
        onSave={handleSave}
        busy={busy}
        saved={saved}
        error={error}
      />
    )
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
