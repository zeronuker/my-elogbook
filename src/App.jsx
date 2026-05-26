import { useState, useEffect, useRef } from 'react'
import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithRedirect,
  reauthenticateWithCredential,
  deleteUser,
  sendEmailVerification
} from 'firebase/auth'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import ELogbook2026 from './elogbook_2026_v5_1'
import OnboardingFlow from './OnboardingFlow'
import LoadingOverlay from './LoadingOverlay'

function App() {
  const [user, setUser] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [signupError, setSignupError] = useState(null)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [authSuccess, setAuthSuccess] = useState(false)
  const prevUserRef = useRef(null)
  const onboardingDoneRef = useRef(false)

  // Handle Google redirect result on app load (signInWithRedirect flow)
  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      // Check for pending account deletion (reauthenticateWithRedirect flow)
      const pendingDeleteUid = sessionStorage.getItem('pendingAccountDelete')
      if (pendingDeleteUid) {
        sessionStorage.removeItem('pendingAccountDelete')
        const currentUser = result?.user || auth.currentUser
        if (currentUser) {
          try {
            await deleteUser(currentUser)
            await deleteDoc(doc(db, 'users', currentUser.uid, 'profile', 'data'))
            await deleteDoc(doc(db, 'users', currentUser.uid, 'logbook', 'data'))
            // Clear all localStorage data for this user
            const uid = currentUser.uid
            localStorage.removeItem(`elb_data_${uid}`)
            localStorage.removeItem(`elb_settings_${uid}`)
            localStorage.removeItem(`elb_last_local_save_${uid}`)
            localStorage.removeItem(`elb_last_sync_display_${uid}`)
          } catch (deleteError) {
            console.error('Account deletion after reauth failed:', deleteError)
          }
        }
        return
      }

      if (!result) return // No redirect in progress — normal load
      const googleUser = result.user

      const profileSnap = await getDoc(doc(db, 'users', googleUser.uid, 'profile', 'data'))
      if (!profileSnap.exists()) {
        // New user — create profile, stay on onboarding
        await setDoc(doc(db, 'users', googleUser.uid, 'profile', 'data'), {
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
        setUser(googleUser)
      } else {
        // Existing user — navigate to logbook
        const profileData = profileSnap.data()
        const isComplete = profileData.onboardingComplete || profileData.emailVerified
        setUser(googleUser)
        if (isComplete) {
          setAuthSuccess(true)
          setCountdown(3)
        }
      }
    }).catch((error) => {
      console.error('Redirect result error:', error)
    })
  }, [])

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

  // Safety timeout: if auth succeeded but showOnboarding didn't update after 3 sec, refresh
  useEffect(() => {
    if (!authSuccess || !user) return

    if (showOnboarding === false) {
      // Auth succeeded and user navigated to logbook, clear overlay
      setShowLoadingOverlay(false)
      setAuthSuccess(false)
      return
    }

    // Auth succeeded but still on onboarding — start countdown and force refresh
    setShowLoadingOverlay(true)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          console.warn('Safety timeout: forcing page refresh after auth success')
          window.location.reload()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [user, showOnboarding, authSuccess])

  // Check profile and set onboarding state (waits for profile before deciding)
  useEffect(() => {
    if (!user) {
      setShowOnboarding(true) // No user, show onboarding
      return
    }

    const checkProfile = async () => {
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'))

        // Don't override if user already explicitly completed onboarding
        if (onboardingDoneRef.current) return

        if (profileSnap.exists()) {
          const profileData = profileSnap.data()

          if (profileData.onboardingComplete === true || profileData.emailVerified === true) {
            setShowOnboarding(false)
          } else {
            setShowOnboarding(true)
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
        }
      } catch (err) {
        console.error('Error checking profile:', err)
        setShowOnboarding(true) // Fallback to onboarding on error
      }
    }

    checkProfile()
  }, [user])

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
      setAuthSuccess(true)
      setCountdown(3)
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

  // Google signup/login — uses redirect (no popup) for PWA/iOS/COOP compatibility
  const handleGoogleAuth = async () => {
    setIsSigningUp(true)
    setSignupError(null)
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider())
      // Page navigates away — execution stops here.
      // Result is handled by getRedirectResult() on the next load.
    } catch (error) {
      console.error('Google redirect error:', error)
      setSignupError('Google sign-in failed. Please try again.')
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
            // Map organization from signup to airline for Settings compatibility
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
      // Block any in-flight profile checks from overriding navigation
      onboardingDoneRef.current = true
      setShowOnboarding(false)
    }
  }

  // Clear all localStorage data for a given uid
  const clearLocalStorage = (uid) => {
    localStorage.removeItem(`elb_data_${uid}`)
    localStorage.removeItem(`elb_settings_${uid}`)
    localStorage.removeItem(`elb_last_local_save_${uid}`)
    localStorage.removeItem(`elb_last_sync_display_${uid}`)
  }

  // Delete account and all data (client-side, no Cloud Function required)
  // Returns 'redirecting' if a Google re-auth redirect was initiated.
  const handleDeleteAccount = async () => {
    if (!user) return
    const uid = user.uid
    try {
      // Delete auth user first — if this fails, data is still intact
      await deleteUser(user)
      await deleteDoc(doc(db, 'users', uid, 'profile', 'data'))
      await deleteDoc(doc(db, 'users', uid, 'logbook', 'data'))
      clearLocalStorage(uid)
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        const providerId = user.providerData[0]?.providerId
        if (providerId === 'google.com') {
          try {
            // Store flag so the redirect-return handler completes the deletion
            sessionStorage.setItem('pendingAccountDelete', uid)
            await reauthenticateWithRedirect(user, new GoogleAuthProvider())
            // Page navigates away here — execution stops.
            // Deletion is completed by getRedirectResult() on return.
            return 'redirecting'
          } catch (reAuthError) {
            sessionStorage.removeItem('pendingAccountDelete')
            console.error('Re-authentication failed:', reAuthError)
            throw new Error(reAuthError.message || 'Re-authentication failed. Please try again.')
          }
        } else {
          // Signal to the UI that a password prompt is needed
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
        {showLoadingOverlay && <LoadingOverlay countdown={countdown} />}
      </>
    )
  }

  return (
    <>
      <ELogbook2026
        onLogout={() => signOut(auth)}
        onDeleteAccount={handleDeleteAccount}
        onReauthAndDelete={handleReauthAndDelete}
        userProvider={user?.providerData[0]?.providerId || 'password'}
      />
      {showLoadingOverlay && <LoadingOverlay countdown={countdown} />}
    </>
  )
}

export default App
