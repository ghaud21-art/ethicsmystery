import { useEffect, useState } from 'react'

// 관리자 페이지 목록 공통 도구: 콘텐츠 종류 탭 + 페이지 나누기(무한 스크롤 대신).
export const CONTENT_TYPES = [
  ['murder', '머더미스터리'],
  ['tanmun', '탐문 수사'],
  ['mysteryroom', '미스터리 룸'],
]

export function contentTypeOf(scenario) {
  if (scenario?.contentType === 'tanmun') return 'tanmun'
  if (scenario?.contentType === 'mysteryroom') return 'mysteryroom'
  return 'murder'
}

export function TypeTabs({ value, onChange, counts }) {
  return (
    <div className="tabs">
      {CONTENT_TYPES.map(([k, label]) => (
        <button key={k} className={`tab-button ${value === k ? 'active' : ''}`} onClick={() => onChange(k)}>
          {label}
          {counts ? <span className="dim" style={{ marginLeft: 6, fontSize: 11 }}>{counts[k] ?? 0}</span> : null}
        </button>
      ))}
    </div>
  )
}

// resetKey(탭, 검색어 등)가 바뀌면 1쪽으로 돌아간다.
export function usePaged(list, pageSize, resetKey) {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [resetKey])
  const total = list?.length ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const safe = Math.min(page, pages)
  const items = (list ?? []).slice((safe - 1) * pageSize, safe * pageSize)
  return { page: safe, pages, setPage, items, total }
}

export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null
  const nums = []
  const from = Math.max(1, Math.min(page - 2, pages - 4))
  for (let i = from; i <= Math.min(pages, from + 4); i++) nums.push(i)
  return (
    <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 6 }}>
      <button style={{ padding: '5px 10px' }} disabled={page === 1} onClick={() => setPage(page - 1)}>이전</button>
      {nums.map((n) => (
        <button
          key={n}
          onClick={() => setPage(n)}
          style={{ padding: '5px 10px', background: n === page ? 'rgba(201,162,39,0.2)' : undefined, borderColor: n === page ? 'var(--gold)' : undefined }}
        >
          {n}
        </button>
      ))}
      <button style={{ padding: '5px 10px' }} disabled={page === pages} onClick={() => setPage(page + 1)}>다음</button>
      <span className="dim" style={{ fontSize: 11 }}>{page}/{pages}쪽</span>
    </div>
  )
}
