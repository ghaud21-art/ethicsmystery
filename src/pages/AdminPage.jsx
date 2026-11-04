import { useEffect, useState } from 'react'
import { validateRoom } from '../mysteryroom/schema.js'
import { decodeNested } from '../mysteryroom/firestoreCodec.js'
import { Link } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import AiFeedbackView from '../components/AiFeedbackView.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSiteConfig, setMainImage } from '../firebase/useSiteConfig.js'
import { getScenario, listScenarios, saveScenario, setScenarioPublished, setScenarioThumbnail, deleteScenario, updateScenarioFields } from '../firebase/scenariosApi.js'
import { parseScenarioDoc } from '../firebase/functionsApi.js'
import { getAdminConfig, saveAdminConfig } from '../firebase/adminConfigApi.js'
import { listAllReflectionLogs, deleteReflectionLog, deleteReflectionLogs } from '../firebase/reflectionApi.js'
import { listMysteryResults, deleteMysteryResult, deleteMysteryResults } from '../mysteryroom/resultsApi.js'
import { CONTENT_TYPES, contentTypeOf, TypeTabs, usePaged, Pager } from '../components/AdminListTools.jsx'
import MysteryLiveBoard from '../mysteryroom/admin/MysteryLiveBoard.jsx'
import { fileToBase64, resizeImageToDataUrl } from '../utils/fileHelpers.js'

