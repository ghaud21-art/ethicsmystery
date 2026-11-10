// 최종 토론 상태와 행동.
// 방 데이터의 debate 노드:
//   stage        'pre' | 'speak' | 'question' | 'twist' | 'agree'
//   stageAt      단계 시작 시각
//   before/{uid} 토론 전 내 생각(입장 id) — 모두 고르기 전에는 공개하지 않는다
//   speeches/{uid} { chips: [근거 키], line }
//   speakIdx     발언 차례
//   questions/{uid} { to, text, answer }
//   swaps/{uid}  { to, line }   입장 교환(1회)
//   votes/{uid}  모둠 결론 투표
//   team         { rev, conditions: [c1, c2], acknowledge, concession, minority }
//   after/{uid}  토론 후 내 생각
//   agree/{uid}  team.rev — 합의문에 동의
import { useMemo } from 'react'
import { getStore } from './store'

export const ISSUE_CARDS = {
  fairness: { label: '공정성', question: '누구에게 더 불리한 결과가 나오는가? 그 불리함은 정당한가?' },
  transparency: { label: '투명성', question: '판단의 근거를 사용자가 알 수 있는가? 알 수 없다면 무엇이 문제인가?' },
  accountability: { label: '책임 소재', question: '문제가 생기면 누가 어떻게 책임지는가?' },
  privacy: { label: '프라이버시', question: '어떤 정보가 어디까지 쓰이는가? 본인이 통제할 수 있는가?' },
  safety: { label: '안전', question: '잘못되었을 때 가장 큰 피해는 무엇이고 누가 입는가?' },
  autonomy: { label: '인간의 자율성', question: '최종 결정은 누가 하는가? 사람이 거절할 수 있는가?' },
  environment: { label: '환경', question: '이 기술이 쓰는 전력과 자원, 탄소 비용은 누가 떠안는가? 그 비용은 정당한가?' },
}

export const STAGES = ['pre', 'speak', 'question', 'twist', 'agree']
export const STAGE_LABEL = { pre: '토론 전 내 생각', speak: '발언 라운드', question: '질문 카드', twist: '반전 카드', agree: '합의' }

const len = (s) => String(s ?? '').trim().length

// 다수결 결론(동수면 방장 표)
export function teamConclusion(votes, uids, hostUid) {
  const cast = uids.map((u) => votes?.[u]).filter(Boolean)
  if (cast.length < uids.length) return null
  const counts = {}
  cast.forEach((v) => (counts[v] = (counts[v] ?? 0) + 1))
  const max = Math.max(...Object.values(counts))
  const top = Object.keys(counts).filter((k) => counts[k] === max)
  return top.length === 1 ? top[0] : votes?.[hostUid] ?? top[0]
}

