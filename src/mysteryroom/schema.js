// room-2.0 룸 파일 검사. 관리자 업로드와 룸 불러오기에서 함께 쓴다.
// 형식 검사뿐 아니라 "선택지가 실제로 있는 장면을 가리키는가" 같은 연결 검사도 한다.
// 반환값은 사람이 읽을 수 있는 오류 문장 배열(비어 있으면 통과).
import { PUZZLE_MODULES } from './puzzles/evaluate.js'

export const ROOM_SCHEMA_VERSION = 'room-2.0'
export const MAX_PLAYERS = 5

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isArr = Array.isArray

export function validateRoom(room) {
  const errors = []
  const err = (m) => errors.push(m)
  if (!room || typeof room !== 'object') return ['JSON 객체가 아닙니다']

  if (room.schemaVersion !== ROOM_SCHEMA_VERSION) err(`schemaVersion은 '${ROOM_SCHEMA_VERSION}'이어야 합니다`)
  if (room.contentType !== 'mysteryroom') err("contentType은 'mysteryroom'이어야 합니다")
  if (!/^room_[a-z0-9_]+$/.test(room.scenarioId ?? '')) err('scenarioId는 room_으로 시작하는 영문 소문자·숫자·_ 조합이어야 합니다')

  const meta = room.meta ?? {}
  if (!isStr(meta.title)) err('meta.title이 필요합니다')
  if (!Number.isInteger(meta.estimatedMinutes) || meta.estimatedMinutes < 10 || meta.estimatedMinutes > 60) err('meta.estimatedMinutes는 10~60 사이 정수여야 합니다')
  if (!isArr(meta.supportedPlayerCounts) || !meta.supportedPlayerCounts.length || meta.supportedPlayerCounts.some((n) => !Number.isInteger(n) || n < 1 || n > MAX_PLAYERS)) {
    err(`meta.supportedPlayerCounts는 1~${MAX_PLAYERS} 사이 정수 배열이어야 합니다`)
  }

  // 역할
  const roles = isArr(room.roles) ? room.roles : []
  if (roles.length < 1 || roles.length > MAX_PLAYERS) err(`역할은 1~${MAX_PLAYERS}명이어야 합니다`)
  const roleIds = new Set()
  roles.forEach((r, i) => {
    if (!isStr(r.id) || !isStr(r.name) || !isStr(r.job) || !isStr(r.perspective)) err(`roles[${i}]에 id, name, job, perspective가 필요합니다`)
    if (roleIds.has(r.id)) err(`역할 id가 겹칩니다: ${r.id}`)
    roleIds.add(r.id)
  })
  const maxCount = Math.max(...(meta.supportedPlayerCounts ?? [0]))
  if (maxCount > roles.length) err(`최대 인원(${maxCount})이 역할 수(${roles.length})보다 많습니다`)
  for (const [count, v] of Object.entries(room.variants ?? {})) {
    for (const [from, to] of Object.entries(v.merge ?? {})) {
      if (!roleIds.has(from) || !roleIds.has(to)) err(`variants.${count}.merge에 없는 역할이 있습니다: ${from}→${to}`)
    }
  }
  const checkOwner = (owner, where) => {
    if (owner != null && !roleIds.has(owner)) err(`${where}: 없는 역할(owner) '${owner}'`)
  }

  // 개념
  const conceptKeys = new Set((room.concepts ?? []).map((c) => c.k))
  ;(room.concepts ?? []).forEach((c, i) => {
    if (!isStr(c.k) || !isStr(c.name)) err(`concepts[${i}]에 k, name이 필요합니다`)
  })

  // 자료
  const materials = room.materials ?? {}
  for (const [id, m] of Object.entries(materials)) {
    if (!isStr(m.title)) err(`materials.${id}에 title이 필요합니다`)
    checkOwner(m.owner, `materials.${id}`)
    if (m.kind === 'table' && (!isArr(m.columns) || !isArr(m.rows))) err(`materials.${id}: 표에는 columns와 rows가 필요합니다`)
  }

  // 방
  const rooms = isArr(room.rooms) ? room.rooms : []
  if (rooms.length !== 3) err('방(rooms)은 정확히 3개여야 합니다')

  // 장면
  const scenes = room.scenes ?? {}
  const sceneIds = new Set(Object.keys(scenes))
  if (!sceneIds.size) err('장면(scenes)이 없습니다')
  if (!sceneIds.has(room.start)) err(`시작 장면(start) '${room.start}'이 없습니다`)
  const ref = (to, where) => {
    if (!sceneIds.has(String(to))) err(`${where}: 없는 장면 '${to}'을(를) 가리킵니다`)
  }

  const puzzleClues = {}
  let hasTrue = false
  let hasBad = false
  let hasDebate = false
  let hasForm = false
  let hasTimeout = false

  for (const [id, s] of Object.entries(scenes)) {
    const where = `장면 ${id}`
    if (!isStr(s.title)) err(`${where}에 title이 필요합니다`)
    ;(s.body ?? []).forEach((b, i) => {
      if (typeof b === 'string') return
      if (b.material && !materials[b.material]) err(`${where} body[${i}]: 없는 자료 '${b.material}'`)
      for (const [rid, lens] of Object.entries(b.lens ?? {})) {
        checkOwner(rid, `${where} 렌즈`)
        if (!isStr(lens.text)) err(`${where} 렌즈(${rid})에 text가 필요합니다`)
        if (lens.concept && !conceptKeys.has(lens.concept)) err(`${where} 렌즈(${rid}): 없는 개념 '${lens.concept}'`)
      }
    })
    ;(s.choices ?? []).forEach((c, i) => ref(c.to, `${where} 선택지 ${i + 1}`))
    if (s.next) ref(s.next, `${where} next`)
    ;(s.gate ?? []).forEach((g, i) => ref(g.to, `${where} 관문 ${i + 1}`))
    ;(s.learn ?? []).forEach((k) => !conceptKeys.has(k) && err(`${where}: 없는 개념 '${k}'`))
    ;(s.requireShared ?? []).forEach((m) => !materials[m] && err(`${where} requireShared: 없는 자료 '${m}'`))
    if (s.type === 'debate') hasDebate = true
    if (s.type === 'form') {
      hasForm = true
      if (!s.next) err(`${where}: 최종 문 양식에는 next가 필요합니다`)
      if (!isArr(s.form?.fields) || !s.form.fields.length) err(`${where}: form.fields가 필요합니다`)
    }
    if (s.end) {
      if (!['true', 'good', 'bad', 'timeout'].includes(s.end.kind)) err(`${where}: end.kind는 true/good/bad/timeout 중 하나`)
      if (s.end.kind === 'true') hasTrue = true
      if (s.end.kind === 'bad') hasBad = true
      if (s.end.kind === 'timeout') hasTimeout = true
      if (s.end.retry) ref(s.end.retry, `${where} end.retry`)
    }
    const hasExit = s.end || s.next || s.gate?.length || s.choices?.length || s.puzzle || s.type === 'debate' || s.type === 'form'
    if (!hasExit) err(`${where}: 다음으로 갈 길(choices, next, gate, puzzle, end)이 없습니다`)

    if (s.puzzle) {
      const p = s.puzzle
      if (!PUZZLE_MODULES.includes(p.module)) err(`${where}: 알 수 없는 퍼즐 '${p.module}'`)
      ref(p.onSolve, `${where} onSolve`)
      if (p.clue) puzzleClues[p.clue] = (puzzleClues[p.clue] ?? 0) + 1
      ;(p.learn ?? []).forEach((k) => !conceptKeys.has(k) && err(`${where}: 없는 개념 '${k}'`))
      validatePuzzleConfig(p, where, err, checkOwner, materials)
    }
  }
  if (hasDebate && s0(scenes).every((s) => s.type !== 'debate' || !s.next)) err('토론 장면에는 next가 필요합니다')
  rooms.forEach((r) => {
    if (!isStr(r.id) || !isStr(r.name) || !isStr(r.clue)) err('각 방에 id, name, clue가 필요합니다')
    else if (puzzleClues[r.clue] !== 1) err(`방 '${r.name}'의 단서 ${r.clue}를 주는 퍼즐이 정확히 1개여야 합니다`)
  })
  if (!hasTrue) err('TRUE 엔딩(end.kind="true")이 1개 이상 필요합니다')
  if (!hasBad) err('BAD 엔딩(end.kind="bad")이 1개 이상 필요합니다')
  if (!hasTimeout) err('시간 초과 엔딩(end.kind="timeout")이 필요합니다')
  // 최종 문: 토론(type="debate" + debate 설정) 또는 양식(type="form") 가운데 하나가 있어야 한다.
  if (hasDebate && !room.debate) err('토론 장면이 있으면 debate 설정이 필요합니다')
  if (!isArr(room.reflection) || room.reflection.length !== 4) err('성찰 질문(reflection)은 정확히 4개여야 합니다')

  return errors
}

