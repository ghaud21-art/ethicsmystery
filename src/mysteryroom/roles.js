// 인원수에 따른 역할 통합.
// 룸 파일의 variants["4"].merge = { r5: 'r4' } 처럼 "빠지는 역할 → 받는 역할"을 적는다.
// 연결(r5→r4, r4→r2)은 끝까지 따라가 최종 담당 역할을 찾는다. 인원수에 대한 정의가
// 없으면 앞에서부터 인원수만큼 역할을 남기고 나머지를 차례로 나눠 붙인다.

export function resolveRoles(room, playerCount) {
  const ids = room.roles.map((r) => r.id)
  const count = Math.max(1, Math.min(playerCount, ids.length))
  const merge = { ...(room.variants?.[String(count)]?.merge ?? {}) }

  if (!room.variants?.[String(count)]) {
    ids.slice(count).forEach((id, i) => {
      merge[id] = ids[i % count]
    })
  }

  const ownerOf = {}
  for (const id of ids) {
    let cur = id
    const seen = new Set()
    while (merge[cur] && !seen.has(cur)) {
      seen.add(cur)
      cur = merge[cur]
    }
    ownerOf[id] = cur
  }
  const active = ids.filter((id) => ownerOf[id] === id)
  // active 역할마다 함께 맡는 역할 목록
  const includes = Object.fromEntries(active.map((a) => [a, ids.filter((id) => ownerOf[id] === a)]))
  return { active, ownerOf, includes }
}

// 이 플레이어가 맡은 역할(통합된 역할 포함) 집합
export function myRoleSet(room, playerCount, activeRoleId) {
  if (!activeRoleId) return new Set()
  const { includes } = resolveRoles(room, playerCount)
  return new Set(includes[activeRoleId] ?? [activeRoleId])
}

export function roleById(room, id) {
  return room.roles.find((r) => r.id === id)
}
