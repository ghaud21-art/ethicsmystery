import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../firebase/firebaseConfig'
import { verifySchoolCode as verifySchoolCodeCall } from '../firebase/functionsApi'

const AuthContext = createContext(null)

// 보안 규칙(firestore.rules, database.rules.json)의 관리자 판정과 반드시 같은 값을 써야 한다.
const ADMIN_EMAIL = 'ghaud21@gmail.com'

export function AuthProvider({ children }) {
  const [uid, setUid] = useState(null)
  const [tier, setTier] = useState('guest')
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
      setIsAdmin(user.email === ADMIN_EMAIL && user.emailVerified)
      await refreshTier(user)
      setReady(true)
    })
    return unsubscribe
  }, [refreshTier])

  const verifySchoolCode = useCallback(async (code) => {
    await verifySchoolCodeCall(code)
    // custom claim은 토큰을 강제 갱신해야 반영됨
    await auth.currentUser.getIdToken(true)
    await refreshTier(auth.currentUser)
  }, [refreshTier])

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, new GoogleAuthProvider())
  }, [])

  const signOutAdmin = useCallback(async () => {
    await signOut(auth) // onAuthStateChanged가 자동으로 다시 익명 로그인시킨다
  }, [])

  const value = { uid, tier, isAdmin, ready, error, verifySchoolCode, signInWithGoogle, signOutAdmin }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