export function useDebate(room, mr, code) {
  const store = getStore()
  const d = mr.data?.debate ?? {}
  const cfg = room.debate
  const uids = mr.playerUids
  const solo = mr.solo
  const stage = d.stage ?? 'pre'
  // 룸 설정으로 단계를 줄일 수 있다(debate.stages). 혼자면 질문 카드 단계는 뺀다.
  const baseStages = (cfg.stages ?? STAGES).filter((s) => STAGES.includes(s))
  const stages = solo ? baseStages.filter((s) => s !== 'question') : baseStages
  // 합의 단계에서 쓸 칸(debate.agree). 정하지 않으면 모두 쓴다.
  const need = { conditions: true, acknowledge: true, concession: true, ...(cfg.agree ?? {}) }
  const conds = cfg.conditions ?? {}

  const roleStance = (uid) => room.roles.find((r) => r.id === mr.players[uid]?.role)?.stance
  const stanceOf = (uid) => d.swaps?.[uid]?.to ?? roleStance(uid)
  const stanceById = (id) => cfg.stances.find((s) => s.id === id)

  const team = d.team ?? {}
  const conclusion = teamConclusion(d.votes, uids, mr.meta?.hostUid)
  // 가치 충돌 문장(선택 설정): 두 가치 카드 + 이유 문장. 정해 둔 유효한 쌍이어야 통과.
  const vc = cfg.valueConflict
  const pair = team.values ?? []
  const pairValid = !vc || (pair.length === 2 && (vc.validPairs ?? []).some(([a, b]) => (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0])))
  const valueOk = !vc || (pairValid && len(team.valueSentence) >= (vc.minChars ?? 30))
  const teamOk =
    !!conclusion &&
    valueOk &&
    (!need.conditions || (len(team.conditions?.[0]) >= 5 && len(team.conditions?.[1]) >= 5)) &&
    (!need.acknowledge || len(team.acknowledge) >= (conds.acknowledgeMinChars ?? 20)) &&
    (!need.concession || len(team.concession) >= (conds.concessionMinChars ?? 15)) &&
    uids.every((u) => d.after?.[u])
  const allAgreed = teamOk && uids.every((u) => d.agree?.[u] === (team.rev ?? 0))

  // 단계별 "다 했는가"
  const stageDone = {
    pre: uids.every((u) => d.before?.[u]),
    speak: uids.every((u) => d.speeches?.[u]),
    question:
      uids.every((u) => d.questions?.[u]?.text) && uids.every((u) => !d.questions?.[u] || len(d.questions[u].answer) > 0),
    twist: true,
    agree: allAgreed,
  }

  const actions = useMemo(
    () => ({
      setBefore: (sid) => store.set(`${code}/debate/before/${mr.uid}`, sid),
      next: () => {
        const i = stages.indexOf(stage)
        const to = stages[i + 1]
        if (!to) return
        return store.transaction(`${code}/debate`, (cur) => {
          if ((cur?.stage ?? 'pre') !== stage) return undefined
          return { ...(cur ?? {}), stage: to, stageAt: Date.now() }
        })
      },
      speak: (chips, line) =>
        store.update(`${code}/debate`, {
          [`speeches/${mr.uid}`]: { chips, line: line ?? '' },
          speakIdx: (d.speakIdx ?? 0) + 1,
        }),
      ask: (to, text) => store.set(`${code}/debate/questions/${mr.uid}`, { to, text }),
      answer: (fromUid, text) => store.set(`${code}/debate/questions/${fromUid}/answer`, text),
      swap: (to, line) => store.set(`${code}/debate/swaps/${mr.uid}`, { to, line }),
      vote: (sid) => store.set(`${code}/debate/votes/${mr.uid}`, sid),
      setAfter: (sid) => store.set(`${code}/debate/after/${mr.uid}`, sid),
      editTeam: (patch) =>
        store.transaction(`${code}/debate/team`, (cur) => ({ ...(cur ?? {}), ...patch, rev: (cur?.rev ?? 0) + 1 })),
      agree: () => store.set(`${code}/debate/agree/${mr.uid}`, team.rev ?? 0),
      finish: () =>
        store.transaction(`${code}/state`, (cur) => {
          if (!cur || cur.scene !== mr.state.scene) return undefined
          const to = mr.scene.next
          return {
            ...cur,
            debateDone: true,
            debateResult: {
              conclusion,
              conditions: team.conditions ?? [],
              acknowledge: team.acknowledge ?? '',
              concession: team.concession ?? '',
              minority: team.minority ?? '',
              ...(vc ? { values: team.values ?? [], valueSentence: team.valueSentence ?? '' } : {}),
            },
            scene: to,
            sceneAt: Date.now(),
            history: [...(cur.history ?? []), to],
            voteRound: 1,
          }
        }),
    }),
    [store, code, mr, stage, stages, d.speakIdx, team, vc, conclusion],
  )

  return { need, d, cfg, stage, stages, stageDone, stanceOf, roleStance, stanceById, team, conclusion, teamOk, allAgreed, actions, pairValid }
}
