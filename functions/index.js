const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

const ADMIN_EMAIL = 'ghaud21@gmail.com'

const { getAdminConfig } = require('./adminConfig')
const { callGeminiWithFallback } = require('./gemini')
const { callGeminiParse } = require('./scenarioParser')
const { verifySchoolCode: verifySchoolCodeImpl, getMyResults: getMyResultsImpl } = require('./schoolCode')

function requireAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (req.auth.token.email !== ADMIN_EMAIL || !req.auth.token.email_verified) {
    throw new HttpsError('permission-denied', '관리자만 사용할 수 있습니다')
  }
}

exports.verifySchoolCode = onCall(async (req) => {
  const { schoolCode } = await getAdminConfig()
  return verifySchoolCodeImpl(req, schoolCode)
})

exports.getMyResults = onCall(async (req) => {
  const { schoolCode } = await getAdminConfig()
  return getMyResultsImpl(req, schoolCode)
})

// homeSchoolStudent 등급만 호출 가능 — guest는 custom claim이 없으므로 여기서 차단된다.
// firestore.rules에서도 동일 claim을 요구하므로 이중으로 강제됨.
exports.getAiFeedback = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (req.auth.token.homeSchoolStudent !== true) {
    throw new HttpsError('permission-denied', 'AI 피드백은 학교 인증 사용자만 이용할 수 있습니다')
  }
  const { reflectionLogId, prompt } = req.data ?? {}
  if (!prompt) throw new HttpsError('invalid-argument', 'prompt가 필요합니다')

  const { geminiApiKey, geminiModelPrimary, geminiModelFallback } = await getAdminConfig()
  if (!geminiApiKey) throw new HttpsError('failed-precondition', '관리자가 아직 Gemini API 키를 설정하지 않았습니다')

  const text = await callGeminiWithFallback(prompt, {
    apiKey: geminiApiKey,
    primaryModel: geminiModelPrimary,
    fallbackModel: geminiModelFallback,
  })

  if (reflectionLogId) {
    await admin.firestore().doc(`reflectionLogs/${reflectionLogId}`).update({ aiFeedback: text })
  }
  return { feedback: text }
})

// 관리자 전용 — 업로드된 시나리오 설계 문서(PDF)를 Gemini로 해석해 앱 스키마에
// 맞는 시나리오 JSON을 생성한다. 결과는 저장하지 않고 그대로 반환 — 실제 저장은
// 관리자 페이지에서 검토 후 클라이언트가 Firestore 보안 규칙을 통해 직접 수행한다.
exports.parseScenarioDoc = onCall({ timeoutSeconds: 180, memory: '512MiB' }, async (req) => {
  requireAdmin(req)
  const { fileBase64, mimeType } = req.data ?? {}
  if (!fileBase64 || !mimeType) throw new HttpsError('invalid-argument', 'fileBase64와 mimeType이 필요합니다')

  const { geminiApiKey, geminiModelPrimary, geminiModelFallback } = await getAdminConfig()
  if (!geminiApiKey) throw new HttpsError('failed-precondition', '관리자가 아직 Gemini API 키를 설정하지 않았습니다')

  try {
    const scenario = await callGeminiParse(fileBase64, mimeType, {
      apiKey: geminiApiKey,
      primaryModel: geminiModelPrimary,
      fallbackModel: geminiModelFallback,
    })
    return { scenario }
  } catch (e) {
    throw new HttpsError('internal', `문서 분석에 실패했습니다: ${e.message}`)
  }
})
