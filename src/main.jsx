import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './oxygen.css'
import App from './App.jsx'
import Tooltip from './Tooltip.jsx'
import { installKeyboardArea } from './keyboardArea'

installKeyboardArea()

// Scroll depth in px for the frosted sticky header (see oxygen.css, --oxy-scroll)
addEventListener('scroll', () => {
  document.documentElement.style.setProperty('--oxy-scroll', Math.round(scrollY))
}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Tooltip />
  </StrictMode>,
)
