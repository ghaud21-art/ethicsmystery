import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { firestore } from './firebaseConfig'
import { encodeNested } from '../mysteryroom/firestoreCodec'

const scenariosCol = () => collection(firestore, 'scenarios')

// 발행 여부와 무관하게 전부 반환한다 — 미발행 시나리오도 목록/소개는 보여야 하고
// (플레이만 막힘), 관리자 페이지에서도 전체 목록이 필요하기 때문.
export async function listScenarios() {
  const snap = await getDocs(scenariosCol())
  return snap.docs.map((d) => d.data())
}

export async function getScenario(scenarioId) {
  const snap = await getDoc(doc(scenariosCol(), scenarioId))
  return snap.exists() ? snap.data() : null
}

// 관리자 전용 — Firestore 보안 규칙이 실제 권한을 강제한다.
export async function saveScenario(scenario) {
  // 미스터리룸 파일에는 표처럼 배열 안의 배열이 있어 Firestore 저장용으로 감싼다.
  const data = scenario.contentType === 'mysteryroom' ? encodeNested(scenario) : scenario
  await setDoc(doc(scenariosCol(), scenario.scenarioId), data)
}

export async function setScenarioPublished(scenarioId, published) {
  await updateDoc(doc(scenariosCol(), scenarioId), { published })
}

export async function setScenarioThumbnail(scenarioId, thumbnailDataUrl) {
  await updateDoc(doc(scenariosCol(), scenarioId), { thumbnailDataUrl })
}

export async function deleteScenario(scenarioId) {
  await deleteDoc(doc(scenariosCol(), scenarioId))
}

// 관리자 전용 — 일부 필드만 바꾼다(예: 미스터리룸 AI 피드백 켜기/끄기).
export async function updateScenarioFields(scenarioId, patch) {
  await updateDoc(doc(scenariosCol(), scenarioId), patch)
}
