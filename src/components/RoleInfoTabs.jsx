import { useState } from 'react'

export default function RoleInfoTabs({ character, secretLayers }) {
  const [tab, setTab] = useState('public')
  if (!character) return null

  return (
    <div className="col">
      <div className="tabs">
        <button className={`tab-button ${tab === 'public' ? 'active' : ''}`} onClick={() => setTab('public')}>
          공개
        </button>
        <button className={`tab-button ${tab === 'detail' ? 'active' : ''}`} onClick={() => setTab('detail')}>
          상세
        </button>
        <button className={`tab-button ${tab === 'secret' ? 'active' : ''}`} onClick={() => setTab('secret')}>
          비밀
        </button>
      </div>

      {tab === 'public' && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, opacity: 0.92 }}>{character.publicInfo}</p>}
      {tab === 'detail' && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, opacity: 0.92 }}>{character.detailInfo}</p>}
      {tab === 'secret' && (
        <div className="col">
          {secretLayers?.length ? (
            secretLayers.map((layer) => (
              <p
                key={layer.layer}
                style={{
                  margin: 0, fontSize: 14, lineHeight: 1.75, color: 'var(--gold-light)',
                  background: 'rgba(201,162,39,.14)', padding: 12, borderLeft: '2px solid var(--gold)',
                }}
              >
                {layer.content}
              </p>
            ))
          ) : (
            <p className="dim" style={{ fontSize: 13, margin: 0 }}>공개된 비밀 정보가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
