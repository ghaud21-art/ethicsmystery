import { useEffect, useState } from 'react'
import { ref, onValue, set } from 'firebase/database'
import { db } from './firebaseConfig'

export function useSiteConfig() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    return onValue(ref(db, 'siteConfig'), (snap) => setConfig(snap.val() ?? {}))
  }, [])
  return config
}

// 관리자 전용 — database.rules.json이 실제 권한을 강제한다.
export async function setMainImage(dataUrl) {
  await set(ref(db, 'siteConfig/mainImageDataUrl'), dataUrl)
}
