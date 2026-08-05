const admin = require('firebase-admin')

const DEFAULTS = {
  geminiApiKey: null,
  geminiModelPrimary: 'gemini-3.5-flash-lite',
  geminiModelFallback: 'gemini-3.1-flash-lite',
  schoolCode: null,
}

// Gemini API 키/학교 코드는 Secret Manager(firebase functions:secrets:set) 대신
// 관리자 페이지에서 직접 바꿀 수 있도록 Firestore config/secrets 문서에 둔다.
// 이 컬렉션은 firestore.rules에서 관리자 이메일만 읽고 쓸 수 있고, 여기서는
// Admin SDK로 규칙을 우회해 서버에서만 읽는다.
//
// 웜 인스턴스에서 매 호출마다 Firestore를 왕복하지 않도록 짧게 캐시한다 —
// 관리자가 값을 바꾼 직후 최대 1분 정도는 이전 값이 쓰일 수 있음을 감수한 트레이드오프.
let cache = null
let cachedAt = 0
const CACHE_MS = 60_000

async function getAdminConfig() {
  const now = Date.now()
  if (cache && now - cachedAt < CACHE_MS) return cache
  const snap = await admin.firestore().doc('config/secrets').get()
  cache = { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) }
  cachedAt = now
  return cache
}

module.exports = { getAdminConfig }
