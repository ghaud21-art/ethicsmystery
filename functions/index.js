const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret, defineString } = require('firebase-functions/params')
const admin = require('firebase-admin')

admin.initializeApp()

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const SCHOOL_CODE = defineSecret('SCHOOL_CODE')
// 사용자 요청: 우선 gemini-3.5-flash-lite로 시도하고, 실패 시 gemini-3.1-flash-lite로 폴백.
// 배포 후에도 코드 수정 없이 firebase functions:config 대신 params 값만 바꿔 재배포하면 모델을 교체할 수 있다.
const MODEL_PRIMARY = defineString('GEMINI_MODEL_PRIMARY', { default: 'gemini-3.5-flash-lite' })
const MODEL_FALLBACK = defineString('GEMINI_MODEL_FALLBACK', { default: 'gemini-3.1-flash-lite' })

const { callGeminiWithFallback } = require('./gemini')
const { verifySchoolCode: verifySchoolCodeImpl } = require('./schoolCode')

exports.verifySchoolCode = onCall({ secrets: [SCHOOL_CODE] }, (req) => verifySchoolCodeImpl(req, SCHOOL_CODE))

// homeSchoolStudent 등급만 호출 가능 — guest는 custom claim이 없으므로 여기서 차단된다.
// firestore.rules에서도 동일 claim을 요구하므로 이중으로 강제됨.
exports.getAiFeedback = onCall({ secrets: [GEMINI_API_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (req.auth.token.homeSchoolStudent !== true) {
    throw new HttpsError('permission-denied', 'AI 피드백은 학교 인증 사용자만 이용할 수 있습니다')
  }
  const { reflectionLogId, prompt } = req.data ?? {}
  if (!prompt) throw new HttpsError('invalid-argument', 'prompt가 필요합니다')

  const text = await callGeminiWithFallback(prompt, {
    apiKey: GEMINI_API_KEY.value(),
    primaryModel: MODEL_PRIMARY.value(),
    fallbackModel: MODEL_FALLBACK.value(),
  })

  if (reflectionLogId) {
    await admin.firestore().doc(`reflectionLogs/${reflectionLogId}`).update({ aiFeedback: text })
  }
  return { feedback: text }
})
