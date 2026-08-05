const KEY = 'ethicsmystery.results'

export function saveLocalResult(result) {
  const list = loadLocalResults()
  list.push({ ...result, savedAt: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function loadLocalResults() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}
