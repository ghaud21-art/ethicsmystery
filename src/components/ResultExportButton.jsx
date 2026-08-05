import { exportElementAsImage } from '../utils/html2canvasExport.js'

export default function ResultExportButton({ targetRef, filename }) {
  const handleClick = () => {
    if (targetRef.current) exportElementAsImage(targetRef.current, filename)
  }
  return <button onClick={handleClick}>결과 이미지로 저장</button>
}
