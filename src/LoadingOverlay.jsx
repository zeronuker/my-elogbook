function LoadingOverlay() {
  const message = 'Setting up your logbook...'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#0a1020',
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
          border: '3px solid rgba(63, 224, 197, 0.15)',
          borderTop: '3px solid #3FE0C5',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />

      {/* Message */}
      <div
        style={{
          color: '#3FE0C5',
          fontFamily: "'JetBrains Mono', monospace",
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
