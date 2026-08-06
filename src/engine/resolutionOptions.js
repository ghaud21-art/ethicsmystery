import { getPlayableCharacters, getEffectiveCharacterId } from './characterAssignment'

// resolutionPhase.steps[].options의 각 항목은 세 가지 형태를 지원한다:
//  - 캐릭터 id 문자열 → 그 캐릭터의 이름을 라벨로 사용
//  - "unknown" → "모르겠다"
//  - { id, label } 객체 → 캐릭터가 아닌 시나리오 고유 선택지(예: "규정 자체")를
//    그대로 사용. 저작 시점에 라벨을 정해야 하므로 플레인 문자열로는 표현할 수 없다.
// 1인용/멀티플레이/관리자 미리보기가 모두 이 함수 하나로 지목 선택지를 만든다.
// 통합 캐릭터 3인 시나리오에서는 옵션 목록에 등장하는 원본 캐릭터 id(예: 'sora',
// 'haneul')가 같은 통합 캐릭터로 치환될 수 있으므로, 치환 후 id 기준으로 중복을
// 제거해 "윤소라(통합)" 같은 옵션이 두 번 뜨지 않게 한다.
export function resolveAccusationOptions(scenario, playerCount) {
  const step = scenario.resolutionPhase?.steps?.find((s) => s.id === 'accusation')
  const playable = playerCount ? getPlayableCharacters(scenario, playerCount) : scenario.characters

  const resolved = (step?.options ?? []).map((opt) => {
    if (opt && typeof opt === 'object') return opt
    const effectiveId = playerCount ? getEffectiveCharacterId(scenario, opt, playerCount) : opt
    const character = playable.find((c) => c.id === effectiveId) ?? scenario.characters?.find((c) => c.id === opt)
    if (character) return { id: effectiveId, label: character.name, role: character.role }
    if (opt === 'unknown') return { id: opt, label: '모르겠다' }
    if (opt === 'no_single_person') return { id: opt, label: '특정 개인만의 문제는 아니다' }
    return { id: opt, label: opt }
  })

  const seen = new Set()
  return resolved.filter((o) => {
    if (seen.has(o.id)) return false
    seen.add(o.id)
    return true
  })
}
