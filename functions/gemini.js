// Gemini 호출은 이 파일이 유일한 통로다 — 프론트엔드는 절대 API 키를 갖지 않고
// Cloud Functions(getAiFeedback)를 통해서만 결과를 받는다.
async function callOnce(model, prompt, apiKey, generationConfig) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = { contents: [{ parts: [{ text: prompt }] }] }
  if (generationConfig) body.generationConfig = generationConfig
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Gemini(${model}) 호출 실패: ${res.status} ${errBody}`)
  }
  const json = await res.json()
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// primary 모델이 실패(중단/미지원 등)하면 fallback 모델로 한 번 더 시도한다.
// 사용자가 gemini-2.5-flash-lite -> gemini-2.0-flash-lite 순으로 쓰길 원한다면
// GEMINI_MODEL_PRIMARY / GEMINI_MODEL_FALLBACK 파라미터로 배포 시점에 지정하면 된다.
async function callGeminiWithFallback(prompt, { apiKey, primaryModel, fallbackModel }) {
  try {
    return await callOnce(primaryModel, prompt, apiKey)
  } catch (primaryError) {
    console.warn(`primary model ${primaryModel} failed, falling back to ${fallbackModel}`, primaryError)
    try {
      return await callOnce(fallbackModel, prompt, apiKey)
    } catch (fallbackError) {
      console.error(`fallback model ${fallbackModel} also failed`, fallbackError)
      throw fallbackError
    }
  }
}

// AI 피드백은 자유 텍스트로 받으면 모델이 소제목/톤 지시를 지키지 않을 때가 있어
// (예: 캐릭터 이름을 학생 지칭에 섞어 씀, 편지투로 씀), JSON 스키마로 강제해서
// 서버가 최종 문구 구조를 직접 조립한다 — 형식은 모델 순응도에 기대지 않는다.
async function callGeminiJsonWithFallback(prompt, { apiKey, primaryModel, fallbackModel }) {
  const generationConfig = { responseMimeType: 'application/json' }
  let text
  try {
    text = await callOnce(primaryModel, prompt, apiKey, generationConfig)
  } catch (primaryError) {
    console.warn(`primary model ${primaryModel} failed, falling back to ${fallbackModel}`, primaryError)
    text = await callOnce(fallbackModel, prompt, apiKey, generationConfig)
  }
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(cleaned)
}

module.exports = { callGeminiWithFallback, callGeminiJsonWithFallback }
