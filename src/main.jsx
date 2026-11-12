import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Tooltip from './Tooltip.jsx'
import { installKeyboardArea } from './keyboardArea'

installKeyboardArea()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Tooltip />
  </StrictMode>,
)
