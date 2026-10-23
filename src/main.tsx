import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { track } from '@vercel/analytics'
import { Analytics } from '@vercel/analytics/react'
import App from './app/App'
import { analyticsEventFor } from './app/analyticsEvents'
import { analyticsEnabled } from './app/analyticsGate'
import './app/global.css'
import { useGameStore } from './store/useGameStore'
import { installE2EApi } from './testing/e2eHook'

installE2EApi()

const analyticsOn = analyticsEnabled(__BUILT_ON_VERCEL__, window.location.search)
if (analyticsOn) {
  useGameStore.subscribe((next, prev) => {
    const event = analyticsEventFor(prev, next)
    if (event) track(event.name, event.props)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {analyticsOn && <Analytics />}
  </StrictMode>,
)
