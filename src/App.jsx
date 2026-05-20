import { useState, useEffect, useRef } from 'react'
import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  reauthenticateWithPopup,
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

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth state changed, user:', currentUser?.email)

      // Detect logout: user was authenticated, now is null
      if (prevUserRef.current && !currentUser) {
        console.log('User logged out, showing confirmation')
        setShowLogoutConfirm(true)
      }

      prevUserRef.current = currentUser
      setUser(currentUser)
      setAuthLoading(false)
      // Profile check in separate effect will determine showOnboarding
    })

    return unsubscribe
  }, [])

  // Safety timeout: if auth succeeded but showOnboarding didn't update after 3 sec, refresh
  useEffect(() => {
    if (!authSuccess || !user) return

    if (showOnboarding === false) {
      // Auth succeeded and user navigated to logbook, clear overlay
      console.log('Safety timeout: auth success confirmed, clearing overlay')
      setShowLoadingOverlay(false)
      setAuthSuccess(false)
      return
    }

    // Auth succeeded but still on onboarding, start countdown
    console.log('Safety timeout: showing overlay, starting 3-second countdown', {
      userEmail: user?.email,
      showOnboarding
    })
    setShowLoadingOverlay(true)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // 3 seconds elapsed, refresh if still on onboarding
          console.warn('Safety timeout: forcing page refresh', {
            showOnboarding,
            userEmail: user?.email,
            isLoading: authLoading
          })
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
        const start = performance.now()
        const profileSnap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'))
        const duration = performance.now() - start
        console.log('Profile query took:', duration.toFixed(2), 'ms')
        console.log('Profile check - exists:', profileSnap.exists(), 'onboardingComplete:', profileSnap.data()?.onboardingComplete)

        // Don't override if user already explicitly completed onboarding
        if (onboardingDoneRef.current) return

        if (profileSnap.exists()) {
          const profileData = profileSnap.data()

          // If onboarding is complete, show logbook
          if (profileData.onboardingComplete === true || profileData.emailVerified === true) {
            console.log('Onboarding complete, showing logbook')
            setShowOnboarding(false)
          } else {
            // New user, show onboarding
            console.log('New user detected, showing onboarding')
            setShowOnboarding(true)
          }

          // Auto-complete onboarding for old verified users
          if (profileData.emailVerified && !profileData.onboardingComplete) {
            console.log('Auto-completing onboarding for verified user')
            await setDoc(
              doc(db, 'users', user.uid, 'profile', 'data'),
              { onboardingComplete: true },
              { merge: true }
            )
          }
        } else {
          console.log('No profile found, showing onboarding')
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
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const newUser = userCredential.user

      // Create profile doc in Firestore
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

      // Send verification email
      try {
        await sendEmailVerification(newUser)
        console.log('Verification email sent to:', newUser.email)
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
      // Auth listener will handle user state and navigation
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

  // Google signup/login
  const handleGoogleAuth = async () => {
    setIsSigningUp(true)
    setSignupError(null)

    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const googleUser = result.user
      console.log('Google auth successful, user:', googleUser.email)

      // Check if profile exists
      const profileSnap = await getDoc(doc(db, 'users', googleUser.uid, 'profile', 'data'))
      console.log('Profile exists:', profileSnap.exists())

      if (!profileSnap.exists()) {
        // New user: create profile
        console.log('Creating new profile for:', googleUser.email)
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
        // New user: stay on onboarding (Step 3)
        setUser(googleUser)
      } else {
        // Existing user: check if onboarding is complete
        const profileData = profileSnap.data()
        const isComplete = profileData.onboardingComplete || profileData.emailVerified
        console.log('Existing user, onboarding complete:', isComplete)

        setUser(googleUser)
        if (isComplete) {
          // Skip onboarding for existing users
          setAuthSuccess(true)
          setCountdown(3)
          // Profile check effect will set showOnboarding(false) based on profile data
        }
      }

      setIsSigningUp(false)
      return { success: true }
    } catch (error) {
      console.error('Google auth error:', error)
      setSignupError('Google sign-in failed.')
      setIsSigningUp(false)
      return { success: false, error: 'Google sign-in failed.' }
    }
  }

  const handleOnboardingComplete = async (profileData = {}) => {
    try {
      // Update Firestore profile with final data and mark onboarding complete
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

  // Delete account and all data (client-side, no Cloud Function required)
  const handleDeleteAccount = async () => {
    if (!user) return
    try {
      // Attempt deletion — may throw requires-recent-login if session is old
      await deleteDoc(doc(db, 'users', user.uid, 'profile', 'data'))
      await deleteDoc(doc(db, 'users', user.uid, 'logbook', 'data'))
      await deleteUser(user)
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        const providerId = user.providerData[0]?.providerId
        if (providerId === 'google.com') {
          try {
            await reauthenticateWithPopup(user, new GoogleAuthProvider())
            await deleteDoc(doc(db, 'users', user.uid, 'profile', 'data'))
            await deleteDoc(doc(db, 'users', user.uid, 'logbook', 'data'))
            await deleteUser(user)
          } catch (reAuthError) {
            console.error('Re-authentication failed:', reAuthError)
          }
        } else {
          // Email/password users: require recent login — surface as an error to the caller
          throw new Error('For security, please sign out and sign back in before deleting your account.')
        }
      } else {
        console.error('Account deletion failed:', error)
      }
    }
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
      <ELogbook2026 onLogout={() => signOut(auth)} onDeleteAccount={handleDeleteAccount} />
      {showLoadingOverlay && <LoadingOverlay countdown={countdown} />}
    </>
  )
}

export default App