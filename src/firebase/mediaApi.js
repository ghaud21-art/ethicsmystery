import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { app } from './firebaseConfig'

// 시나리오 미디어(놓친 장면 영상·음성·이미지)는 Firebase Storage에 올리고,
// 시나리오 문서의 mediaUrls({파일명: 다운로드 URL})로 연결한다.
// 쓰기 권한은 storage.rules가 관리자 계정으로 강제한다.
const storage = getStorage(app)

const mediaRef = (scenarioId, fileName) => ref(storage, `scenario-media/${scenarioId}/${fileName}`)

export async function uploadScenarioMedia(scenarioId, fileName, file) {
  const r = mediaRef(scenarioId, fileName)
  await uploadBytes(r, file, file.type ? { contentType: file.type } : undefined)
  return getDownloadURL(r)
}

export async function deleteScenarioMedia(scenarioId, fileName) {
  try {
    await deleteObject(mediaRef(scenarioId, fileName))
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e // 이미 없는 파일은 조용히 넘어간다
  }
}
