// 룸 파일 불러오기. 실제 서비스는 Firestore(scenarios 컬렉션, 관리자 업로드)에서 읽는다.
// 로컬(개발) 모드에서는 public/scenarios/<id>.json 견본 파일을 읽는다.
import { loadScenario } from '../engine/scenarioLoader'
import { isLocalMode, isTestMode } from './store'
import { validateRoom } from './schema'
import { decodeNested } from './firestoreCodec'

export const LOCAL_SAMPLE_ROOMS = ['room_ai_career_01']

const cache = new Map()

async function fetchSample(id) {
  const res = await fetch(`${import.meta.env.BASE_URL}scenarios/${id}.json`)
  if (!res.ok) throw new Error(`견본 룸을 찾을 수 없습니다: ${id}`)
  return res.json()
}

export async function loadMysteryRoom(scenarioId) {
  if (cache.has(scenarioId)) return cache.get(scenarioId)
  // 테스트 플레이는 관리자가 올린 룸(Firestore)을, 개발용 로컬 모드는 견본 파일을 쓴다.
  const room = isLocalMode() && !isTestMode() ? await fetchSample(scenarioId) : decodeNested(await loadScenario(scenarioId))
  const errors = validateRoom(room)
  if (errors.length) {
    console.error(`[미스터리룸] ${scenarioId} 검사 실패`, errors)
    throw new Error(`룸 파일 검사에 실패했습니다 (${errors.length}건). 관리자에게 알려 주세요.`)
  }
  cache.set(scenarioId, room)
  return room
}

// 로컬 모드의 목록 화면용 견본 목록 (loadRegistry와 같은 모양)
export async function loadLocalRegistry() {
  const rooms = await Promise.all(LOCAL_SAMPLE_ROOMS.map((id) => fetchSample(id).catch(() => null)))
  return rooms.filter(Boolean).map((s) => ({
    scenarioId: s.scenarioId,
    contentType: 'mysteryroom',
    title: s.meta?.title,
    unit: s.unit,
    themes: s.meta?.themes,
    supportedPlayerCounts: s.meta?.supportedPlayerCounts,
    estimatedMinutes: s.meta?.estimatedMinutes,
    difficulty: s.difficulty,
    published: true,
    thumbnailDataUrl: null,
  }))
}
