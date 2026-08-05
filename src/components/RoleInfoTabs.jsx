import { useState } from 'react'

export default function RoleInfoTabs({ character, secretLayers }) {
  const [tab, setTab] = useState('public')
  if (!character) return null

  const hasAdlib = character.adlibIntro || character.adlibLines?.length

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
        {hasAdlib && (
          <button className={`tab-button ${tab === 'adlib' ? 'active' : ''}`} onClick={() => setTab('adlib')}>
            연기 참고
          </button>
        )}
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
      {tab === 'adlib' && (
        <div className="col">
          <p className="dim" style={{ fontSize: 12, margin: 0 }}>정해진 대본이 아니라 톤을 잡기 위한 참고용입니다. 자유롭게 애드리브해도 좋아요.</p>
          {character.adlibIntro && (
            <div className="card" style={{ marginBottom: 0 }}>
              <p className="dim" style={{ fontSize: 11, margin: '0 0 4px' }}>자기소개</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>"{character.adlibIntro}"</p>
            </div>
          )}
          {character.adlibLines?.map((l, i) => (
            <div key={i} className="card" style={{ marginBottom: 0 }}>
              <p className="dim" style={{ fontSize: 11, margin: '0 0 4px' }}>{l.trigger}</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>"{l.line}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
