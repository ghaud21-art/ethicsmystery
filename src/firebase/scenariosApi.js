import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { firestore } from './firebaseConfig'

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
  await setDoc(doc(scenariosCol(), scenario.scenarioId), scenario)
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
