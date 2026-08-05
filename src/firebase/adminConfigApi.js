import { doc, getDoc, setDoc } from 'firebase/firestore'
import { firestore } from './firebaseConfig'

const configRef = () => doc(firestore, 'config', 'secrets')

// 관리자 전용(firestore.rules) — Gemini API 키/모델명/학교 코드.
export async function getAdminConfig() {
  const snap = await getDoc(configRef())
  return snap.exists() ? snap.data() : {}
}

export async function saveAdminConfig(patch) {
  await setDoc(configRef(), patch, { merge: true })
}
