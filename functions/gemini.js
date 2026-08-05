// Gemini 호출은 이 파일이 유일한 통로다 — 프론트엔드는 절대 API 키를 갖지 않고
// Cloud Functions(getAiFeedback)를 통해서만 결과를 받는다.
async function callOnce(model, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini(${model}) 호출 실패: ${res.status} ${body}`)
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

module.exports = { callGeminiWithFallback }