function s0(scenes) {
  return Object.values(scenes)
}

function validatePuzzleConfig(p, where, err, checkOwner, materials) {
  const c = p.config ?? {}
  const cards = (list, label) => (isArr(list) ? list : (err(`${where}: ${label}가 필요합니다`), [])).forEach((x) => checkOwner(x.owner, `${where} ${label} ${x.id}`))
  switch (p.module) {
    case 'classify': {
      const bins = new Set((c.bins ?? []).map((b) => b.id))
      cards(c.cards, 'cards')
      ;(c.cards ?? []).forEach((x) => !bins.has(x.bin) && err(`${where}: 카드 ${x.id}의 bin '${x.bin}'이 없습니다`))
      break
    }
    case 'scale':
      if (!isArr(c.options) || !c.answer) err(`${where}: options와 answer가 필요합니다`)
      cards(c.stakeholders, 'stakeholders')
      break
    case 'verify':
      if (c.mode === 'diagnose') {
        ;(c.tables ?? []).forEach((t) => !materials[t] && err(`${where}: 없는 표 자료 '${t}'`))
        if (!(c.cause?.correctId || c.cause?.correctIds?.length) || !c.remedy?.correctId) err(`${where}: cause(correctId 또는 correctIds), remedy의 correctId가 필요합니다`)
      } else {
        cards(c.docs, 'docs')
        if (!isArr(c.correctIds) || !Number.isInteger(c.pickCount)) err(`${where}: pickCount와 correctIds가 필요합니다`)
      }
      break
    case 'test': {
      cards(c.cards, 'cards')
      if (!c.principleChoices?.some((x) => x.id === c.correctPrincipleId)) err(`${where}: correctPrincipleId가 선택지에 없습니다`)
      break
    }
    case 'order': {
      const slots = new Set((c.slots ?? []).map((s) => s.id))
      cards(c.cards, 'cards')
      ;(c.cards ?? []).forEach((x) => x.slot && !slots.has(x.slot) && err(`${where}: 카드 ${x.id}의 slot '${x.slot}'이 없습니다`))
      break
    }
    case 'quiz':
      if (!isArr(c.questions) || !c.questions.length) err(`${where}: 퀴즈 questions가 필요합니다`)
      ;(c.questions ?? []).forEach((q, i) => {
        if (!isStr(q.id) || !isStr(q.q)) err(`${where}: 퀴즈 ${i + 1}번에 id와 q가 필요합니다`)
        if (q.options && !q.options.some((o) => o.id === q.answerId)) err(`${where}: 퀴즈 ${i + 1}번 answerId가 보기에 없습니다`)
        if (!q.options && !isArr(q.answer)) err(`${where}: 퀴즈 ${i + 1}번에 options+answerId 또는 answer 배열이 필요합니다`)
        if (q.clue) checkOwner(q.clue.owner, `${where} 퀴즈 ${i + 1}번 단서`)
      })
      break
    case 'idea':
      if (!isStr(c.prompt)) err(`${where}: 아이디어 미션 prompt가 필요합니다`)
      break
    case 'lock':
      if (c.answer == null) err(`${where}: 자물쇠 answer가 필요합니다`)
      ;(c.fragments ?? []).forEach((f, i) => checkOwner(f.owner, `${where} 조각 ${i + 1}`))
      ;(c.grid?.rows ?? []).forEach((r, i) => checkOwner(r.owner, `${where} 격자 ${i + 1}줄`))
      break
    default:
  }
}
