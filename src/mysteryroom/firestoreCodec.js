// Firestore는 배열 안에 배열을 바로 저장할 수 없다(예: 표 자료의 rows: [["a","b"], ...]).
// 룸 파일은 쓰기 편한 모양 그대로 두고, Firestore에 저장할 때만 안쪽 배열을
// { __nested: [...] } 로 감싸고, 불러올 때 다시 풀어 준다.
const KEY = '__nested'

export function encodeNested(value, insideArray = false) {
  if (Array.isArray(value)) {
    const arr = value.map((v) => encodeNested(v, true))
    return insideArray ? { [KEY]: arr } : arr
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeNested(v, false)]))
  }
  return value
}

export function decodeNested(value) {
  if (Array.isArray(value)) return value.map(decodeNested)
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 1 && keys[0] === KEY && Array.isArray(value[KEY])) return decodeNested(value[KEY])
    return Object.fromEntries(keys.map((k) => [k, decodeNested(value[k])]))
  }
  return value
}
