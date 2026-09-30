import html2canvas from 'html2canvas'

// JPG로 저장한다 — 일부 학교 환경(태블릿 갤러리·과제 제출 시스템)이 PNG를
// 제대로 다루지 못해 확장자를 jpg로 통일. JPEG은 투명도가 없으므로 배경색 필수.
export async function exportElementAsImage(element, filename = 'ethicsmystery-result.jpg') {
  const canvas = await html2canvas(element, { backgroundColor: '#12141c', scale: 2 })
  const link = document.createElement('a')
  link.download = filename.replace(/\.(png|jpeg|jpg)$/i, '') + '.jpg'
  link.href = canvas.toDataURL('image/jpeg', 0.92)
  link.click()
}
