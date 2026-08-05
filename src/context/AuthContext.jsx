import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../firebase/firebaseConfig'
import { verifySchoolCode as verifySchoolCodeCall } from '../firebase/functionsApi'
import { getStudentIdentity, saveStudentIdentity } from '../utils/studentIdentity'

const AuthContext = createContext(null)

// 보안 규칙(firestore.rules, database.rules.json)의 관리자 판정과 반드시 같은 값을 써야 한다.
const ADMIN_EMAIL = 'ghaud21@gmail.com'

export function AuthProvider({ children }) {
  const [uid, setUid] = useState(null)
  const [email, setEmail] = useState(null)
  const [tier, setTier] = useState('guest')
  const [studentIdentity, setStudentIdentity] = useState(() => getStudentIdentity()) // { name, studentId } — 학교 코드 인증 시 설정
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const refreshTier = useCallback(async (user) => {
    if (!user) {
      setTier('guest')
      return
    }
    const tokenResult = await user.getIdTokenResult()
    setTier(tokenResult.claims.homeSchoolStudent ? 'homeSchoolStudent' : 'guest')
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth)
        } catch (e) {
          setError(e)
          setReady(true)
        }
        return
      }
      setUid(user.uid)
      setEmail(user.email ?? null) // 익명 로그인이면 null — 실제 Google 로그인 시도 여부 판단에 사용
      setIsAdmin(user.email === ADMIN_EMAIL && user.emailVerified)
      await refreshTier(user)
      setReady(true)
    })
    return unsubscribe
  }, [refreshTier])

  const verifySchoolCode = useCallback(async (code, name, studentId) => {
    await verifySchoolCodeCall(code, name, studentId)
    // custom claim은 토큰을 강제 갱신해야 반영됨
    await auth.currentUser.getIdToken(true)
    await refreshTier(auth.currentUser)
    const identity = { name: name.trim(), studentId: studentId.trim() }
    setStudentIdentity(identity)
    saveStudentIdentity(identity)
  }, [refreshTier])

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, new GoogleAuthProvider())
  }, [])

  const signOutAdmin = useCallback(async () => {
    await signOut(auth) // onAuthStateChanged가 자동으로 다시 익명 로그인시킨다
  }, [])

  const value = { uid, email, tier, isAdmin, ready, error, studentIdentity, verifySchoolCode, signInWithGoogle, signOutAdmin }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
