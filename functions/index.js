const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

const ADMIN_EMAIL = 'ghaud21@gmail.com'

const { getAdminConfig } = require('./adminConfig')
const { callGeminiJsonWithFallback } = require('./gemini')
const { callGeminiParse } = require('./scenarioParser')
const { verifySchoolCode: verifySchoolCodeImpl, getMyResults: getMyResultsImpl } = require('./schoolCode')
const { buildPrompt: buildAiFeedbackPrompt, normalizeFeedback } = require('./aiFeedback')
const { buildJudgePrompt, normalizeVerdict, buildGradePrompt, normalizeGrade } = require('./tanmun')

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
  const { reflectionLogId, nickname, scenarioTitle, endingTitle, endingMessage, qaPairs } = req.data ?? {}
  if (!nickname || !scenarioTitle || !endingTitle || !Array.isArray(qaPairs)) {
    throw new HttpsError('invalid-argument', 'nickname/scenarioTitle/endingTitle/qaPairs가 필요합니다')
  }

  const { geminiApiKey, geminiModelPrimary, geminiModelFallback } = await getAdminConfig()
  if (!geminiApiKey) throw new HttpsError('failed-precondition', '관리자가 아직 Gemini API 키를 설정하지 않았습니다')

  const prompt = buildAiFeedbackPrompt({ nickname, scenarioTitle, endingTitle, endingMessage, qaPairs })
  const parsed = await callGeminiJsonWithFallback(prompt, {
    apiKey: geminiApiKey,
    primaryModel: geminiModelPrimary,
    fallbackModel: geminiModelFallback,
  })
  const feedback = normalizeFeedback(parsed)

  if (reflectionLogId) {
    await admin.firestore().doc(`reflectionLogs/${reflectionLogId}`).update({ aiFeedback: feedback })
  }
  return { feedback }
})

// ---- 탐문 수사 (1인 예/아니오 문답 추리) ----
// AI 기록관은 학교 인증 사용자 전용이며, 시나리오별로 관리자가 aiEnabled를 꺼두면
// 서버에서도 호출이 거부된다. 진상(truth)은 시나리오 문서에서 서버가 직접 읽는다.
async function loadTanmunScenario(scenarioId) {
  if (!scenarioId) throw new HttpsError('invalid-argument', 'scenarioId가 필요합니다')
  const snap = await admin.firestore().doc(`scenarios/${scenarioId}`).get()
  if (!snap.exists) throw new HttpsError('not-found', '시나리오를 찾을 수 없습니다')
  const scenario = snap.data()
  if (scenario.contentType !== 'tanmun') throw new HttpsError('invalid-argument', '탐문 수사 시나리오가 아닙니다')
  if (scenario.aiEnabled === false) {
    throw new HttpsError('failed-precondition', '이 시나리오는 관리자가 AI 기록관을 꺼둔 상태입니다')
  }
  return scenario
}

// 시나리오가 게스트 플레이를 허용(guestAllowed)하면 익명 로그인만으로 충분하고,
// 아니면 학교 인증(homeSchoolStudent claim) 또는 관리자여야 한다 — 관리자 페이지의
// 체크박스로 시나리오별로 열고 닫을 수 있다.
function requireTanmunAccess(req, scenario) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  if (scenario.guestAllowed === true) return
  if (req.auth.token.homeSchoolStudent !== true && req.auth.token.email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', '이 시나리오는 학교 인증 사용자만 이용할 수 있습니다')
  }
}

exports.judgeTanmunQuestion = onCall(async (req) => {
  const { scenarioId, question } = req.data ?? {}
  if (!question || typeof question !== 'string' || question.length > 300) {
    throw new HttpsError('invalid-argument', '질문(300자 이내)이 필요합니다')
  }
  const scenario = await loadTanmunScenario(scenarioId)
  requireTanmunAccess(req, scenario)
  const { geminiApiKey, geminiModelPrimary, geminiModelFallback } = await getAdminConfig()
  if (!geminiApiKey) throw new HttpsError('failed-precondition', '관리자가 아직 Gemini API 키를 설정하지 않았습니다')

  const prompt = buildJudgePrompt({
    truth: scenario.truth,
    canonicalFacts: scenario.canonicalFacts,
    fewShots: scenario.fewShots,
    question,
  })
  let verdict
  try {
    const parsed = await callGeminiJsonWithFallback(prompt, {
      apiKey: geminiApiKey,
      primaryModel: geminiModelPrimary,
      fallbackModel: geminiModelFallback,
    })
    verdict = normalizeVerdict(parsed)
  } catch (e) {
    console.error('judgeTanmunQuestion failed', e)
    verdict = '그럴수도' // 설계 문서: 파싱 실패 시 "그럴수도" 폴백
  }
  return { verdict }
})

exports.gradeTanmunDeduction = onCall(async (req) => {
  const { scenarioId, deduction } = req.data ?? {}
  if (!deduction || typeof deduction !== 'string' || deduction.length > 2000) {
    throw new HttpsError('invalid-argument', '최종 추리 서술(2000자 이내)이 필요합니다')
  }
  const scenario = await loadTanmunScenario(scenarioId)
  requireTanmunAccess(req, scenario)
  const { geminiApiKey, geminiModelPrimary, geminiModelFallback } = await getAdminConfig()
  if (!geminiApiKey) throw new HttpsError('failed-precondition', '관리자가 아직 Gemini API 키를 설정하지 않았습니다')

  const prompt = buildGradePrompt({
    truth: scenario.truth,
    slots: scenario.slots,
    bonusRule: scenario.bonusRule,
    deduction,
  })
  try {
    const parsed = await callGeminiJsonWithFallback(prompt, {
      apiKey: geminiApiKey,
      primaryModel: geminiModelPrimary,
      fallbackModel: geminiModelFallback,
    })
    return normalizeGrade(parsed, (scenario.slots ?? []).length)
  } catch (e) {
    console.error('gradeTanmunDeduction failed', e)
    throw new HttpsError('internal', '채점에 실패했습니다 — 잠시 후 다시 시도해주세요')
  }
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
