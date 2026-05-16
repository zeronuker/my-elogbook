import { useState, useEffect } from 'react'

function LoadingOverlay({ countdown }) {
  const [message, setMessage] = useState('Setting up your logbook...')

  useEffect(() => {
    switch (countdown) {
      case 3:
        setMessage('Setting up your logbook...')
        break
      case 2:
        setMessage('Syncing your profile...')
        break
      case 1:
        setMessage('Finalizing your account...')
        break
      default:
        setMessage('Setting up your logbook...')
    }
  }, [countdown])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#0a0d12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        flexDirection: 'column',
        gap: '24px'
      }}
    >
      {/* Rotating Spinner */}
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(79, 195, 247, 0.2)',
          borderTop: '3px solid #4fc3f7',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />

      {/* Message */}
      <div
        style={{
          color: '#4fc3f7',
          fontFamily: 'Courier New',
          fontSize: '14px',
          fontWeight: '500',
          textAlign: 'center',
          minHeight: '20px'
        }}
      >
        {message}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export default LoadingOverlay
