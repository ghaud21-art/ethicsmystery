const { HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

// 학교 하나, 코드 하나만 필요한 v1 범위 — 학급/코드가 여러 개로 늘어나면
// Firestore의 schoolCodes/{code} 컬렉션으로 바꾸면 된다.
//
// name/studentId는 학생이 나중에 다른 기기/브라우저에서도 자기 결과를 찾을 수
// 있게 하기 위한 식별자다(익명 인증 uid는 기기마다 달라 재사용할 수 없음).
// 클라이언트 신뢰 입력이라 위조 가능하지만, 학교 코드까지 함께 아는 사람만
// 조회 가능하므로 교실 규모에서는 충분한 방어 수준이다.
async function verifySchoolCode(req, schoolCodeSecret) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (!req.data?.code || req.data.code !== schoolCodeSecret.value()) {
    throw new HttpsError('permission-denied', '학교 코드가 올바르지 않습니다')
  }
  const name = (req.data.name ?? '').trim()
  const studentId = (req.data.studentId ?? '').trim()
  if (!name || !studentId) {
    throw new HttpsError('invalid-argument', '이름과 학번을 입력해주세요')
  }
  const user = await admin.auth().getUser(req.auth.uid)
  await admin.auth().setCustomUserClaims(req.auth.uid, { ...user.customClaims, homeSchoolStudent: true })
  await admin.firestore().doc(`students/${req.auth.uid}`).set({ name, studentId, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  return { ok: true, name, studentId }
}

// 이름+학번(+학교 코드)만으로 이 학생의 과거 성찰 기록을 모두 찾아 돌려준다.
// 익명 인증 uid가 기기마다 달라져도, 이 세 값만 기억하면 어떤 기기에서든 조회할 수 있다.
async function getMyResults(req, schoolCodeSecret) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (!req.data?.code || req.data.code !== schoolCodeSecret.value()) {
    throw new HttpsError('permission-denied', '학교 코드가 올바르지 않습니다')
  }
  const name = (req.data.name ?? '').trim()
  const studentId = (req.data.studentId ?? '').trim()
  if (!name || !studentId) {
    throw new HttpsError('invalid-argument', '이름과 학번을 입력해주세요')
  }
  const snap = await admin
    .firestore()
    .collection('reflectionLogs')
    .where('studentName', '==', name)
    .where('studentId', '==', studentId)
    .get()
  const results = snap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toMillis?.() ?? null }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  return { results }
}

module.exports = { verifySchoolCode, getMyResults }
