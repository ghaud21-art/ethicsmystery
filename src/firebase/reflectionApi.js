import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firestore } from './firebaseConfig'

// homeSchoolStudent 등급 전용. 서버(firestore.rules)가 실제 권한을 강제하므로
// 게스트가 호출해도 거부됨 — 이 함수는 UI 편의를 위한 클라이언트 측 진입점일 뿐.
export async function saveReflectionLog({ uid, studentName, studentId, scenarioId, roomCode, characterId, answers, resultSummary }) {
  const docRef = await addDoc(collection(firestore, 'reflectionLogs'), {
    uid,
    studentName,
    studentId,
    scenarioId,
    roomCode,
    characterId,
    answers,
    resultSummary,
    aiFeedback: null,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}
