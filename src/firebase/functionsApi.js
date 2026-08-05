import { httpsCallable } from 'firebase/functions'
import { functions } from './firebaseConfig'

const verifySchoolCodeCallable = httpsCallable(functions, 'verifySchoolCode')
const getAiFeedbackCallable = httpsCallable(functions, 'getAiFeedback')
// 파싱 응답이 크고(전체 시나리오 JSON) Gemini 처리 시간도 걸릴 수 있어 타임아웃을 넉넉히 둔다.
const parseScenarioDocCallable = httpsCallable(functions, 'parseScenarioDoc', { timeout: 180000 })

export async function verifySchoolCode(code) {
  const result = await verifySchoolCodeCallable({ code })
  return result.data
}

export async function getAiFeedback({ reflectionLogId, prompt }) {
  const result = await getAiFeedbackCallable({ reflectionLogId, prompt })
  return result.data
}

export async function parseScenarioDoc({ fileBase64, mimeType }) {
  const result = await parseScenarioDocCallable({ fileBase64, mimeType })
  return result.data
}
