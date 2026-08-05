// 관리자가 올린 시나리오 설계 문서(PDF 등)를 Gemini로 해석해 이 앱의 시나리오 JSON
// 스키마에 맞는 구조로 변환한다. 결과는 그대로 저장되지 않고 관리자 페이지에서
// 검토/수정 후 저장된다.
const SCHEMA_INSTRUCTIONS = `당신은 한국 고등학교 "윤리와 사상/생활과 윤리" 수업용 온라인 딜레마 추리게임의 시나리오 설계 문서를 읽고,
아래 JSON 스키마에 정확히 맞는 시나리오 데이터를 생성하는 어시스턴트입니다.
문서에 있는 내용(인물, 단서, 대사, 엔딩 등)은 최대한 그대로 활용하고, 문서에 없는 세부 항목은 문맥에 맞게 합리적으로 채워 넣으세요.
반드시 아래 스키마를 따르는 순수 JSON 객체 하나만 출력하세요. 설명 텍스트나 마크다운 코드펜스는 포함하지 마세요.

스키마:
{
  "scenarioId": "영문 소문자와 언더스코어로 된 고유 슬러그 (예: envelope_incident_01)",
  "schemaVersion": "1.1",
  "unit": "이 시나리오가 다루는 윤리 주제 한 문장 (부제/단원 번호 없이 주제만)",
  "difficulty": "쉬움" | "보통" | "어려움",
  "meta": {
    "title": "시나리오 제목",
    "subtitle": "부제",
    "learningObjective": "학습 목표 한두 문장",
    "themes": ["관련 사상가/개념 태그", "..."],
    "supportedPlayerCounts": [문서에 명시된 인원수만, 예: [4] 또는 [3,4]],
    "estimatedMinutes": 예상 소요 분,
    "language": "ko"
  },
  "prologue": { "sharedText": "모든 플레이어에게 보이는 사건 개요 서술" },
  "narration": {
    "opening": [ { "speaker": "내레이션 또는 시스템 안내", "line": "..." } ],
    "phase1Intro": { "title": "...", "lines": [ { "speaker": "캐릭터 id", "line": "..." } ] },
    "phase2Intro": { "title": "...", "lines": [ { "speaker": "캐릭터 id", "line": "..." } ] }
  },
  "characters": [
    {
      "id": "영문 소문자 슬러그(캐릭터 이름 기반)",
      "role": "역할/직책",
      "name": "이름",
      "isCulprit": true 또는 false (정확히 한 명만 true),
      "personalityType": "성격 유형 슬러그",
      "personalityDescription": "성격 설명",
      "publicInfo": "공개 정보",
      "detailInfo": "상세 정보",
      "secretLayers": [
        { "layer": 1, "type": "표면 비밀 유형", "content": "표면 비밀 내용" },
        { "layer": 2, "type": "심층 비밀 유형", "content": "심층 비밀 내용" }
      ],
      "cooperationIncentive": "협력 유인",
      "competitionIncentive": "경쟁 유인",
      "ownedPhase2Clues": ["이 캐릭터 소유의 phase2 단서 id들"],
      "secretRevealClueId": "이 인물의 심층 비밀이 밝혀졌음을 나타내는 단서 id (있다면)",
      "epilogueCard": { "revealed": "비밀이 드러났을 때 개인 에필로그 문구", "hidden": "끝까지 안 드러났을 때 개인 에필로그 문구" },
      "adlibIntro": "자기소개 대사 (있다면)",
      "adlibLines": [ { "trigger": "상황 설명", "line": "대사" } ],
      "threePlayerVariant": { "included": true, "notes": "3인 플레이 시 참고사항 (해당 없으면 기본값 유지)" }
    }
  ],
  "clues": {
    "phase1": {
      "label": "현장 수색",
      "apPerPlayer": 인원 1명당 phase1 AP (보통 2),
      "apBonusFor3Players": 3인 플레이 시 추가 AP (해당 없으면 0),
      "items": [
        {
          "id": "p1_고유id",
          "title": "단서 제목",
          "location": "위치",
          "owner": null,
          "content": "단서 내용",
          "implication": "시사점",
          "apCost": 1,
          "isCriticalClue": true 또는 false (선택),
          "unlockType": "combo" (조합형 단서만, 그 외엔 생략),
          "requiresClueIds": ["선행 단서 id 2개"] (unlockType이 combo일 때만),
          "unlockNote": "조합 조건 설명 (combo일 때만)",
          "isRedHerring": true (함정 단서일 때만, 선택)
        }
      ]
    },
    "phase2": {
      "label": "심층 대질",
      "apPerPlayer": 2,
      "apBonusFor3Players": 0,
      "unlockCondition": "phase1_completed",
      "items": [
        { "id": "p2_고유id", "title": "...", "owner": "캐릭터 id 또는 null(공용/조합형)", "content": "...", "implication": "...", "apCost": 1 }
      ]
    }
  },
  "clueDesignNote": "설계 의도 요약 (AP 경제, 조합 단서 트레이드오프 등)",
  "resolutionPhase": {
    "steps": [
      { "id": "accusation", "prompt": "범인을 지목하세요.", "type": "single_select", "options": ["캐릭터 id들", "unknown"] },
      { "id": "moral_choice", "prompt": "당신은 게임 중 확보한 단서 중 하나를 끝까지 공개하지 않았다(혹은 모두 공개했다). 지금, 모두 앞에서 진실을 다 말할 것인가, 일부는 덮을 것인가?", "type": "single_select", "options": ["reveal_all", "conceal_some"] }
    ]
  },
  "endings": [
    {
      "id": "ending_고유id",
      "title": "엔딩 제목",
      "when": {
        "accused": "이 값과 정확히 일치하는 캐릭터가 지목됐을 때만 (선택)",
        "accusedIn": ["이 목록 중 하나가 지목됐을 때 (선택, accused와 동시 사용 금지)"],
        "cluesFound": ["이 단서들이 모두 확보되어 있어야 함 (선택)"],
        "cluesNotFound": ["이 단서들이 모두 확보되어 있지 않아야 함 (선택)"],
        "moralChoiceMajority": "reveal_all 또는 conceal_some (선택)",
        "fallback": true (정확히 하나의 엔딩에만 부여 — 지목이 일치하지 않거나 다른 조건이 매치되지 않을 때 쓰이는 기본 엔딩)
      },
      "message": "엔딩 서술",
      "insight": "성찰 포인트 한두 문장",
      "themeTag": "짧은 테마 태그"
    }
  ],
  "reflectionPrompts": ["성찰 질문 3~4개"]
}

규칙:
- endings 배열에는 반드시 when.fallback === true 인 엔딩이 정확히 하나 있어야 합니다.
- 같은 accused에 대해 여러 엔딩이 있다면(예: 단서 확보 여부로 갈리는 경우), 더 구체적인 조건(cluesFound/cluesNotFound/moralChoiceMajority가 있는 것)을 배열 앞쪽에, fallback을 배열 맨 뒤에 배치하세요.
- phase1과 phase2 각각, 기본 단서들의 apCost 합이 (apPerPlayer × 지원 인원수)와 대략 맞아야 전원이 분업해서 다 확인할 수 있습니다. 조합형(combo) 단서는 그 예산을 초과하는 보너스로 설계하세요(트레이드오프).
- characters[].id, clues 안의 owner, resolutionPhase의 options, endings[].when 안의 accused/accusedIn 값은 모두 characters[].id와 정확히 일치해야 합니다.
- JSON 외의 어떤 텍스트도 출력하지 마세요.`

async function callGeminiParse(fileBase64, mimeType, { apiKey, primaryModel, fallbackModel }) {
  const body = {
    contents: [
      {
        parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: SCHEMA_INSTRUCTIONS }],
      },
    ],
    generationConfig: { responseMimeType: 'application/json' },
  }

  async function callOnce(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
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
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error(`Gemini(${model}) 응답에 텍스트가 없습니다`)
    return text
  }

  let text
  try {
    text = await callOnce(primaryModel)
  } catch (primaryError) {
    console.warn(`primary model ${primaryModel} failed, falling back to ${fallbackModel}`, primaryError)
    text = await callOnce(fallbackModel)
  }

  // 코드펜스로 감싸져 오는 경우를 대비한 방어적 파싱.
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(cleaned)
}

module.exports = { callGeminiParse }
