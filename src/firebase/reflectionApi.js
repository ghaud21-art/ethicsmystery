import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore'
import { firestore } from './firebaseConfig'

// homeSchoolStudent 등급 전용. 서버(firestore.rules)가 실제 권한을 강제하므로
// 게스트가 호출해도 거부됨 — 이 함수는 UI 편의를 위한 클라이언트 측 진입점일 뿐.
export async function saveReflectionLog({ uid, studentName, studentId, scenarioId, roomCode, characterId, reflectionPrompts, answers, resultSummary }) {
  const docRef = await addDoc(collection(firestore, 'reflectionLogs'), {
    uid,
    studentName,
    studentId,
    scenarioId,
    roomCode,
    characterId,
    reflectionPrompts, // 나중에 시나리오가 수정돼도 그때 본 질문 그대로 남도록 답변과 함께 저장
    answers,
    resultSummary,
    aiFeedback: null,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

// 관리자 전용(firestore.rules) — 전체 성찰 기록을 학번순으로 조회한다.
export async function listAllReflectionLogs() {
  const snap = await getDocs(collection(firestore, 'reflectionLogs'))
  const logs = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toMillis?.() ?? null,
  }))
  logs.sort((a, b) => (a.studentId ?? '').localeCompare(b.studentId ?? '', 'ko'))
  return logs
}

export async function deleteReflectionLog(id) {
  await deleteDoc(doc(firestore, 'reflectionLogs', id))
}
