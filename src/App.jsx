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

  // Google signup/login — popup-based for reliable cross-browser auth
  const handleGoogleAuth = async () => {
    setIsSigningUp(true)
    setSignupError(null)
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      const googleUser = result.user

      const profileSnap = await getDoc(doc(db, 'users', googleUser.uid, 'profile', 'data'))
      if (!profileSnap.exists()) {
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
      }
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
      console.error('Google auth error:', error)
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

  // Clear all localStorage data for a given uid
  const clearLocalStorage = (uid) => {
    localStorage.removeItem(`elb_data_${uid}`)
    localStorage.removeItem(`elb_settings_${uid}`)
    localStorage.removeItem(`elb_last_local_save_${uid}`)
    localStorage.removeItem(`elb_last_sync_display_${uid}`)
  }

  // Delete account and all data (client-side, no Cloud Function required)
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
