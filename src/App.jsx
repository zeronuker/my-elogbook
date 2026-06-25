import { useState, useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  applyActionCode
} from 'firebase/auth'
import { doc, setDoc, getDoc, deleteDoc, collection, addDoc, query, where, getDocs, updateDoc } from 'firebase/firestore'
import ELogbook2026 from './ELogbook'
import OnboardingFlow from './OnboardingFlow'
import LoadingOverlay from './LoadingOverlay'
import SplashScreen from '@brand/SplashScreen'

// Session key used to prevent infinite reload loops from the auto-recovery safety net
const AUTH_RECOVERY_KEY = 'elb_auth_recovery_attempted'

// How often to poll for a new service worker while the app stays open.
const SW_UPDATE_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

// Module-level refs so onRegisteredSW can clear the previous interval/listener
// if the SW re-registers (e.g. after an update), preventing accumulation.
let _swIntervalId = null
let _swVisibilityListener = null

function App() {
  // Without an explicit poll, the browser only checks for a new SW on a full
  // navigation (~once/24h) — so an installed PWA resumed from the background
  // never gets prompted. Poll on an interval AND whenever the app regains focus.
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return
      const check = () => {
        if (navigator.onLine) r.update().catch(() => {})
      }
      if (_swIntervalId) clearInterval(_swIntervalId)
      if (_swVisibilityListener) document.removeEventListener('visibilitychange', _swVisibilityListener)
      _swVisibilityListener = () => { if (document.visibilityState === 'visible') check() }
      _swIntervalId = setInterval(check, SW_UPDATE_INTERVAL_MS)
      document.addEventListener('visibilitychange', _swVisibilityListener)
    },
  })
  const [showSplash, setShowSplash] = useState(true)
  const [user, setUser] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [profileResolved, setProfileResolved] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [signupError, setSignupError] = useState(null)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [verifyAction, setVerifyAction] = useState(null) // { status: 'checking'|'success'|'error', code?: string }
  const [showAccountDeleted, setShowAccountDeleted] = useState(false)
  const accountDeletedRef = useRef(false) // set just before the deleteUser() that removes the account
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const prevUserRef = useRef(null)
  const onboardingDoneRef = useRef(false)
  const prevIsSigningUpRef = useRef(false)
  const overlayTimeoutRef = useRef(null)

  // Check localStorage availability once on mount (fails in private/incognito on some browsers)
  useEffect(() => {
    try {
      const k = '__elb_storage_test__'
      localStorage.setItem(k, '1')
      localStorage.removeItem(k)
    } catch {
      setStorageAvailable(false)
    }
  }, [])

  // Handle email-verification links ourselves instead of Firebase's default
  // hosted action page. That page shows a generic "expired or already used"
  // error with no way forward and no visibility into *why* it failed. Here we
  // apply the code directly, fall back to checking the live emailVerified flag
  // (covers the case where the code died but verification actually succeeded),
  // and log real failures so the next occurrence has a concrete cause instead
  // of a guess.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    const oobCode = params.get('oobCode')
    if (mode !== 'verifyEmail' || !oobCode) return

    // Strip the params so a reload doesn't try to replay the same code
    window.history.replaceState({}, '', window.location.pathname)
    setVerifyAction({ status: 'checking' })

    applyActionCode(auth, oobCode)
      .then(async () => {
        await auth.currentUser?.reload().catch(() => {})
        setVerifyAction({ status: 'success' })
      })
      .catch(async (err) => {
        console.error('Email verification failed:', err.code)
        addDoc(collection(db, 'verificationErrors'), {
          code: err.code || 'unknown',
          email: auth.currentUser?.email || null,
          uid: auth.currentUser?.uid || null,
          at: new Date().toISOString(),
        }).catch(() => {})
        setVerifyAction({ status: 'error', code: err.code })
      })
  }, [])

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
      return { isNew: true }
    }
    return { isNew: false }
  }

  // Clear all localStorage data for a given uid
  const clearLocalStorage = (uid) => {
    localStorage.removeItem(`elb_data_${uid}`)
    localStorage.removeItem(`elb_settings_${uid}`)
    localStorage.removeItem(`elb_last_local_save_${uid}`)
    localStorage.removeItem(`elb_last_sync_display_${uid}`)
  }

  // GDPR erasure: anonymise the user's feedback submissions (blank uid + email,
  // keep the content) before the account is deleted. Best-effort and
  // non-blocking — a failure here never prevents account deletion. Must run
  // while the user is still authenticated (the Firestore rule checks uid).
  const anonymizeFeedback = async (uid) => {
    try {
      const snap = await getDocs(query(collection(db, 'feedback'), where('uid', '==', uid)))
      await Promise.all(snap.docs.map(d => updateDoc(d.ref, { uid: '[deleted]', email: '[deleted]' })))
    } catch (err) {
      console.error('Feedback anonymisation failed (non-blocking):', err)
    }
  }

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Detect the user→null transition. It's an account deletion if a delete
      // handler set the flag just before deleteUser(); otherwise it's a logout.
      if (prevUserRef.current && !currentUser) {
        if (accountDeletedRef.current) {
          accountDeletedRef.current = false
          localStorage.removeItem('elb_pending_delete') // deletion completed cleanly
          setShowAccountDeleted(true)
        } else {
          setShowLogoutConfirm(true)
        }
      }
      // A new user signed in — clear the account-deleted screen so signing up
      // again (after a deletion) lands in the app rather than staying stuck.
      if (currentUser) {
        setShowAccountDeleted(false)
      }

      prevUserRef.current = currentUser
      setUser(currentUser)
      setAuthLoading(false)
    })

    return unsubscribe
  }, [])

  // Resume an interrupted account deletion on load. If the previous run was cut
  // short (crash / tab close mid-sequence), finish erasing the data and remove
  // the auth account so nothing is left orphaned.
  useEffect(() => {
    if (authLoading) return
    const pendingUid = localStorage.getItem('elb_pending_delete')
    if (!pendingUid) return
    const current = auth.currentUser
    const finish = async () => {
      try {
        // Only act if still signed in as the user who was being deleted.
        // If auth is already gone (deleteUser had succeeded), or it's a
        // different user, there's nothing safe to do — just clear the flag.
        if (current && current.uid === pendingUid) {
          await deleteDoc(doc(db, 'users', pendingUid, 'profile', 'data')).catch(() => {})
          await deleteDoc(doc(db, 'users', pendingUid, 'logbook', 'data')).catch(() => {})
          clearLocalStorage(pendingUid)
          await anonymizeFeedback(pendingUid)
          accountDeletedRef.current = true
          await deleteUser(current) // if this needs re-auth it throws; data is already erased
        }
      } catch (err) {
        accountDeletedRef.current = false
        console.error('Resuming interrupted deletion did not fully complete:', err)
        // Data is already erased but the auth account couldn't be removed
        // (likely needs re-auth). Surface a message so the user knows to finish
        // via Settings → Delete Account.
        setSignupError('Your logbook data was deleted but your account could not be fully removed. Open Settings → Delete Account to complete the process.')
      } finally {
        localStorage.removeItem('elb_pending_delete')
      }
    }
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  // Check profile and set onboarding state
  useEffect(() => {
    if (authLoading) return  // wait until auth state is known

    if (!user) {
      setShowOnboarding(true)
      setProfileResolved(true)
      return
    }

    const checkProfile = async () => {
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'))

        // Don't override if getRedirectResult or onboarding already made a decision
        if (onboardingDoneRef.current) return

        if (profileSnap.exists()) {
          const profileData = profileSnap.data()

          // Firebase Auth is the source of truth for email verification — the
          // Firestore flag lags behind (it's only written when in-app onboarding
          // finishes). Honour user.emailVerified so a verified user who clicked
          // the link out-of-band isn't stranded on the landing/onboarding screen.
          const authEmailVerified = user?.emailVerified === true
          const isComplete = profileData.onboardingComplete === true || profileData.emailVerified === true || authEmailVerified
          const isGoogleUser = user?.providerData?.[0]?.providerId === 'google.com'
          if (isComplete || isGoogleUser) {
            // Reconcile stale flags for any inherently-verified user (Google or
            // an email user Firebase Auth reports as verified)
            if ((isGoogleUser || authEmailVerified) && profileData.onboardingComplete !== true) {
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
      } finally {
        setProfileResolved(true)
      }
    }

    checkProfile()
  }, [user, authLoading])

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
      // An unverified email/password user is *supposed* to be on the onboarding
      // (verify-your-email) screen — that's not a stuck state. Reloading them
      // here wrongly dumps them to the landing page.
      const u = auth.currentUser
      const awaitingEmailVerify =
        u && !u.emailVerified && u.providerData?.[0]?.providerId === 'password'
      const stillStuck =
        (showOnboarding || showLogoutConfirm) &&
        u &&
        !isSigningUp &&
        !awaitingEmailVerify
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
        await sendEmailVerification(newUser, { url: `${window.location.origin}/`, handleCodeInApp: true })
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

      // Safety net: checkProfile normally clears the overlay, but if the user
      // object reference doesn't change (e.g. signing in again as the same uid
      // after a password reset) the effect won't re-run. Force-clear after 5s so
      // the overlay can't get stuck on "Setting up your logbook".
      // Store the ID so a rapid second login cancels the first timer.
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current)
      overlayTimeoutRef.current = setTimeout(() => {
        overlayTimeoutRef.current = null
        setShowLoadingOverlay(false)
      }, 5000)
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

  const handleForgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email)
      return { success: true }
    } catch (error) {
      let errorMsg = 'Failed to send reset email. Try again.'
      if (error.code === 'auth/user-not-found') errorMsg = 'No account found with this email.'
      if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email address.'
      return { success: false, error: errorMsg }
    }
  }

  // Resend the verification email to the currently signed-in (unverified) user.
  // Called from the verify-email onboarding screen.
  const handleResendVerification = async () => {
    if (!auth.currentUser) return { success: false, error: 'Not signed in.' }
    try {
      await sendEmailVerification(auth.currentUser, { url: `${window.location.origin}/`, handleCodeInApp: true })
      return { success: true }
    } catch (error) {
      const errorMsg = error.code === 'auth/too-many-requests'
        ? 'Too many requests. Wait a moment and try again.'
        : 'Could not resend. Try again.'
      return { success: false, error: errorMsg }
    }
  }

  // Google sign-in via Google Identity Services (GIS).
  // GIS returns an ID token in a same-context callback, so it works inside
  // installed PWAs where Firebase's popup/redirect flows fail. This is the
  // primary Google path; handleGoogleAuth (popup) remains only as a fallback
  // for environments where the GIS Client ID isn't configured.
  const handleGoogleCredential = async (idToken) => {
    setIsSigningUp(true)
    setSignupError(null)
    try {
      const credential = GoogleAuthProvider.credential(idToken)
      const result = await signInWithCredential(auth, credential)
      const { isNew } = await ensureGoogleProfile(result.user)
      onboardingDoneRef.current = true
      if (isNew) {
        setShowOnboarding(true)
      } else {
        setShowOnboarding(false)
        setShowLoadingOverlay(true)
        setTimeout(() => setShowLoadingOverlay(false), 1500)
      }
      setIsSigningUp(false)
    } catch (error) {
      console.error('Google credential sign-in error:', error)
      setSignupError('Google sign-in failed. Please try again, or use email/password instead.')
      setIsSigningUp(false)
    }
  }

  // Google signup/login — popup-based. Retained as a fallback used only when the
  // GIS Client ID is not configured (see GoogleSignInButton).
  const handleGoogleAuth = async () => {
    setIsSigningUp(true)
    setSignupError(null)
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      const googleUser = result.user
      const { isNew } = await ensureGoogleProfile(googleUser)
      onboardingDoneRef.current = true
      if (isNew) {
        setShowOnboarding(true)
      } else {
        setShowOnboarding(false)
        setShowLoadingOverlay(true)
        setTimeout(() => setShowLoadingOverlay(false), 1500)
      }
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

  // Begin account deletion. We re-authenticate BEFORE erasing anything, so
  // cancelling the identity prompt can never leave a half-deleted account.
  //
  // Why not delete here first: Firestore docs must be removed while the user is
  // still authenticated (deleteUser invalidates the token, after which the rule
  // `request.auth.uid == uid` rejects the deletes). Deleting docs up front means
  // a cancelled re-auth would strand the data with the auth account still alive.
  // Instead this routes straight to the provider's re-auth prompt; the actual
  // erasure (reauth → Firestore docs → deleteUser) happens in the handlers below,
  // only once identity is confirmed.
  const handleDeleteAccount = async () => {
    if (!user) return
    const providerId = user.providerData?.[0]?.providerId
    if (providerId === 'google.com') {
      // Settings modal shows a Google re-auth button (GIS — works inside PWAs).
      throw Object.assign(new Error('needs-google-reauth'), { code: 'needs-google-reauth' })
    } else {
      // Settings modal shows the password prompt.
      throw Object.assign(new Error('requires-recent-login'), { code: 'auth/requires-recent-login' })
    }
  }

  // Re-authenticate a Google user with a fresh GIS ID token, then complete the
  // account deletion. Called from the Settings modal after handleDeleteAccount
  // signals 'needs-google-reauth'. Works on PWA where popup re-auth cannot.
  const handleReauthAndDeleteGoogle = async (idToken) => {
    if (!user) return
    const uid = user.uid
    const credential = GoogleAuthProvider.credential(idToken)
    try {
      await reauthenticateWithCredential(user, credential)
    } catch (err) {
      if (err.code === 'auth/user-mismatch') {
        throw new Error('That Google account does not match your logbook account. Please choose the account you signed in with.')
      }
      throw new Error(err.message || 'Re-authentication failed. Please try again.')
    }
    // Identity confirmed — now safe to erase. Mark a deletion in progress so an
    // interrupted run (crash / tab close mid-sequence) finishes on next load.
    localStorage.setItem('elb_pending_delete', uid)
    await deleteDoc(doc(db, 'users', uid, 'profile', 'data'))
    await deleteDoc(doc(db, 'users', uid, 'logbook', 'data'))
    clearLocalStorage(uid)
    await anonymizeFeedback(uid)
    accountDeletedRef.current = true
    await deleteUser(user)
  }

  // Popup-based Google re-auth + delete. Only used as a fallback when GIS is
  // unavailable (script blocked / no Client ID). Works on desktop; on a PWA
  // with GIS blocked there is no working path, so the user deletes from a
  // browser instead.
  const handleReauthAndDeleteGooglePopup = async () => {
    if (!user) return
    const uid = user.uid
    await reauthenticateWithPopup(user, new GoogleAuthProvider())
    // Identity confirmed — mark in progress, then erase.
    localStorage.setItem('elb_pending_delete', uid)
    await deleteDoc(doc(db, 'users', uid, 'profile', 'data'))
    await deleteDoc(doc(db, 'users', uid, 'logbook', 'data'))
    clearLocalStorage(uid)
    await anonymizeFeedback(uid)
    accountDeletedRef.current = true
    await deleteUser(user)
  }

  // Re-authenticate email/password user then delete — called from SettingsModal
  // password prompt after handleDeleteAccount signalled `auth/requires-recent-login`.
  // Reauth happens first, so a wrong password / cancel erases nothing.
  // Order: reauth → mark pending → Firestore docs → localStorage → deleteUser.
  const handleReauthAndDelete = async (password) => {
    if (!user) return
    const uid = user.uid
    const credential = EmailAuthProvider.credential(user.email, password)
    await reauthenticateWithCredential(user, credential)
    // Identity confirmed — mark in progress, then erase.
    localStorage.setItem('elb_pending_delete', uid)
    await deleteDoc(doc(db, 'users', uid, 'profile', 'data'))
    await deleteDoc(doc(db, 'users', uid, 'logbook', 'data'))
    clearLocalStorage(uid)
    await anonymizeFeedback(uid)
    accountDeletedRef.current = true
    await deleteUser(user)
  }

  const splash = showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />

  if (authLoading || !profileResolved) {
    return (
      <>
        {splash}
        <div style={{ background: '#0a0d12', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Courier New' }}>Loading...</div>
      </>
    )
  }

  if (showOnboarding || showLogoutConfirm || showAccountDeleted || verifyAction) {
    return (
      <>
        {splash}
        <OnboardingFlow
          user={user}
          onSignup={handleSignup}
          onLogin={handleLogin}
          onGoogleAuth={handleGoogleAuth}
          onGoogleCredential={handleGoogleCredential}
          onOnboardingComplete={handleOnboardingComplete}
          onForgotPassword={handleForgotPassword}
          onResendVerification={handleResendVerification}
          verifyAction={verifyAction}
          signupError={signupError}
          isLoading={isSigningUp}
          showLogoutConfirm={showLogoutConfirm}
          showAccountDeleted={showAccountDeleted}
          onClearError={() => setSignupError(null)}
          needRefresh={needRefresh}
          updateServiceWorker={updateServiceWorker}
        />
        {showLoadingOverlay && <LoadingOverlay />}
      </>
    )
  }

  return (
    <>
      {splash}
      {!storageAvailable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#7c2d12', color: '#fef2f2',
          padding: '10px 16px', fontSize: 13,
          fontFamily: "'Courier New', monospace",
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #991b1b',
        }}>
          <span>⚠ LOCAL STORAGE UNAVAILABLE — Private/incognito mode detected. Switch to a normal browser tab to ensure your data is saved to device.</span>
          <button onClick={() => setStorageAvailable(true)} style={{ background: 'none', border: 'none', color: '#fef2f2', cursor: 'pointer', fontSize: 18, padding: '0 0 0 16px', lineHeight: 1 }}>✕</button>
        </div>
      )}
      <ELogbook2026
        user={user}
        onLogout={() => signOut(auth)}
        onDeleteAccount={handleDeleteAccount}
        onReauthAndDelete={handleReauthAndDelete}
        onReauthAndDeleteGoogle={handleReauthAndDeleteGoogle}
        onReauthAndDeleteGooglePopup={handleReauthAndDeleteGooglePopup}
        userProvider={user?.providerData[0]?.providerId || 'password'}
        needRefresh={needRefresh}
        updateServiceWorker={updateServiceWorker}
      />
      {showLoadingOverlay && <LoadingOverlay />}
    </>
  )
}

export default App
