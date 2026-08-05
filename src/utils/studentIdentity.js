// 학교 코드 인증 시 입력한 이름/학번을 로컬에 남겨둔다. 새로고침해도 학교 인증
// custom claim(tier)은 토큰에 남아있지만 이름/학번은 메모리 상태라 사라지므로,
// 성찰 기록 저장(이름/학번 필요) 이전에 새로고침이 일어나도 잃지 않도록 보존한다.
const KEY = 'ethicsmystery.studentIdentity'

export function saveStudentIdentity({ name, studentId }) {
  localStorage.setItem(KEY, JSON.stringify({ name, studentId }))
}

export function getStudentIdentity() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}
