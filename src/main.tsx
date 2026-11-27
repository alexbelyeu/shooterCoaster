import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { track } from '@vercel/analytics'
import { Analytics } from '@vercel/analytics/react'
import App from './app/App'
import { analyticsEventFor, SHARED_EVENT, shareEvent } from './app/analyticsEvents'
import type { ShareMethod } from './ui/share'
import {
  analyticsEnabled,
  applyInternalParam,
  browserStorage,
  dropInternalEvents,
  searchWithoutInternalParam,
  serviceWorkerEnabled,
} from './app/analyticsGate'
import { captureInstallPrompt } from './app/installPrompt'
import './app/global.css'
import { eventBus } from './core/EventBus'
import { markStartup } from './core/startupMarks'
import { useGameStore } from './store/useGameStore'
import { installStaleReload } from './app/staleReload'
import { installTelemetry } from './telemetry/playerTelemetry'
import { isE2E } from './testing/e2eState'
import { perfRequested } from './perf/perfFlag'

markStartup('boot')
installStaleReload()
if (perfRequested()) void import('./perf/perfRecorder').then((m) => m.startPerfRecorder())

const { search, pathname, hash } = window.location
const storage = browserStorage()
const internal = applyInternalParam(search, storage)
const strippedSearch = searchWithoutInternalParam(search)
if (strippedSearch !== null) {
  window.history.replaceState(window.history.state, '', pathname + strippedSearch + hash)
}

if (serviceWorkerEnabled(__BUILT_ON_VERCEL__, __PORTAL_BUILD__, search) && 'serviceWorker' in navigator) {
  captureInstallPrompt(window)
  window.addEventListener('load', () => void import('./app/serviceWorker').then((m) => m.registerServiceWorker()), { once: true })
}

const analyticsOn = analyticsEnabled(__BUILT_ON_VERCEL__, search, internal)
if (analyticsOn) {
  useGameStore.subscribe((next, prev) => {
    const event = analyticsEventFor(prev, next)
    if (event) track(event.name, event.props)
  })
  eventBus.on(SHARED_EVENT, (level, method, daily) => {
    const { name, props } = shareEvent(level as string, method as ShareMethod, daily === true)
    track(name, props)
  })
  installTelemetry(__APP_VERSION__, storage)
}

const mount = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      {analyticsOn && <Analytics beforeSend={dropInternalEvents(storage)} />}
    </StrictMode>,
  )

// The test hook is a lazy chunk players never load (#1113); under ?e2e=1 it is installed before React mounts, as the
// smoke and `npm run clip` expect.
if (isE2E) {
  void import('./testing/e2eHook').then((m) => {
    m.installE2EApi()
    mount()
  })
} else {
  mount()
}
