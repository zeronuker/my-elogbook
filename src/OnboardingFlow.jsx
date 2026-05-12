import { useState, useEffect } from 'react';

export default function OnboardingFlow({
  user,
  onSignup,
  onLogin,
  onGoogleAuth,
  onOnboardingComplete,
  signupError,
  isLoading
}) {
  const [authMode, setAuthMode] = useState('landing');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    licenseType: 'ATPL(A)',
    organization: ''
  });

  // Password validator
  const validatePassword = (pwd) => {
    const hasLength = pwd.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSymbol = /[!@#$%^&*]/.test(pwd);
    return {
      isValid: hasLength && hasLetter && hasNumber && hasSymbol,
      hasLength,
      hasLetter,
      hasNumber,
      hasSymbol
    };
  };

  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    hasLength: false,
    hasLetter: false,
    hasNumber: false,
    hasSymbol: false
  });

  // Listen for email verification
  useEffect(() => {
    if (user && authMode === 'emailVerification') {
      const interval = setInterval(async () => {
        await user.reload()
        if (user.emailVerified) {
          clearInterval(interval)
          goTo('signup2')
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [user, authMode]);

  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (key === 'password') {
      setPasswordValidation(validatePassword(value));
    }
  };

  const goTo = (mode) => {
    setAuthMode(mode);
  };

  // CSS
  const styles = `
    :root {
      --bg:#0a0d12;--surface:#0d1520;
      --border:#1e3a5f;--border2:#0f1e2d;
      --accent:#4fc3f7;--green:#22c55e;--red:#ef4444;
      --text:#ffffff;--muted:#b8d6e5;--dim:#2a4a6a;
      --mono:'Courier New',monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .onb-container {
      position: fixed; inset: 0;
      background: var(--bg);
      color: var(--text);
      font-family: var(--mono);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 1000;
      overflow: auto;
    }

    .onb-container::before {
      content: '';
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(79,195,247,0.025) 1px,transparent 1px),
        linear-gradient(90deg,rgba(79,195,247,0.025) 1px,transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
      z-index: -1;
    }

    .onb-screen { display: none; }
    .onb-screen.active { display: flex; flex-direction: column; align-items: center; justify-content: center; }

    .onb-prog-bar {
      position: fixed; top: 0; left: 0; right: 0;
      height: 2px; background: var(--border2);
      z-index: 100;
    }

    .onb-prog-fill {
      height: 100%;
      background: var(--accent);
      box-shadow: 0 0 8px rgba(79,195,247,0.6);
      transition: width 0.5s ease;
    }

    .onb-dots {
      position: fixed; top: 14px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 6px;
      align-items: center;
      z-index: 100;
    }

    .onb-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--border);
      transition: all 0.3s;
    }

    .onb-dot.active {
      background: var(--accent);
      width: 18px;
      border-radius: 3px;
    }

    .onb-dot.done { background: var(--green); }

    .onb-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      width: 100%;
      overflow: hidden;
    }

    .onb-cbar {
      height: 3px;
      background: linear-gradient(90deg, var(--accent), #2196f3);
    }

    .onb-cbody { padding: 26px 30px; }

    .onb-slbl {
      font-size: 11px;
      letter-spacing: 0.22em;
      color: var(--muted);
      margin-bottom: 9px;
    }

    .onb-stitle {
      font-size: 24px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: 0.06em;
      margin-bottom: 7px;
      line-height: 1.25;
    }

    .onb-ssub {
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.05em;
      line-height: 1.65;
      margin-bottom: 18px;
    }

    .onb-field {
      margin-bottom: 14px;
    }

    .onb-field label {
      display: block;
      font-size: 11px;
      letter-spacing: 0.15em;
      color: var(--muted);
      margin-bottom: 5px;
    }

    .onb-field input,
    .onb-field select {
      width: 100%;
      background: #080b10;
      border: 1px solid var(--border);
      border-radius: 3px;
      color: var(--text);
      font-family: var(--mono);
      font-size: 14px;
      padding: 10px 12px;
      outline: none;
      transition: border-color 0.15s;
      letter-spacing: 0.05em;
    }

    .onb-field input:focus,
    .onb-field select:focus {
      border-color: var(--accent);
    }

    .onb-field input::placeholder { color: var(--muted); }
    .onb-field select option { background: var(--surface); }

    .onb-frow {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .onb-btn {
      width: 100%;
      font-family: var(--mono);
      font-size: 13px;
      letter-spacing: 0.18em;
      padding: 13px;
      cursor: pointer;
      border-radius: 3px;
      transition: all 0.15s;
      margin-top: 8px;
      border: none;
    }

    .onb-btn-p {
      background: rgba(79,195,247,0.1);
      border: 1px solid var(--accent);
      color: var(--accent);
    }

    .onb-btn-p:hover { background: rgba(79,195,247,0.2); }

    .onb-btn-g {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 12px;
    }

    .onb-btn-g:hover {
      border-color: var(--muted);
      color: var(--text);
    }

    .onb-btn-done {
      background: rgba(34,197,94,0.12);
      border: 1px solid var(--green);
      color: var(--green);
    }

    .onb-btn-done:hover { background: rgba(34,197,94,0.22); }

    .onb-btn-google {
      background: #080b10;
      border: 1px solid var(--border);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      letter-spacing: 0.12em;
    }

    .onb-btn-google:hover { border-color: #e8453c; }

    .onb-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 11px 0;
    }

    .onb-divider-line {
      flex: 1;
      height: 1px;
      background: var(--border2);
    }

    .onb-divider-text {
      font-size: 8px;
      color: var(--dim);
      letter-spacing: 0.1em;
    }

    .onb-back {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.1em;
      cursor: pointer;
      margin-bottom: 18px;
      padding: 0;
    }

    .onb-back:hover { color: var(--accent); }

    .onb-land {
      text-align: center;
      max-width: 440px;
      width: 100%;
    }

    .onb-land-logo {
      font-size: 56px;
      margin-bottom: 18px;
      filter: drop-shadow(0 0 24px rgba(79,195,247,0.5));
    }

    .onb-land-title {
      font-size: 32px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: 0.2em;
      margin-bottom: 5px;
    }

    .onb-land-ver {
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 0.22em;
      margin-bottom: 12px;
    }

    .onb-land-tag {
      font-size: 13px;
      color: var(--muted);
      letter-spacing: 0.08em;
      line-height: 1.75;
      margin-bottom: 20px;
    }

    .onb-badges {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-bottom: 22px;
      flex-wrap: wrap;
    }

    .onb-badge {
      font-size: 7px;
      letter-spacing: 0.1em;
      padding: 3px 9px;
      border-radius: 2px;
    }

    .onb-badge-blue {
      background: rgba(79,195,247,0.1);
      border: 1px solid rgba(79,195,247,0.3);
      color: var(--accent);
    }

    .onb-badge-green {
      background: rgba(34,197,94,0.1);
      border: 1px solid rgba(34,197,94,0.3);
      color: var(--green);
    }

    .onb-land-btns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .onb-lbtn {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 22px 14px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }

    .onb-lbtn:hover { border-color: var(--muted); }
    .onb-lbtn.signup { border-color: var(--accent); background: rgba(79,195,247,0.08); }
    .onb-lbtn.signup:hover { background: rgba(79,195,247,0.15); border-color: var(--accent); }

    .onb-lbtn-icon { font-size: 28px; margin-bottom: 9px; }
    .onb-lbtn-title { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: var(--text); margin-bottom: 4px; }
    .onb-lbtn-sub { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; }

    .onb-land-legal {
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 0.04em;
      line-height: 1.65;
    }

    .onb-hint {
      font-size: 10px;
      color: var(--muted);
      letter-spacing: 0.08em;
      margin-top: 8px;
      font-style: italic;
    }

    .onb-done {
      text-align: center;
      max-width: 380px;
      width: 100%;
    }

    .onb-done-icon {
      font-size: 64px;
      margin-bottom: 18px;
      animation: onb-pop 0.5s ease;
    }

    @keyframes onb-pop {
      0% { transform: scale(.4); opacity: 0; }
      70% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }

    .onb-done-ttl {
      font-size: 26px;
      font-weight: 700;
      color: var(--green);
      letter-spacing: 0.12em;
      margin-bottom: 8px;
    }

    .onb-done-sub {
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.06em;
      line-height: 1.7;
      margin-bottom: 20px;
    }

    .onb-done-pills {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .onb-email-box {
      background: #080b10;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }

    .onb-email-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }

    .onb-email-addr {
      font-size: 13px;
      color: var(--text);
      font-weight: 700;
      margin-bottom: 6px;
    }

    .onb-email-desc {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.6;
      margin-bottom: 6px;
    }

    .onb-email-help {
      font-size: 11px;
      color: var(--muted);
      text-align: center;
      margin-bottom: 18px;
      line-height: 1.6;
    }

    .onb-email-help-link {
      color: var(--accent);
      cursor: pointer;
      text-decoration: underline;
    }

    .onb-waiting-btn {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .onb-pwd-wrapper {
      position: relative;
      margin-bottom: 14px;
    }

    .onb-pwd-indicator {
      position: absolute;
      right: 12px;
      top: 35px;
      font-size: 16px;
    }

    .onb-pwd-valid { color: var(--green); }
    .onb-pwd-invalid { color: var(--red); }

    .onb-pwd-requirements {
      background: rgba(79,195,247,0.04);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 10px 12px;
      margin-top: 8px;
      font-size: 10px;
    }

    .onb-pwd-req-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      color: var(--muted);
    }

    .onb-pwd-req-item:last-child { margin-bottom: 0; }

    .onb-pwd-req-check {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      flex-shrink: 0;
    }

    .onb-pwd-req-check.done {
      background: var(--green);
      border-color: var(--green);
      color: var(--bg);
    }

    .onb-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  // Screen: Landing
  const ScreenLanding = () => (
    <div className="onb-land">
      <div className="onb-land-logo">✈</div>
      <div className="onb-land-title">CLAUDEBORNE</div>
      <div className="onb-land-ver">eLOGBOOK V5.1 · CAAM / MCAR 2016</div>
      <div className="onb-land-tag">Your CAAM-compliant digital pilot logbook.<br/>Accessible anywhere. Secure. Always in sync.</div>
      <div className="onb-badges">
        <span className="onb-badge onb-badge-blue">✓ CAD 1901</span>
        <span className="onb-badge onb-badge-blue">✓ MCAR 2016 PART 7 & 8</span>
        <span className="onb-badge onb-badge-green">✓ FREE</span>
        <span className="onb-badge onb-badge-green">✓ CLOUD SYNC</span>
      </div>
      <div className="onb-land-btns">
        <div className="onb-lbtn" onClick={() => goTo('login')}>
          <div className="onb-lbtn-icon">🔑</div>
          <div className="onb-lbtn-title">LOG IN</div>
          <div className="onb-lbtn-sub">Access your existing logbook</div>
        </div>
        <div className="onb-lbtn signup" onClick={() => goTo('signup1')}>
          <div className="onb-lbtn-icon">✨</div>
          <div className="onb-lbtn-title">SIGN UP FREE</div>
          <div className="onb-lbtn-sub">Create your pilot logbook today</div>
        </div>
      </div>
      <div className="onb-land-legal">By continuing you agree to our Terms of Service.<br/>Your data is stored securely and privately.</div>
    </div>
  );

  // Screen: Login
  const ScreenLogin = () => {
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')

    const handleLoginClick = async () => {
      const result = await onLogin(loginEmail, loginPassword)
      if (result.success) {
        // Auth state listener will handle navigation
      }
    }

    return (
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <button className="onb-back" onClick={() => goTo('landing')}>← BACK</button>
        <div className="onb-card">
          <div className="onb-cbar"></div>
          <div className="onb-cbody">
            <div className="onb-slbl">RETURNING PILOT</div>
            <div className="onb-stitle">WELCOME BACK</div>
            <div className="onb-ssub">Sign in to access your logbook from any device.</div>
            {signupError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 12px', borderRadius: '3px', fontSize: '11px', marginBottom: '14px' }}>
                {signupError}
              </div>
            )}
            <div className="onb-field">
              <label>EMAIL ADDRESS</label>
              <input type="email" placeholder="your@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} disabled={isLoading} />
            </div>
            <div className="onb-field">
              <label>PASSWORD</label>
              <input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} disabled={isLoading} />
            </div>
            <div style={{ textAlign: 'right', marginBottom: '4px' }}>
              <span style={{ fontSize: '8px', color: 'var(--accent)', cursor: 'pointer', letterSpacing: '0.08em' }}>FORGOT PASSWORD?</span>
            </div>
            <button className="onb-btn onb-btn-p" onClick={handleLoginClick} disabled={isLoading || !loginEmail || !loginPassword}>
              {isLoading ? 'LOGGING IN...' : 'LOG IN →'}
            </button>
            <div className="onb-divider">
              <div className="onb-divider-line"></div>
              <div className="onb-divider-text">OR</div>
              <div className="onb-divider-line"></div>
            </div>
            <button className="onb-btn onb-btn-google" onClick={onGoogleAuth} disabled={isLoading}>
              <span style={{ fontSize: '14px', color: '#e8453c', fontWeight: '700' }}>G</span>CONTINUE WITH GOOGLE
            </button>
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '8px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              No account? <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => goTo('signup1')}>SIGN UP FREE</span>
            </div>
          </div>
        </div>
      </div>
    )
  };

  // Screen: Sign Up Step 1
  const ScreenSignUp1 = () => {
    const handleSignupClick = async () => {
      const result = await onSignup(formData.email, formData.password, formData.fullName)
      if (result.success) {
        goTo('emailVerification')
      }
    }

    const handleGoogleSignup = async () => {
      const result = await onGoogleAuth()
      if (result.success) {
        // Auth state listener will handle navigation
      }
    }

    return (
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <button className="onb-back" onClick={() => goTo('landing')} disabled={isLoading}>← BACK</button>
        <div className="onb-card">
          <div className="onb-cbar"></div>
          <div className="onb-cbody">
            <div className="onb-slbl">NEW PILOT · STEP 1 OF 3</div>
            <div className="onb-stitle">CREATE YOUR ACCOUNT</div>
            <div className="onb-ssub">Free forever. No credit card required.</div>
            {signupError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 12px', borderRadius: '3px', fontSize: '11px', marginBottom: '14px' }}>
                {signupError}
              </div>
            )}
            <div className="onb-field">
              <label>EMAIL ADDRESS</label>
              <input type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => updateFormData('email', e.target.value)} disabled={isLoading} />
            </div>
            <div className="onb-pwd-wrapper">
              <div className="onb-field" style={{ marginBottom: 0 }}>
                <label>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    placeholder="Min. 8 chars, 1 letter, 1 number, 1 symbol"
                    value={formData.password}
                    onChange={(e) => updateFormData('password', e.target.value)}
                    disabled={isLoading}
                    style={{ paddingRight: '40px' }}
                  />
                  {formData.password && (
                    <div className={`onb-pwd-indicator ${passwordValidation.isValid ? 'onb-pwd-valid' : 'onb-pwd-invalid'}`}>
                      {passwordValidation.isValid ? '✓' : '✗'}
                    </div>
                  )}
                </div>
              </div>
              {formData.password && (
                <div className="onb-pwd-requirements">
                  <div className={`onb-pwd-req-item ${passwordValidation.hasLength ? 'done' : ''}`}>
                    <div className={`onb-pwd-req-check ${passwordValidation.hasLength ? 'done' : ''}`}>
                      {passwordValidation.hasLength ? '✓' : ''}
                    </div>
                    <span>Min. 8 characters</span>
                  </div>
                  <div className={`onb-pwd-req-item ${passwordValidation.hasLetter ? 'done' : ''}`}>
                    <div className={`onb-pwd-req-check ${passwordValidation.hasLetter ? 'done' : ''}`}>
                      {passwordValidation.hasLetter ? '✓' : ''}
                    </div>
                    <span>1 letter (a-z, A-Z)</span>
                  </div>
                  <div className={`onb-pwd-req-item ${passwordValidation.hasNumber ? 'done' : ''}`}>
                    <div className={`onb-pwd-req-check ${passwordValidation.hasNumber ? 'done' : ''}`}>
                      {passwordValidation.hasNumber ? '✓' : ''}
                    </div>
                    <span>1 number (0-9)</span>
                  </div>
                  <div className={`onb-pwd-req-item ${passwordValidation.hasSymbol ? 'done' : ''}`}>
                    <div className={`onb-pwd-req-check ${passwordValidation.hasSymbol ? 'done' : ''}`}>
                      {passwordValidation.hasSymbol ? '✓' : ''}
                    </div>
                    <span>1 symbol (!@#$%^&*)</span>
                  </div>
                </div>
              )}
            </div>
            <div className="onb-field">
              <label>CONFIRM PASSWORD</label>
              <input type="password" placeholder="Repeat" value={formData.confirmPassword} onChange={(e) => updateFormData('confirmPassword', e.target.value)} disabled={isLoading} />
            </div>
            <div className="onb-field">
              <label>FULL NAME (OPTIONAL)</label>
              <input type="text" placeholder="e.g. AMIR RASHID" value={formData.fullName} onChange={(e) => updateFormData('fullName', e.target.value)} disabled={isLoading} />
            </div>
            <div className="onb-hint">💡 Leave blank if you prefer anonymity</div>
            <button
              className="onb-btn onb-btn-p"
              onClick={handleSignupClick}
              disabled={isLoading || !passwordValidation.isValid || formData.password !== formData.confirmPassword}
            >
              {isLoading ? 'CREATING ACCOUNT...' : 'NEXT →'}
            </button>
            {formData.password !== formData.confirmPassword && formData.confirmPassword && (
              <div className="onb-hint" style={{ color: 'var(--red)', marginTop: '8px' }}>⚠ Passwords don't match</div>
            )}
            <div className="onb-divider">
              <div className="onb-divider-line"></div>
              <div className="onb-divider-text">OR</div>
              <div className="onb-divider-line"></div>
            </div>
            <button className="onb-btn onb-btn-google" onClick={handleGoogleSignup} disabled={isLoading}>
              <span style={{ fontSize: '14px', color: '#e8453c', fontWeight: '700' }}>G</span>CONTINUE WITH GOOGLE
            </button>
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '8px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              Already have an account? <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => goTo('login')}>LOG IN</span>
            </div>
          </div>
        </div>
      </div>
    )
  };

  // Screen: Email Verification
  const ScreenEmailVerification = () => (
    <div style={{ maxWidth: '480px', width: '100%' }}>
      <div className="onb-card">
        <div className="onb-cbar"></div>
        <div className="onb-cbody">
          <div className="onb-slbl">NEW PILOT · STEP 2 OF 3</div>
          <div className="onb-stitle">VERIFY YOUR EMAIL</div>
          <div className="onb-ssub">We sent a verification link to your email. Click it to continue.</div>
          <div className="onb-email-box">
            <div className="onb-email-icon">✉️</div>
            <div className="onb-email-addr">{formData.email || 'check-your-email@example.com'}</div>
            <div className="onb-email-desc">Click the verification link in your email to proceed. The link expires in 24 hours.</div>
          </div>
          <div className="onb-email-help">
            💡 Didn't receive the email? Check your spam folder or<br/>
            <span className="onb-email-help-link">resend verification email</span>
          </div>
          <button className="onb-btn onb-btn-g onb-waiting-btn" disabled>WAITING FOR VERIFICATION...</button>
        </div>
      </div>
    </div>
  );

  // Screen: Sign Up Step 2
  const ScreenSignUp2 = () => {
    return (
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <div className="onb-card">
          <div className="onb-cbar"></div>
          <div className="onb-cbody">
            <div className="onb-slbl">NEW PILOT · STEP 3 OF 3</div>
            <div className="onb-stitle">PILOT CREDENTIALS</div>
            <div className="onb-ssub">Quick setup. Update anytime in Settings.</div>
            <div className="onb-field">
              <label>LICENCE TYPE (DEFAULT: ATPL(A))</label>
              <select value={formData.licenseType} onChange={(e) => updateFormData('licenseType', e.target.value)} disabled={isLoading}>
                <option>ATPL(A)</option>
                <option>CPL(A)</option>
                <option>MPL</option>
                <option>PPL(A)</option>
              </select>
            </div>
            <div className="onb-field">
              <label>ORGANIZATION (OPTIONAL)</label>
              <input type="text" placeholder="e.g. MALAYSIA AIRLINES" value={formData.organization} onChange={(e) => updateFormData('organization', e.target.value)} disabled={isLoading} />
            </div>
            <div className="onb-hint">💡 Both fields optional. You can skip and add later.</div>
            <button className="onb-btn onb-btn-p" onClick={() => goTo('done')} disabled={isLoading}>
              CONTINUE →
            </button>
            <button className="onb-btn onb-btn-g" onClick={() => goTo('done')} disabled={isLoading}>SKIP TO LOGBOOK</button>
          </div>
        </div>
      </div>
    )
  };

  // Screen: Done
  const ScreenDone = () => {
    const handleOpenLogbook = async () => {
      await onOnboardingComplete({
        licenceType: formData.licenseType,
        organization: formData.organization
      })
    }

    return (
      <div className="onb-done">
        <div className="onb-done-icon">✅</div>
        <div className="onb-done-ttl">YOU'RE READY TO FLY</div>
        <div className="onb-done-sub">Your logbook is set up and ready.<br/>Start logging your first flight now.</div>
        <div className="onb-done-pills">
          <span className="onb-badge onb-badge-green">✓ ACCOUNT CREATED</span>
          <span className="onb-badge onb-badge-blue">✓ CLOUD SYNC ON</span>
          <span className="onb-badge onb-badge-blue">✓ DATA SECURED</span>
        </div>
        <button className="onb-btn onb-btn-done" onClick={handleOpenLogbook} disabled={isLoading}>
          {isLoading ? 'LOADING...' : 'OPEN MY LOGBOOK →'}
        </button>
      </div>
    )
  };

  // Progress bar & dots
  const signupModes = ['signup1', 'emailVerification', 'signup2', 'done'];
  const signupIndex = signupModes.indexOf(authMode);
  const showProgress = signupIndex >= 0;
  const progressPercent = showProgress ? ((signupIndex + 1) / signupModes.length) * 100 : 0;

  const screens = {
    landing: <ScreenLanding />,
    login: <ScreenLogin />,
    signup1: <ScreenSignUp1 />,
    emailVerification: <ScreenEmailVerification />,
    signup2: <ScreenSignUp2 />,
    done: <ScreenDone />
  };

  return (
    <div>
      <style>{styles}</style>
      {showProgress && (
        <>
          <div className="onb-prog-bar">
            <div className="onb-prog-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="onb-dots">
            {signupModes.map((mode, i) => (
              <div
                key={i}
                className={`onb-dot ${i < signupIndex ? 'done' : i === signupIndex ? 'active' : ''}`}
              ></div>
            ))}
          </div>
        </>
      )}
      <div className="onb-container">
        {Object.entries(screens).map(([mode, component]) => (
          <div key={mode} className={`onb-screen ${authMode === mode ? 'active' : ''}`}>
            {component}
          </div>
        ))}
      </div>
    </div>
  );
}
