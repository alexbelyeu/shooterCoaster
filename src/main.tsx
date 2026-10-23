import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { track } from '@vercel/analytics'
import { Analytics } from '@vercel/analytics/react'
import App from './app/App'
import { analyticsEventFor } from './app/analyticsEvents'
import {
  analyticsEnabled,
  applyInternalParam,
  browserStorage,
  dropInternalEvents,
  searchWithoutInternalParam,
} from './app/analyticsGate'
import './app/global.css'
import { useGameStore } from './store/useGameStore'
import { installE2EApi } from './testing/e2eHook'

installE2EApi()

const { search, pathname, hash } = window.location
const storage = browserStorage()
const internal = applyInternalParam(search, storage)
const strippedSearch = searchWithoutInternalParam(search)
if (strippedSearch !== null) {
  window.history.replaceState(window.history.state, '', pathname + strippedSearch + hash)
}

const analyticsOn = analyticsEnabled(__BUILT_ON_VERCEL__, search, internal)
if (analyticsOn) {
  useGameStore.subscribe((next, prev) => {
    const event = analyticsEventFor(prev, next)
    if (event) track(event.name, event.props)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {analyticsOn && <Analytics beforeSend={dropInternalEvents(storage)} />}
  </StrictMode>,
)
