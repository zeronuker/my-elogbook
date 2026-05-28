import { useState, useEffect, useRef } from 'react'
import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  deleteUser,
  sendEmailVerification
} from 'firebase/auth'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import ELogbook2026 from './elogbook_2026_v5_1'
import OnboardingFlow from './OnboardingFlow'
import LoadingOverlay from './LoadingOverlay'

// Session key used to prevent infinite reload loops from the auto-recovery safety net
const AUTH_RECOVERY_KEY = 'elb_auth_recovery_attempted'

function App() {
  const [user, setUser] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [signupError, setSignupError] = useState(null)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const prevUserRef = useRef(null)
  const onboardingDoneRef = useRef(false)
  const prevIsSigningUpRef = useRef(false)

  // Shared helper: create the Firestore profile doc for a Google user if missing.
  // Used by both popup (handleGoogleAuth) and redirect (getRedirectResult) flows.
  const ensureGoogleProfile = async (googleUser) => {
    const profileRef = doc(db, 'users', googleUser.uid, 'profile', 'data')
    const profileSnap = await getDoc(profileRef)
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        email: googleUser.email,
        fullName: googleUser.displayName || '',
        staffId: '',
        licenceNumber: '',
        licenceType: 'ATPL(A)',
        organization: '',
        onboardingComplete: false,
        emailVerified: true,
        createdAt: new Date().toISOString()
      })
    }
  }

  // Clear all localStorage data for a given uid
  const clearLocalStorage = (uid) => {
    localStorage.removeItem(`elb_data_${uid}`)
    localStorage.removeItem(`elb_settings_${uid}`)
    localStorage.removeItem(`elb_last_local_save_${uid}`)
    localStorage.removeItem(`elb_last_sync_display_${uid}`)
  }

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Detect logout: user was authenticated, now is null
      if (prevUserRef.current && !currentUser) {
        setShowLogoutConfirm(true)
      }

      prevUserRef.current = currentUser
      setUser(currentUser)
      setAuthLoading(false)
    })

    return unsubscribe
  }, [])

  // Check profile and set onboarding state
  useEffect(() => {
    if (!user) {
      setShowOnboarding(true)
      return
    }

    const checkProfile = async () => {
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'))

        // Don't override if getRedirectResult or onboarding already made a decision
        if (onboardingDoneRef.current) return

        if (profileSnap.exists()) {
          const profileData = profileSnap.data()

          const isComplete = profileData.onboardingComplete === true || profileData.emailVerified === true
          const isGoogleUser = user?.providerData?.[0]?.providerId === 'google.com'
          if (isComplete || isGoogleUser) {
            // Google users are inherently verified — let them in even if profile flags are stale
            if (isGoogleUser && !isComplete) {
              // Auto-fix stale profile flags
              setDoc(doc(db, 'users', user.uid, 'profile', 'data'), { onboardingComplete: true, emailVerified: true }, { merge: true })
                .catch(err => console.error('Profile flag update failed:', err))
            }
            setShowOnboarding(false)
            setShowLoadingOverlay(false)
          } else {
            setShowOnboarding(true)
            setShowLoadingOverlay(false)
          }

          // Auto-complete onboarding for old verified users
          if (profileData.emailVerified && !profileData.onboardingComplete) {
            await setDoc(
              doc(db, 'users', user.uid, 'profile', 'data'),
              { onboardingComplete: true },
              { merge: true }
            )
          }
        } else {
          setShowOnboarding(true)
          setShowLoadingOverlay(false)
        }
      } catch (err) {
        console.error('Error checking profile:', err)
        // If Firestore fails for an authenticated Google user, let them in rather
        // than stranding them on the landing page
        const isGoogle = user?.providerData?.[0]?.providerId === 'google.com'
        if (isGoogle) {
          setShowOnboarding(false)
        } else {
          setShowOnboarding(true)
        }
        setShowLoadingOverlay(false)
      }
    }

    checkProfile()
  }, [user])

  // ── Auto-recovery safety net ───────────────────────────────────────────
  // Detects rare stuck states where Firebase auth succeeded but the React UI
  // is still showing the login screen (caused by browser extensions interfering
  // with the popup handshake, transient COOP issues, etc.). One-shot per session
  // to avoid reload loops.
  //
  // Trigger 1: a sign-in attempt just finished (isSigningUp true → false)
  // but the UI is still on login, and Firebase says we're authenticated.
  useEffect(() => {
    const wasSigningUp = prevIsSigningUpRef.current
    prevIsSigningUpRef.current = isSigningUp
    if (!wasSigningUp || isSigningUp) return

    // Give state updates a moment to settle, then check for stuck state
    const timer = setTimeout(() => {
      const stillStuck =
        (showOnboarding || showLogoutConfirm) &&
        auth.currentUser &&
        !isSigningUp
      if (stillStuck && !sessionStorage.getItem(AUTH_RECOVERY_KEY)) {
        sessionStorage.setItem(AUTH_RECOVERY_KEY, '1')
        console.warn('Auth completed but UI stuck on login screen — reloading to recover')
        window.location.reload()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [isSigningUp, showOnboarding, showLogoutConfirm])

  // Trigger 2: a sign-in attempt is hanging (popup never resolved). After 20s,
  // give up. If Firebase actually authenticated in the background, reload to
  // pick up the session; otherwise show an actionable error.
  useEffect(() => {
    if (!isSigningUp) return
    const timer = setTimeout(() => {
      if (!isSigningUp) return // already finished
      console.warn('Sign-in attempt timed out after 20s')
      setIsSigningUp(false)
      if (auth.currentUser && !sessionStorage.getItem(AUTH_RECOVERY_KEY)) {
        sessionStorage.setItem(AUTH_RECOVERY_KEY, '1')
        window.location.reload()
      } else if (!auth.currentUser) {
        setSignupError('Sign-in timed out. If you use ad blockers or popup blockers, try disabling them on this site, or sign in with email/password instead.')
      }
    }, 20000)
    return () => clearTimeout(timer)
  }, [isSigningUp])

  // Clear the one-shot recovery flag once the user is successfully in the app
  useEffect(() => {
    if (!showOnboarding && !showLogoutConfirm && user) {
      sessionStorage.removeItem(AUTH_RECOVERY_KEY)
    }
  }, [showOnboarding, showLogoutConfirm, user])

  // Signup with email/password
  const handleSignup = async (email, password, fullName) => {
    setIsSigningUp(true)
    setSignupError(null)

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const newUser = userCredential.user

      await setDoc(doc(db, 'users', newUser.uid, 'profile', 'data'), {
        email,
        fullName: fullName || '',
        staffId: '',
        licenceNumber: '',
        licenceType: 'ATPL(A)',
        organization: '',
        onboardingComplete: false,
        emailVerified: false,
        createdAt: new Date().toISOString()
      })

      try {
        await sendEmailVerification(newUser)
      } catch (emailError) {
        console.error('Email verification error:', emailError)
      }

      setIsSigningUp(false)
      return { success: true }
    } catch (error) {
      let errorMsg = 'Signup failed. Please try again.'

      if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'Email already in use. Try logging in instead.'
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'Password is too weak.'
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address.'
      }

      setSignupError(errorMsg)
      setIsSigningUp(false)
      return { success: false, error: errorMsg }
    }
  }

  // Login with email/password
  const handleLogin = async (email, password) => {
    setIsSigningUp(true)
    setSignupError(null)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      setShowLoadingOverlay(true) // Overlay while profile check runs
      setIsSigningUp(false)
      return { success: true }
    } catch (error) {
      let errorMsg = 'Login failed. Check your email and password.'

      if (error.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email.'
      } else if (error.code === 'auth/wrong-password') {
        errorMsg = 'Incorrect password.'
      }

      setSignupError(errorMsg)
      setIsSigningUp(false)
      return { success: false, error: errorMsg }
    }
  }

  // Google signup/login — popup-based.
  // Note: on installed PWAs (iPad / Android), popup auth has known issues with
  // browser-context isolation. The auto-recovery effects below and a planned
  // Google Identity Services integration are the path forward there.
  const handleGoogleAuth = async () => {
    setIsSigningUp(true)
    setSignupError(null)
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      const googleUser = result.user
      await ensureGoogleProfile(googleUser)
      onboardingDoneRef.current = true
      setShowOnboarding(false)
      setShowLoadingOverlay(true)
      setTimeout(() => setShowLoadingOverlay(false), 1500)
      setIsSigningUp(false)
    } catch (error) {
      // Silently ignore user-cancelled popup
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        setIsSigningUp(false)
        return
      }

      // Provide actionable messages for common failure modes (ad blockers, popup blockers, etc.)
      let errorMsg = 'Google sign-in failed. Please try again.'
      if (error.code === 'auth/popup-blocked') {
        errorMsg = 'Popup was blocked. Please allow popups for this site, or sign in with email/password instead.'
      } else if (
        error.code === 'auth/network-request-failed' ||
        (typeof error.message === 'string' && error.message.toLowerCase().includes('network'))
      ) {
        errorMsg = 'Sign-in blocked by network. This is often caused by ad blockers — try disabling them on this site, or use email/password sign-in instead.'
      } else if (error.code === 'auth/internal-error') {
        errorMsg = 'Sign-in failed. If you use ad blockers or popup blockers, try disabling them on this site, or sign in with email/password.'
      }

      console.error('Google auth error:', error)
      setSignupError(errorMsg)
      setIsSigningUp(false)
    }
  }

  const handleOnboardingComplete = async (profileData = {}) => {
    try {
      if (user) {
        await setDoc(
          doc(db, 'users', user.uid, 'profile', 'data'),
          {
            ...profileData,
            airline: profileData.organization || profileData.airline || '',
            onboardingComplete: true,
            emailVerified: true
          },
          { merge: true }
        )
      }
    } catch (err) {
      console.error('Error completing onboarding:', err)
    } finally {
      onboardingDoneRef.current = true
      setShowOnboarding(false)
    }
  }

  // Delete account and all data (client-side, no Cloud Function required).
  const handleDeleteAccount = async () => {
    if (!user) return
    const uid = user.uid
    try {
      await deleteUser(user)
      await deleteDoc(doc(db, 'users', uid, 'profile', 'data'))
      await deleteDoc(doc(db, 'users', uid, 'logbook', 'data'))
      clearLocalStorage(uid)
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        const providerId = user.providerData[0]?.providerId
        if (providerId === 'google.com') {
          try {
            await reauthenticateWithPopup(user, new GoogleAuthProvider())
            await deleteUser(user)
            await deleteDoc(doc(db, 'users', uid, 'profile', 'data'))
            await deleteDoc(doc(db, 'users', uid, 'logbook', 'data'))
            clearLocalStorage(uid)
          } catch (reAuthError) {
            console.error('Re-authentication failed:', reAuthError)
            throw new Error(reAuthError.message || 'Re-authentication failed. Please try again.')
          }
        } else {
          throw Object.assign(new Error('requires-recent-login'), { code: 'auth/requires-recent-login' })
        }
      } else {
        console.error('Account deletion failed:', error)
        throw error
      }
    }
  }

  // Re-authenticate email/password user then delete — called from SettingsModal password prompt
  const handleReauthAndDelete = async (password) => {
    if (!user) return
    const uid = user.uid
    const credential = EmailAuthProvider.credential(user.email, password)
    await reauthenticateWithCredential(user, credential)
    await deleteUser(user)
    await deleteDoc(doc(db, 'users', uid, 'profile', 'data'))
    await deleteDoc(doc(db, 'users', uid, 'logbook', 'data'))
    clearLocalStorage(uid)
  }

  if (authLoading) {
    return <div style={{ background: '#0a0d12', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Courier New' }}>Loading...</div>
  }

  if (showOnboarding || showLogoutConfirm) {
    return (
      <>
        <OnboardingFlow
          user={user}
          onSignup={handleSignup}
          onLogin={handleLogin}
          onGoogleAuth={handleGoogleAuth}
          onOnboardingComplete={handleOnboardingComplete}
          signupError={signupError}
          isLoading={isSigningUp}
          showLogoutConfirm={showLogoutConfirm}
          onClearError={() => setSignupError(null)}
        />
        {showLoadingOverlay && <LoadingOverlay />}
      </>
    )
  }

  return (
    <>
      <ELogbook2026
        user={user}
        onLogout={() => signOut(auth)}
        onDeleteAccount={handleDeleteAccount}
        onReauthAndDelete={handleReauthAndDelete}
        userProvider={user?.providerData[0]?.providerId || 'password'}
      />
      {showLoadingOverlay && <LoadingOverlay />}
    </>
  )
}

export default App
