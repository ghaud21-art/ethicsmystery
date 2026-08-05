const { HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

// 학교 하나, 코드 하나만 필요한 v1 범위 — 학급/코드가 여러 개로 늘어나면
// Firestore의 schoolCodes/{code} 컬렉션으로 바꾸면 된다.
async function verifySchoolCode(req, schoolCodeSecret) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (!req.data?.code || req.data.code !== schoolCodeSecret.value()) {
    throw new HttpsError('permission-denied', '학교 코드가 올바르지 않습니다')
  }
  const user = await admin.auth().getUser(req.auth.uid)
  await admin.auth().setCustomUserClaims(req.auth.uid, { ...user.customClaims, homeSchoolStudent: true })
  return { ok: true }
}

module.exports = { verifySchoolCode }
