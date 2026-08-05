const { HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

// 관리자 한 명(교사) 기준 v1 범위 — 코드 하나로 admin custom claim을 부여한다.
async function verifyAdminCode(req, adminCodeSecret) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (!req.data?.code || req.data.code !== adminCodeSecret.value()) {
    throw new HttpsError('permission-denied', '관리자 코드가 올바르지 않습니다')
  }
  const user = await admin.auth().getUser(req.auth.uid)
  await admin.auth().setCustomUserClaims(req.auth.uid, { ...user.customClaims, admin: true })
  return { ok: true }
}

module.exports = { verifyAdminCode }
