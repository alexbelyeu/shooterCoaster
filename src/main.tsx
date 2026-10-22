import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './app/App'
import { analyticsEnabled } from './app/analyticsGate'
import './app/global.css'
import { installE2EApi } from './testing/e2eHook'

installE2EApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {analyticsEnabled(__BUILT_ON_VERCEL__, window.location.search) && <Analytics />}
  </StrictMode>,
)
