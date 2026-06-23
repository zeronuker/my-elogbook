const MINT = 'var(--cb-mint)'

const chev = (top, right, bottom, left) => ({
  position: 'absolute',
  width: 13,
  height: 13,
  ...(top    != null ? { top }    : { bottom }),
  ...(left   != null ? { left }   : { right }),
  borderTop:    top    != null ? `1.5px solid ${MINT}` : undefined,
  borderBottom: bottom != null ? `1.5px solid ${MINT}` : undefined,
  borderLeft:   left   != null ? `1.5px solid ${MINT}` : undefined,
  borderRight:  right  != null ? `1.5px solid ${MINT}` : undefined,
})

export default function BrandBanner({ subtitle = 'PILOT UTILITY SUITE' }) {
  return (
    <div className="cb-banner" style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '1px 20px',
      flexShrink: 0,
    }}>
      <div style={chev(8, undefined, undefined, 8)} />
      <div style={chev(8, 8, undefined, undefined)} />
      <div style={chev(undefined, undefined, 8, 8)} />
      <div style={chev(undefined, 8, 8, undefined)} />

      <div className="cb-banner-bigc" style={{
        fontFamily: "'Tourney', sans-serif",
        fontWeight: 900,
        fontSize: 58,
        lineHeight: 1,
        color: 'transparent',
        WebkitTextStroke: `2px ${MINT}`,
        flexShrink: 0,
      }}>C</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
        <svg className="cb-banner-wordmark" width="242" height="30" viewBox="0 0 560 70" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cb-banner-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   style={{ stopColor: 'var(--cb-mint)' }} />
              <stop offset="55%"  style={{ stopColor: 'var(--cb-blue)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--cb-violet)' }} />
            </linearGradient>
          </defs>
          <text
            x="280" y="52"
            textAnchor="middle"
            fontFamily="Tourney, sans-serif"
            fontWeight="700"
            fontSize="58"
            fill="none"
            stroke="url(#cb-banner-grad)"
            strokeWidth="3"
          >CLAUDEBORNE</text>
        </svg>
        <div style={{ width: '100%', height: 1, background: 'var(--cb-line-2)' }} />
        <div style={{
          fontFamily: "'Chakra Petch', sans-serif",
          fontWeight: 600,
          fontSize: 10,
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          color: 'var(--cb-blue)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>{subtitle}</div>
      </div>
    </div>
  )
}
