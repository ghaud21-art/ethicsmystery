import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Masthead from '../components/Masthead.jsx'
import StepProgress from '../components/StepProgress.jsx'
import APBar from '../components/APBar.jsx'
import MoralChoiceForm from '../components/MoralChoiceForm.jsx'
import { loadScenario } from '../engine/scenarioLoader.js'
import { getSoloRun, saveSoloRun, newSoloRun } from '../utils/soloRun.js'
import { isSoloClueUnlocked, viewSoloClue } from '../engine/soloEngine.js'

function ClueRow({ clue, viewed, unlocked, apRemaining, onView }) {
  const canAfford = apRemaining >= clue.apCost
  return (
    <div className="card col" style={{ marginBottom: 0, opacity: unlocked ? 1 : 0.6 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontFamily: 'var(--font-head)', fontSize: 14 }}>{clue.title}</strong>
        {clue.isCriticalClue && <span className="pill pill-solid">핵심 단서</span>}
      </div>
      {clue.location && <span className="dim" style={{ fontSize: 11 }}>{clue.location}</span>}
      {viewed ? (
        <>
          <p className="dim" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{clue.content}</p>
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>{clue.implication}</p>
        </>
      ) : !unlocked ? (
        <p className="dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>🔒 {clue.unlockNote ?? '아직 조건이 충족되지 않았습니다.'}</p>
      ) : (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="pill pill-muted">AP {clue.apCost}</span>
          <button className="primary" onClick={onView} disabled={!canAfford}>조사하기</button>
        </div>
      )}
    </div>
  )
}

