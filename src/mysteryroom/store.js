// 미스터리룸 방 상태 저장소.
// 실제 서비스는 Firebase Realtime DB(`mysteryRooms/{code}`)를 쓰고, 개발 중에는
// Firebase 없이 같은 브라우저의 여러 탭끼리 동기화되는 로컬 저장소를 쓸 수 있다.
// (주소에 ?local=1 을 붙이거나 개발 서버에서 Firebase 설정이 비어 있을 때)
// 두 저장소는 같은 인터페이스를 가진다: subscribe / set / update / remove / transaction.
import { ref, onValue, set, update, remove, runTransaction, get } from 'firebase/database'
import { db } from '../firebase/firebaseConfig'

const ROOT = 'mysteryRooms'

function firebaseStore() {
  const r = (path) => ref(db, `${ROOT}/${path}`)
  return {
    kind: 'firebase',
    subscribe: (path, cb) => onValue(r(path), (snap) => cb(snap.val())),
    get: async (path) => (await get(r(path))).val(),
    set: (path, value) => set(r(path), value),
    update: (path, patch) => update(r(path), patch),
    remove: (path) => remove(r(path)),
    transaction: async (path, fn) => {
      const res = await runTransaction(r(path), (cur) => {
        const next = fn(cur)
        return next === undefined ? undefined : next
      })
      return { committed: res.committed, value: res.snapshot.val() }
    },
  }
}

// ---- 로컬(개발용) 저장소: localStorage 한 덩어리 + BroadcastChannel 알림 ----
const LOCAL_KEY = 'ethicsmystery.mysteryroom.localdb'

function splitPath(path) {
  return path.split('/').filter(Boolean)
}
function getIn(obj, parts) {
  return parts.reduce((o, k) => (o == null ? undefined : o[k]), obj)
}
function setIn(obj, parts, value) {
  if (parts.length === 0) return value
  const [head, ...rest] = parts
  const base = obj && typeof obj === 'object' ? { ...obj } : {}
  const child = setIn(base[head], rest, value)
  if (child === null || child === undefined) delete base[head]
  else base[head] = child
  return Object.keys(base).length ? base : null
}
// Firebase처럼 빈 객체/배열은 저장하지 않는다(null로 취급).
function clean(v) {
  if (v === undefined) return null
  if (Array.isArray(v)) {
    const arr = v.map(clean).filter((x) => x !== null)
    return arr.length ? arr : null
  }
  if (v && typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) {
      const c = clean(val)
      if (c !== null) out[k] = c
    }
    return Object.keys(out).length ? out : null
  }
  return v
}

function localStore() {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LOCAL_KEY) : null
  const listeners = new Set()
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? {}
    } catch {
      return {}
    }
  }
  const notify = () => listeners.forEach((l) => l())
  const write = (data) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data ?? {}))
    notify()
    channel?.postMessage('changed')
  }
  if (channel) channel.onmessage = notify
  window.addEventListener('storage', (e) => e.key === LOCAL_KEY && notify())

  const writePath = (path, value) => write(setIn(read(), splitPath(path), clean(value)))

  return {
    kind: 'local',
    subscribe: (path, cb) => {
      let last
      const fire = () => {
        const v = getIn(read(), splitPath(path)) ?? null
        const s = JSON.stringify(v)
        if (s !== last) {
          last = s
          cb(v)
        }
      }
      listeners.add(fire)
      fire()
      return () => listeners.delete(fire)
    },
    get: async (path) => getIn(read(), splitPath(path)) ?? null,
    set: async (path, value) => writePath(path, value),
    update: async (path, patch) => {
      let data = read()
      for (const [k, v] of Object.entries(patch)) data = setIn(data, splitPath(`${path}/${k}`), clean(v))
      write(data)
    },
    remove: async (path) => writePath(path, null),
    transaction: async (path, fn) => {
      const cur = getIn(read(), splitPath(path)) ?? null
      const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)))
      if (next === undefined) return { committed: false, value: cur }
      writePath(path, next)
      return { committed: true, value: clean(next) }
    },
  }
}

export function isLocalMode() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('local') === '1') return true
  return import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_DATABASE_URL
}

let cached = null
export function getStore() {
  if (!cached) cached = isLocalMode() ? localStore() : firebaseStore()
  return cached
}

// 로컬 모드에서는 탭마다 다른 플레이어로 취급한다.
export function getLocalUid() {
  let id = sessionStorage.getItem('ethicsmystery.mysteryroom.localUid')
  if (!id) {
    id = 'local-' + Math.random().toString(36).slice(2, 10)
    sessionStorage.setItem('ethicsmystery.mysteryroom.localUid', id)
  }
  return id
}