function formatDate(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 미스터리룸 결과 한 건 (mysteryRoomResults)
function MysteryResultCard({ r, open, onToggle, onDelete, busy }) {
  const who = r.studentId ? `${r.studentId} ${r.studentName}` : r.nickname
  return (
    <div className="card col">
      <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <strong>{who}</strong>
          {r.studentId && <span className="dim" style={{ fontSize: 12, marginLeft: 6 }}>({r.nickname})</span>}
          <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>
            {r.roomTitle} · 방 {r.roomCode} · {formatDate(r.createdAt)}
          </span>
        </div>
        <span className="pill pill-outline">{r.grade} · {r.endingName}</span>
      </div>
      {open && (
        <div className="col">
          <hr className="divider" style={{ margin: '4px 0 10px' }} />
          <div className="row">
            <span className="pill pill-outline">역할: {r.roles}</span>
            <span className="pill pill-outline">실패 {r.failedTotal}회 · 힌트 {r.hintsUsed}회</span>
            {r.stanceBefore && <span className="pill pill-outline">입장 {r.stanceBefore} → {r.stanceAfter ?? '-'}</span>}
            {r.debate?.conclusion && <span className="pill pill-outline">모둠 결론 {r.debate.conclusion}</span>}
          </div>
          {r.debate?.acknowledge && <p style={{ fontSize: 13, margin: 0 }}><strong>인정한 근거</strong> {r.debate.acknowledge}</p>}
          {r.debate?.concession && <p style={{ fontSize: 13, margin: 0 }}><strong>조건부 양보</strong> {r.debate.concession}</p>}
          {(r.reflection ?? []).map((q, i) => (
            <div key={i}>
              <p className="dim" style={{ fontSize: 12, margin: '0 0 3px' }}>[{q.link}] {q.question}</p>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{q.answer || '(무응답)'}</p>
            </div>
          ))}
          <button onClick={onDelete} disabled={busy} style={{ alignSelf: 'flex-start', marginTop: 6 }}>이 기록 삭제</button>
        </div>
      )}
    </div>
  )
}

function StudentLogsSection({ scenarios }) {
  const [logs, setLogs] = useState(null)
  const [mrResults, setMrResults] = useState(null)
  const [tab, setTab] = useState('murder')
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  const byId = Object.fromEntries((scenarios ?? []).map((s) => [s.scenarioId, s]))
  const titleOf = (id) => byId[id]?.meta?.title ?? id
  // 시나리오가 삭제돼 종류를 알 수 없는 기록은 머더미스터리로 분류한다.
  const typeOfLog = (log) => contentTypeOf(byId[log.scenarioId])

  const refresh = () => {
    listAllReflectionLogs().then(setLogs).catch((e) => setError(e.message))
    listMysteryResults().then(setMrResults).catch(() => setMrResults([]))
  }
  useEffect(() => {
    refresh()
  }, [])

  const q = query.trim().toLowerCase()
  const inTab = tab === 'mysteryroom' ? mrResults : logs?.filter((l) => typeOfLog(l) === tab)
  const filtered = !inTab
    ? null
    : !q
      ? inTab
      : inTab.filter((r) =>
          (tab === 'mysteryroom' ? [r.studentId, r.studentName, r.nickname, r.roomTitle, r.roomCode] : [r.studentId, r.studentName, titleOf(r.scenarioId)]).some((v) =>
            String(v ?? '').toLowerCase().includes(q),
          ),
        )
  const counts = {
    murder: logs?.filter((l) => typeOfLog(l) === 'murder').length ?? 0,
    tanmun: logs?.filter((l) => typeOfLog(l) === 'tanmun').length ?? 0,
    mysteryroom: mrResults?.length ?? 0,
  }
  const paged = usePaged(filtered, 15, `${tab}|${q}`)
  const tabLabel = CONTENT_TYPES.find(([k]) => k === tab)[1]

  const removeLocal = (ids) => {
    const set = new Set(ids)
    if (tab === 'mysteryroom') setMrResults((prev) => prev.filter((r) => !set.has(r.id)))
    else setLogs((prev) => prev.filter((l) => !set.has(l.id)))
  }

  const handleDelete = async (id) => {
    if (!confirm('이 학생 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    setBusy(true)
    setError(null)
    try {
      await (tab === 'mysteryroom' ? deleteMysteryResult(id) : deleteReflectionLog(id))
      removeLocal([id])
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // 지금 보이는 목록(검색 중이면 검색 결과)을 한 번에 지운다. 두 번 확인한다.
  const handleDeleteAll = async () => {
    const ids = filtered.map((r) => r.id)
    const what = q ? `검색 결과 ${ids.length}건` : `${tabLabel} 기록 전체 ${ids.length}건`
    if (!confirm(`${what}을 삭제할까요?`)) return
    if (!confirm(`정말 삭제할까요? ${ids.length}건이 지워지며 되돌릴 수 없습니다.`)) return
    setBusy(true)
    setError(null)
    try {
      await (tab === 'mysteryroom' ? deleteMysteryResults(ids) : deleteReflectionLogs(ids))
      removeLocal(ids)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col">
      <h2 className="page-title" style={{ fontSize: 19 }}>학생 기록</h2>
      <TypeTabs value={tab} onChange={setTab} counts={counts} />
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
      <div className="row">
        <input
          placeholder={tab === 'mysteryroom' ? '이름, 학번, 닉네임, 룸 제목, 방 코드로 검색' : '이름, 학번, 시나리오 제목으로 검색'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button onClick={refresh} disabled={busy}>새로고침</button>
        <button onClick={handleDeleteAll} disabled={busy || !filtered?.length} style={{ borderColor: 'var(--blood-light)', color: 'var(--blood-light)' }}>
          {q ? `검색 결과 ${filtered?.length ?? 0}건 삭제` : `${tabLabel} 전체 삭제`}
        </button>
      </div>
      {!filtered ? (
        error ? null : <div className="dim">불러오는 중...</div>
      ) : inTab.length === 0 ? (
        <p className="dim">아직 저장된 {tabLabel} 기록이 없어요.</p>
      ) : filtered.length === 0 ? (
        <p className="dim">검색 결과가 없어요.</p>
      ) : (
        <div className="col">
          <p className="dim" style={{ fontSize: 11, margin: '0 0 4px' }}>
            {filtered.length}건{q ? ` (전체 ${inTab.length}건 중 검색됨)` : ''} · {tab === 'mysteryroom' ? '최근 제출순' : '학번순'}
          </p>
          {tab === 'mysteryroom'
            ? paged.items.map((r) => (
                <MysteryResultCard key={r.id} r={r} busy={busy} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onDelete={() => handleDelete(r.id)} />
              ))
            : paged.items.map((log) => (
                <div key={log.id} className="card col">
                  <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpenId(openId === log.id ? null : log.id)}>
                    <div>
                      <strong>{log.studentId}</strong>
                      <span style={{ marginLeft: 8 }}>{log.studentName}</span>
                      <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>
                        {titleOf(log.scenarioId)} · {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <span className="pill pill-outline">{log.resultSummary?.endingTitle ?? '결말 정보 없음'}</span>
                  </div>

                  {openId === log.id && (
                    <div className="col">
                      <hr className="divider" style={{ margin: '4px 0 10px' }} />
                      {(log.resultSummary?.accusedLabel || log.resultSummary?.moralChoiceLabel) && (
                        <div className="row">
                          {log.resultSummary?.accusedLabel && <span className="pill pill-outline">지목: {log.resultSummary.accusedLabel}</span>}
                          {log.resultSummary?.moralChoiceLabel && <span className="pill pill-outline">{log.resultSummary.moralChoiceLabel}</span>}
                        </div>
                      )}
                      {Object.entries(log.answers ?? {}).map(([i, a]) => (
                        <div key={i}>
                          <p className="dim" style={{ fontSize: 12, margin: '0 0 3px' }}>{log.reflectionPrompts?.[i] ?? `질문 ${Number(i) + 1}`}</p>
                          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{a}</p>
                        </div>
                      ))}
                      {log.aiFeedback && (
                        <>
                          <p className="dim" style={{ fontSize: 12, margin: '4px 0 8px' }}>AI 피드백</p>
                          <AiFeedbackView feedback={log.aiFeedback} />
                        </>
                      )}
                      <button onClick={() => handleDelete(log.id)} disabled={busy} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                        이 기록 삭제
                      </button>
                    </div>
                  )}
                </div>
              ))}
          <Pager page={paged.page} pages={paged.pages} setPage={paged.setPage} />
        </div>
      )}
    </div>
  )
}

function ApiConfigSection() {
  const [config, setConfig] = useState(null)
  const [schoolCode, setSchoolCode] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [geminiModelPrimary, setGeminiModelPrimary] = useState('')
  const [geminiModelFallback, setGeminiModelFallback] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAdminConfig()
      .then((c) => {
        setConfig(c)
        setSchoolCode(c.schoolCode ?? '')
        setGeminiApiKey(c.geminiApiKey ?? '')
        setGeminiModelPrimary(c.geminiModelPrimary ?? 'gemini-3.5-flash-lite')
        setGeminiModelFallback(c.geminiModelFallback ?? 'gemini-3.1-flash-lite')
      })
      .catch((err) => setError(err.message))
  }, [])

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveAdminConfig({ schoolCode, geminiApiKey, geminiModelPrimary, geminiModelFallback })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!config) return error ? <div className="card"><p style={{ color: 'var(--blood-light)', fontSize: 12, margin: 0 }}>{error}</p></div> : null

  return (
    <div className="card col">
      <strong>학교 코드 / Gemini API 설정</strong>
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>
        학생 인증에 쓰는 학교 코드와, AI 피드백·시나리오 자동 분석에 쓰는 Gemini API 키를 여기서 직접 관리할 수 있습니다.
        Gemini API 키는 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>에서 발급받을 수 있어요.
      </p>

      <label className="dim" style={{ fontSize: 12 }}>학교 코드</label>
      <input placeholder="학생들에게 안내할 코드" value={schoolCode} onChange={(e) => { setSchoolCode(e.target.value); setSaved(false) }} />

      <label className="dim" style={{ fontSize: 12 }}>Gemini API 키</label>
      <div className="row">
        <input
          type={showKey ? 'text' : 'password'}
          placeholder="AIza..."
          value={geminiApiKey}
          onChange={(e) => { setGeminiApiKey(e.target.value); setSaved(false) }}
          style={{ flex: 1 }}
        />
        <button onClick={() => setShowKey((v) => !v)}>{showKey ? '숨기기' : '표시'}</button>
      </div>

      <div className="row">
        <div className="col" style={{ flex: 1 }}>
          <label className="dim" style={{ fontSize: 12 }}>기본 모델</label>
          <input value={geminiModelPrimary} onChange={(e) => { setGeminiModelPrimary(e.target.value); setSaved(false) }} />
        </div>
        <div className="col" style={{ flex: 1 }}>
          <label className="dim" style={{ fontSize: 12 }}>폴백 모델</label>
          <input value={geminiModelFallback} onChange={(e) => { setGeminiModelFallback(e.target.value); setSaved(false) }} />
        </div>
      </div>

      <button className="primary" onClick={handleSave} disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? '저장 중...' : saved ? '저장됨' : '저장'}
      </button>
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
    </div>
  )
}

function MainImageSection() {
  const siteConfig = useSiteConfig()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      await setMainImage(dataUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card col">
      <strong>메인 화면 이미지</strong>
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>
        홈 화면 상단에 표시되는 이미지입니다. 업로드하면 즉시 반영돼요.
      </p>
      {siteConfig?.mainImageDataUrl && (
        <img src={siteConfig.mainImageDataUrl} alt="현재 메인 이미지" style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />
      )}
      <input type="file" accept="image/*" onChange={handleFile} disabled={busy} />
      {busy && <p className="dim" style={{ fontSize: 12 }}>업로드 중...</p>}
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
    </div>
  )
}

function ScenarioUploadSection({ onSaved }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [draftText, setDraftText] = useState('')

  const handleParse = async () => {
    if (!file) return setError('파일을 선택해주세요')
    setBusy(true)
    setError(null)
    try {
      // 이미 이 앱 스키마에 맞는 .json 파일이면 AI 분석 없이 바로 불러온다.
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const text = await file.text()
        const scenario = JSON.parse(text)
        setDraftText(JSON.stringify({ ...scenario, published: false }, null, 2))
        return
      }
      const fileBase64 = await fileToBase64(file)
      const { scenario } = await parseScenarioDoc({ fileBase64, mimeType: file.type || 'application/pdf' })
      setDraftText(JSON.stringify({ ...scenario, published: false }, null, 2))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSaveDraft = async () => {
    setBusy(true)
    setError(null)
    try {
      const parsed = JSON.parse(draftText)
      if (!parsed.scenarioId) throw new Error('scenarioId 필드가 필요합니다')
      // 미스터리룸(room-2.0)은 저장 전에 형식·연결을 검사한다.
      if (parsed.contentType === 'mysteryroom' || String(parsed.schemaVersion).startsWith('room-')) {
        const errors = validateRoom(parsed)
        if (errors.length) throw new Error(`미스터리룸 검사 실패 ${errors.length}건:\n- ${errors.join('\n- ')}`)
      }
      // 같은 ID가 이미 있으면 덮어쓸지 묻고, 공개 상태·썸네일·AI 설정은 그대로 둔다.
      const existing = await getScenario(parsed.scenarioId)
      if (existing) {
        if (!confirm(`같은 ID(${parsed.scenarioId})의 시나리오가 이미 있습니다. 새 내용으로 덮어쓸까요?\n(공개 상태, 썸네일, AI 설정은 그대로 유지됩니다)`)) return
        for (const k of ['published', 'thumbnailDataUrl', 'aiEnabled', 'guestAllowed']) {
          if (existing[k] !== undefined) parsed[k] = existing[k]
        }
      }
      await saveScenario(parsed)
      setDraftText('')
      setFile(null)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card col">
      <strong>새 시나리오 업로드</strong>
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>
        설계안 PDF를 올리면 AI가 앱 스키마에 맞춰 시나리오 데이터를 생성합니다. 이미 이 앱 형식에 맞는 .json 파일이면 분석 없이 바로 불러옵니다.
        저장 전에 아래에서 내용을 검토·수정하세요.
      </p>
      <input type="file" accept="application/pdf,application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
      <button onClick={handleParse} disabled={busy || !file} style={{ alignSelf: 'flex-start' }}>
        {busy ? '처리 중... (PDF는 1~2분 소요될 수 있어요)' : '분석/불러오기'}
      </button>

      {draftText && (
        <>
          <label className="dim" style={{ fontSize: 12 }}>생성된 시나리오 JSON (검토/수정 후 저장)</label>
          <textarea
            rows={16}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          <button className="primary" onClick={handleSaveDraft} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            새 시나리오로 저장 (미발행 상태)
          </button>
        </>
      )}
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12, whiteSpace: 'pre-line' }}>{error}</p>}
    </div>
  )
}

function ScenarioListSection({ scenarios, onChanged }) {
  const [tab, setTab] = useState('murder')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const startEdit = (s) => {
    setEditingId(s.scenarioId)
    // 미스터리룸은 Firestore 저장용 감싸기를 풀어 원래 룸 파일 모양으로 보여 준다.
    setEditText(JSON.stringify(s.contentType === 'mysteryroom' ? decodeNested(s) : s, null, 2))
  }

  const handleTogglePublished = async (s) => {
    setBusy(true)
    setError(null)
    try {
      await setScenarioPublished(s.scenarioId, !s.published)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSaveEdit = async () => {
    setBusy(true)
    setError(null)
    try {
      const parsed = JSON.parse(editText)
      if (parsed.contentType === 'mysteryroom') {
        const errors = validateRoom(parsed)
        if (errors.length) throw new Error(`미스터리룸 검사 실패 ${errors.length}건:\n- ${errors.join('\n- ')}`)
      }
      await saveScenario(parsed)
      setEditingId(null)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (s) => {
    if (!confirm(`'${s.meta?.title}' 시나리오를 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteScenario(s.scenarioId)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleThumbnail = async (s, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await resizeImageToDataUrl(file, { maxWidth: 700, quality: 0.8 })
      await setScenarioThumbnail(s.scenarioId, dataUrl)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const handleToggleAi = async (s) => {
    setBusy(true)
    setError(null)
    try {
      await updateScenarioFields(s.scenarioId, { aiEnabled: s.aiEnabled === false })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const counts = Object.fromEntries(CONTENT_TYPES.map(([k]) => [k, scenarios.filter((s) => contentTypeOf(s) === k).length]))
  const inTab = scenarios.filter((s) => contentTypeOf(s) === tab)
  const paged = usePaged(inTab, 6, tab)

  return (
    <div className="col">
      <TypeTabs value={tab} onChange={setTab} counts={counts} />
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12, whiteSpace: 'pre-line' }}>{error}</p>}
      {tab === 'mysteryroom' && inTab.length > 0 && (
        <p className="dim" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          ‘테스트 플레이’를 누르면 새 탭에서 학생 화면이 열립니다. 대기실의 ‘학생 한 명 더 들어오기’로 탭을 늘리면 혼자서 여러 학생 역할을 해 볼 수 있어요.
          테스트 기록은 저장되지 않으며, 아직 ‘준비 중’인 룸도 테스트할 수 있습니다.
        </p>
      )}
      {inTab.length === 0 && <p className="dim">등록된 {CONTENT_TYPES.find(([k]) => k === tab)[1]} 시나리오가 없어요.</p>}
      {paged.items.map((s) => (
        <div key={s.scenarioId} className="card col">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{s.meta?.title ?? s.scenarioId}</strong>
              <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>{s.scenarioId}</span>
            </div>
            <span className={`pill ${s.published ? 'pill-solid' : 'pill-muted'}`}>
              {s.published ? '플레이 가능' : '준비 중'}
            </span>
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            {s.thumbnailDataUrl && (
              <img src={s.thumbnailDataUrl} alt="썸네일" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
            )}
            <label className="dim" style={{ fontSize: 12 }}>
              썸네일 이미지
              <input type="file" accept="image/*" onChange={(e) => handleThumbnail(s, e)} disabled={busy} style={{ display: 'block', marginTop: 4 }} />
            </label>
          </div>
          <div className="row">
            <button onClick={() => handleTogglePublished(s)} disabled={busy}>
              {s.published ? '준비 중으로 전환' : '플레이 가능으로 전환'}
            </button>
            <Link to={tab === 'mysteryroom' ? `/admin/mystery/${s.scenarioId}` : `/admin/preview/${s.scenarioId}`}><button disabled={busy}>플레이형 편집</button></Link>
            {tab === 'mysteryroom' && (
              <button
                className="primary"
                onClick={() => window.open(`${window.location.pathname}?test=1#/mystery/${s.scenarioId}`, '_blank')}
                title="이 브라우저의 탭끼리만 동기화되는 테스트 방을 엽니다. 기록은 저장되지 않습니다."
              >
                테스트 플레이
              </button>
            )}
            {tab === 'mysteryroom' && (
              <button onClick={() => handleToggleAi(s)} disabled={busy}>
                AI 피드백 {s.aiEnabled === false ? '꺼짐 → 켜기' : '켜짐 → 끄기'}
              </button>
            )}
            <button onClick={() => startEdit(s)} disabled={busy}>JSON 편집</button>
            <button onClick={() => handleDelete(s)} disabled={busy}>삭제</button>
          </div>

          {editingId === s.scenarioId && (
            <div className="col">
              <textarea
                rows={16}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <div className="row">
                <button className="primary" onClick={handleSaveEdit} disabled={busy}>저장</button>
                <button onClick={() => setEditingId(null)} disabled={busy}>취소</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} setPage={paged.setPage} />
    </div>
  )
}

export default function AdminPage() {
  const { email, isAdmin, ready, signInWithGoogle, signOutAdmin } = useAuth()
  const [scenarios, setScenarios] = useState(null)
  const [authError, setAuthError] = useState(null)

  const refreshScenarios = () => listScenarios().then(setScenarios)

  useEffect(() => {
    if (isAdmin) refreshScenarios()
  }, [isAdmin])

  const handleSignIn = async () => {
    setAuthError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setAuthError(e.message)
    }
  }

  if (!ready) return <div className="page dim">불러오는 중...</div>

  return (
    <div className="page-wide">
      <Masthead showBack />
      <h1 className="page-title">관리자</h1>
      <div className="page-title-rule" />

      {!isAdmin ? (
        <div className="card col">
          <p style={{ margin: 0 }}>관리자 계정으로 Google 로그인이 필요합니다.</p>
          <button className="primary" onClick={handleSignIn} style={{ alignSelf: 'flex-start' }}>Google로 로그인</button>
          {authError && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{authError}</p>}
          {email && <p className="dim" style={{ fontSize: 12 }}>{email} 계정으로 로그인됐지만 관리자 계정이 아닙니다.</p>}
        </div>
      ) : (
        <div className="col">
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={signOutAdmin}>로그아웃</button>
          </div>

          <ApiConfigSection />
          <MainImageSection />
          <ScenarioUploadSection onSaved={refreshScenarios} />

          <h2 className="page-title" style={{ fontSize: 19 }}>시나리오 관리</h2>
          {!scenarios ? <div className="dim">불러오는 중...</div> : <ScenarioListSection scenarios={scenarios} onChanged={refreshScenarios} />}

          <MysteryLiveBoard />

          <StudentLogsSection scenarios={scenarios} />
        </div>
      )}
    </div>
  )
}
