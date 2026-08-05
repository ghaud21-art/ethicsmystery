import { useEffect, useState } from 'react'
import Masthead from '../components/Masthead.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSiteConfig, setMainImage } from '../firebase/useSiteConfig.js'
import { listScenarios, saveScenario, setScenarioPublished, deleteScenario } from '../firebase/scenariosApi.js'
import { parseScenarioDoc } from '../firebase/functionsApi.js'
import { fileToBase64, resizeImageToDataUrl } from '../utils/fileHelpers.js'

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
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
    </div>
  )
}

function ScenarioListSection({ scenarios, onChanged }) {
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const startEdit = (s) => {
    setEditingId(s.scenarioId)
    setEditText(JSON.stringify(s, null, 2))
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

  return (
    <div className="col">
      {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
      {scenarios.map((s) => (
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
          <div className="row">
            <button onClick={() => handleTogglePublished(s)} disabled={busy}>
              {s.published ? '준비 중으로 전환' : '플레이 가능으로 전환'}
            </button>
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
    </div>
  )
}

export default function AdminPage() {
  const { uid, isAdmin, ready, signInWithGoogle, signOutAdmin } = useAuth()
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
          {uid && <p className="dim" style={{ fontSize: 12 }}>로그인은 됐지만 관리자 계정이 아닙니다.</p>}
        </div>
      ) : (
        <div className="col">
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={signOutAdmin}>로그아웃</button>
          </div>

          <MainImageSection />
          <ScenarioUploadSection onSaved={refreshScenarios} />

          <h2 className="page-title" style={{ fontSize: 19 }}>시나리오 관리</h2>
          {!scenarios ? <div className="dim">불러오는 중...</div> : <ScenarioListSection scenarios={scenarios} onChanged={refreshScenarios} />}
        </div>
      )}
    </div>
  )
}
