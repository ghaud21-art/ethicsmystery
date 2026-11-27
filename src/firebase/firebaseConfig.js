import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

// Firebase 웹 클라이언트 설정값은 비밀값이 아님(보안은 firestore.rules / database.rules.json이 담당).
// `firebase apps:sdkconfig web` 명령 결과로 아래 값을 교체하세요.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)
export const firestore = getFirestore(app)
export const functions = getFunctions(app)

// 로컬 개발 전용: VITE_USE_EMULATORS=1 이면 Firebase 에뮬레이터에 붙는다(배포 빌드에는 영향 없음).
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
}