function GameInner({ scenario, run, setRun }) {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  const handleView = (clueId) => {
    setError(null)
    try {
      setRun((prev) => viewSoloClue(scenario, prev, clueId))
    } catch (e) {
      setError(e.message)
    }
  }

  const goToStep = (step) => setRun((prev) => ({ ...prev, step }))

  const accusationStep = scenario.resolutionPhase.steps.find((s) => s.id === 'accusation')
  const moralStep = scenario.resolutionPhase.steps.find((s) => s.id === 'moral_choice')

  const totalAp = scenario.clues.phase1.totalActionPoints ?? 10

  if (run.step === 'briefing') {
    return (
      <div className="page">
        <Masthead showBack />
        <StepProgress activeIndex={1} />
        <div className="kicker">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
          </svg>
          역할 확인
        </div>
        <h1 className="page-title">{scenario.playerCharacter.name}</h1>
        <p className="dim" style={{ marginBottom: 14 }}>{scenario.playerCharacter.role}</p>
        <div className="page-title-rule" />
        <p style={{ fontSize: 14, lineHeight: 1.8 }}>{scenario.playerCharacter.description}</p>
        <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink-dim)' }}>{scenario.prologue.sharedText}</p>
        <p className="dim" style={{ fontSize: 13 }}>
          총 행동력(AP) {totalAp}를 갖고 시작합니다. 무엇을 조사하고 무엇을 넘길지는 당신의 선택입니다.
        </p>
        <button className="primary" onClick={() => goToStep('phase1')} style={{ width: '100%', textAlign: 'left' }}>
          조사 시작하기 →
        </button>
      </div>
    )
  }

  if (run.step === 'phase1') {
    const phase1 = scenario.clues.phase1
    return (
      <div className="page">
        <Masthead />
        <StepProgress activeIndex={2} />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h1 className="page-title" style={{ margin: 0, fontSize: 20 }}>{phase1.label}</h1>
          <APBar current={run.apRemaining} max={totalAp} />
        </div>
        <div className="page-title-rule" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 18 }}>
          {phase1.items.map((clue) => (
            <ClueRow
              key={clue.id}
              clue={clue}
              viewed={run.viewedClueIds.includes(clue.id)}
              unlocked={isSoloClueUnlocked(scenario, clue, run.viewedClueIds)}
              apRemaining={run.apRemaining}
              onView={() => handleView(clue.id)}
            />
          ))}
        </div>
        {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
        <button className="primary" onClick={() => goToStep('phase2')} style={{ width: '100%', textAlign: 'left' }}>
          심층 대질로 →
        </button>
      </div>
    )
  }

  if (run.step === 'phase2') {
    return (
      <div className="page">
        <Masthead />
        <StepProgress activeIndex={2} />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h1 className="page-title" style={{ margin: 0, fontSize: 20 }}>{scenario.clues.phase2.label}</h1>
          <APBar current={run.apRemaining} max={totalAp} />
        </div>
        <div className="page-title-rule" />
        <div className="col" style={{ marginBottom: 18 }}>
          {scenario.characters.map((character) => {
            const [baseId, deepId] = character.ownedPhase2Clues ?? []
            const baseClue = scenario.clues.phase2.items.find((c) => c.id === baseId)
            const deepClue = deepId ? scenario.clues.phase2.items.find((c) => c.id === deepId) : null
            const baseViewed = run.viewedClueIds.includes(baseId)
            return (
              <div key={character.id} className="card col">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontFamily: 'var(--font-head)' }}>{character.name}</strong>
                  <span className="dim" style={{ fontSize: 12 }}>{character.role}</span>
                </div>
                <p className="dim" style={{ margin: 0, fontSize: 12 }}>{character.publicInfo}</p>

                {baseClue && (
                  <ClueRow
                    clue={baseClue}
                    viewed={baseViewed}
                    unlocked
                    apRemaining={run.apRemaining}
                    onView={() => handleView(baseClue.id)}
                  />
                )}
                {deepClue && baseViewed && (
                  <ClueRow
                    clue={deepClue}
                    viewed={run.viewedClueIds.includes(deepClue.id)}
                    unlocked={isSoloClueUnlocked(scenario, deepClue, run.viewedClueIds)}
                    apRemaining={run.apRemaining}
                    onView={() => handleView(deepClue.id)}
                  />
                )}
              </div>
            )
          })}
        </div>
        {error && <p style={{ color: 'var(--blood-light)', fontSize: 12 }}>{error}</p>}
        <button className="primary" onClick={() => goToStep('resolution')} style={{ width: '100%', textAlign: 'left' }}>
          결론으로 →
        </button>
      </div>
    )
  }

  // resolution
  const accusationOptions = accusationStep.options.map((id) => {
    const character = scenario.characters.find((c) => c.id === id)
    if (character) return { id, label: character.name }
    if (id === 'no_single_person') return { id, label: '특정 개인만의 문제는 아니다' }
    return { id, label: id }
  })

  const canSubmit = !!run.accusation && !!run.moralChoice

  const handleFinish = () => {
    const finalRun = { ...run, step: 'ended' }
    saveSoloRun(scenarioId, finalRun)
    navigate(`/scenario/${scenarioId}/solo/results`)
  }

  return (
    <div className="page">
      <Masthead />
      <StepProgress activeIndex={3} />
      <h1 className="page-title">{accusationStep?.prompt ?? '결론'}</h1>
      <div className="page-title-rule" />
      <div className="col" style={{ marginBottom: 24 }}>
        {accusationOptions.map((o) => (
          <button
            key={o.id}
            onClick={() => setRun((prev) => ({ ...prev, accusation: o.id }))}
            style={{
              textAlign: 'left',
              padding: '12px 16px',
              background: run.accusation === o.id ? 'rgba(201,162,39,.14)' : 'var(--panel2)',
              border: run.accusation === o.id ? '1px solid var(--gold)' : '1px solid var(--line)',
              color: 'var(--ink)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <hr className="divider" />
      <MoralChoiceForm
        prompt={moralStep?.prompt}
        value={run.moralChoice}
        onChange={(choice) => setRun((prev) => ({ ...prev, moralChoice: choice }))}
      />
      <button className="primary" onClick={handleFinish} disabled={!canSubmit} style={{ width: '100%', textAlign: 'left' }}>
        결과 확인하기
      </button>
    </div>
  )
}

export default function SoloGamePage() {
  const { scenarioId } = useParams()
  const [scenario, setScenario] = useState(null)
  const [error, setError] = useState(null)
  const [run, setRunState] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadScenario(scenarioId)
      .then((s) => {
        if (cancelled) return
        setScenario(s)
        setRunState(getSoloRun(scenarioId) ?? newSoloRun(s, ''))
      })
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [scenarioId])

  useEffect(() => {
    if (run) saveSoloRun(scenarioId, run)
  }, [run, scenarioId])

  if (error) return <div className="card">시나리오를 불러오지 못했습니다: {error.message}</div>
  if (!scenario || !run) return <div className="dim">불러오는 중...</div>

  return <GameInner scenario={scenario} run={run} setRun={setRunState} />
}
