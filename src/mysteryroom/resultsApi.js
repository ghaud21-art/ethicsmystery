// 미스터리룸 결과 제출(학생 → 선생님). Firestore `mysteryRoomResults` 컬렉션.
// 학생은 자기 결과를 만들기만 하고, 읽기·삭제는 관리자만 한다(firestore.rules).
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseConfig'

const col = () => collection(firestore, 'mysteryRoomResults')

export async function submitMysteryResult(result) {
  const ref = await addDoc(col(), { ...result, createdAt: serverTimestamp() })
  return ref.id
}

export async function listMysteryResults(max = 1000) {
  const snap = await getDocs(query(col(), orderBy('createdAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toMillis?.() ?? null }))
}

export async function deleteMysteryResult(id) {
  await deleteDoc(doc(col(), id))
}

export async function deleteMysteryResults(ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(firestore)
    ids.slice(i, i + 400).forEach((id) => batch.delete(doc(col(), id)))
    await batch.commit()
  }
}
