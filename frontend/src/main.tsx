import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { applyTheme, useThemeStore } from './store/theme'
import './styles/index.css'

// Theme initial anwenden + auf System-Wechsel reagieren (nur im System-Modus).
applyTheme(useThemeStore.getState().theme)
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useThemeStore.getState().theme === 'system') applyTheme('system')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
