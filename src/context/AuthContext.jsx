import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from '../firebase/firebaseConfig'
import { verifySchoolCode as verifySchoolCodeCall } from '../firebase/functionsApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [uid, setUid] = useState(null)
  const [tier, setTier] = useState('guest')
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

  const value = { uid, tier, ready, error, verifySchoolCode }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
