// 새로고침/오작동으로 페이지를 벗어나도 참여 중이던 방으로 돌아갈 수 있도록
// 최소한의 상태(어떤 시나리오/방 코드였는지)를 로컬에 남겨둔다.
const KEY = 'ethicsmystery.activeRoom'

export function saveActiveRoom({ scenarioId, roomCode }) {
  localStorage.setItem(KEY, JSON.stringify({ scenarioId, roomCode, savedAt: Date.now() }))
}

export function getActiveRoom() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function clearActiveRoom() {
  localStorage.removeItem(KEY)
}
