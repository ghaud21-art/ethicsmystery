import { useState } from 'react'
import Masthead from '../components/Masthead.jsx'
import { getMyResults } from '../firebase/functionsApi.js'
import { loadRegistry } from '../engine/scenarioLoader.js'

function formatDate(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function StudentResultsPage() {
  const [schoolCode, setSchoolCode] = useState('')
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)
  const [titleMap, setTitleMap] = useState({})
  const [openId, setOpenId] = useState(null)

  const handleSearch = async () => {
    if (!schoolCode || !name.trim() || !studentId.trim()) {
      return setError('학교 코드, 이름, 학번을 모두 입력해주세요')
    }
    setBusy(true)
    setError(null)
    try {
      const [{ results: found }, registry] = await Promise.all([
        getMyResults(schoolCode, name, studentId),
        loadRegistry().catch(() => []),
      ])
      setTitleMap(Object.fromEntries(registry.map((s) => [s.scenarioId, s.title])))
      setResults(found)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Masthead showBack />
      <div className="kicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
        나의 기록
      </div>
      <h1 className="page-title">예전 결과 다시 보기</h1>
      <div className="page-title-rule" />
      <p className="dim" style={{ marginBottom: 16 }}>
        학교 코드 인증 시 입력했던 이름과 학번을 다시 입력하면, 지금까지 플레이한 성찰 기록을 이 기기에서도 볼 수 있어요.
      </p>

      <div className="card col">
        <label className="dim" style={{ fontSize: 12 }}>이름</label>
        <input placeholder="예: 홍길동" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="dim" style={{ fontSize: 12 }}>학번</label>
        <input placeholder="예: 30215" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
        <label className="dim" style={{ fontSize: 12 }}>학교 코드</label>
        <input placeholder="학교에서 안내받은 코드" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} />
        <button className="primary" onClick={handleSearch} disabled={busy} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          {busy ? '조회 중...' : '내 기록 조회하기'}
        </button>
        {error && <p style={{ color: 'var(--blood-light)', fontSize: 12, margin: 0 }}>{error}</p>}
      </div>

      {results && (
        <div className="col" style={{ marginTop: 8 }}>
          {results.length === 0 ? (
            <p className="dim">아직 저장된 기록이 없어요.</p>
          ) : (
            results.map((r) => (
              <div key={r.id} className="card col" style={{ cursor: 'pointer' }} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{titleMap[r.scenarioId] ?? r.scenarioId}</strong>
                    <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>{formatDate(r.createdAt)}</span>
                  </div>
                  <span className="pill pill-outline">{r.resultSummary?.endingTitle ?? '결말 정보 없음'}</span>
                </div>
                {openId === r.id && (
                  <div className="col" style={{ marginTop: 4 }}>
                    <hr className="divider" style={{ margin: '4px 0 10px' }} />
                    {(r.resultSummary?.accusedLabel || r.resultSummary?.moralChoiceLabel) && (
                      <div className="row" style={{ marginBottom: 6 }}>
                        {r.resultSummary?.accusedLabel && <span className="pill pill-outline">지목: {r.resultSummary.accusedLabel}</span>}
                        {r.resultSummary?.moralChoiceLabel && <span className="pill pill-outline">{r.resultSummary.moralChoiceLabel}</span>}
                      </div>
                    )}
                    {Object.entries(r.answers ?? {}).map(([i, a]) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <p className="dim" style={{ fontSize: 12, margin: '0 0 3px' }}>{r.reflectionPrompts?.[i] ?? `질문 ${Number(i) + 1}`}</p>
                        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{a}</p>
                      </div>
                    ))}
                    {r.aiFeedback && (
                      <>
                        <p className="dim" style={{ fontSize: 12, margin: '4px 0 3px' }}>AI 피드백</p>
                        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{r.aiFeedback}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
