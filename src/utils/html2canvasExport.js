import html2canvas from 'html2canvas'

export async function exportElementAsImage(element, filename = 'ethicsmystery-result.png') {
  const canvas = await html2canvas(element, { backgroundColor: '#12141c', scale: 2 })
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}
