import { useState, useEffect, useRef } from 'react'
import { auth, db, functions } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  sendEmailVerification
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import ELogbook2026 from './elogbook_2026_v5_1'
import OnboardingFlow from './OnboardingFlow'

function App() {
  const [user, setUser] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [signupError, setSignupError] = useState(null)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const prevUserRef = useRef(null)

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed, user:', currentUser?.email)

      // Detect logout: user was authenticated, now is null
      if (prevUserRef.current && !currentUser) {
        console.log('User logged out, showing confirmation')
        setShowLogoutConfirm(true)
      }

      prevUserRef.current = currentUser
      setUser(currentUser)
      setAuthLoading(false)

      if (currentUser) {
        // Check if profile exists and onboarding is complete
        try {
          const profileSnap = await getDoc(doc(db, 'users', currentUser.uid, 'profile', 'data'))
          console.log('Profile check - exists:', profileSnap.exists(), 'onboardingComplete:', profileSnap.data()?.onboardingComplete)

          if (profileSnap.exists()) {
            const profileData = profileSnap.data()

            // If profile exists and email is verified, assume onboarding is complete
            // (handles existing users created before onboarding feature)
            if (profileData.emailVerified && !profileData.onboardingComplete) {
              console.log('Auto-completing onboarding for verified user')
              await setDoc(
                doc(db, 'users', currentUser.uid, 'profile', 'data'),
                { onboardingComplete: true },
                { merge: true }
              )
              setShowOnboarding(false)
            } else {
              // Check if onboarding is complete (BUG 1 & 6 FIX)
              const isComplete = profileData.onboardingComplete === true || profileData.emailVerified === true
              console.log('Onboarding complete:', isComplete, 'showOnboarding will be:', !isComplete)
              setShowOnboarding(!isComplete)
            }
          } else {
            console.log('No profile, setting showOnboarding to true')
            setShowOnboarding(true)
          }
        } catch (err) {
          console.error('Error checking profile:', err)
          setShowOnboarding(true)
        }
      }
    })

    return unsubscribe
  }, [])

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
          setShowOnboarding(false)
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
        // Explicitly trigger onboarding complete state
        setShowOnboarding(false)
      }
    } catch (err) {
      console.error('Error completing onboarding:', err)
    }
  }

  // Delete account and all data
  const handleDeleteAccount = async () => {
    try {
      const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount')
      await deleteUserAccount()
      // Auth listener will detect logout and handle redirect
      console.log('Account deletion initiated')
    } catch (error) {
      console.error('Account deletion failed:', error)
      // User stays on page, sees error in settings
    }
  }

  if (authLoading) {
    return <div style={{ background: '#0a0d12', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Courier New' }}>Loading...</div>
  }

  if (showOnboarding || showLogoutConfirm) {
    return (
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
    )
  }

  return <ELogbook2026 onLogout={() => signOut(auth)} onDeleteAccount={handleDeleteAccount} />
}

export default App