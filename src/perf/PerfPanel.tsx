import { useEffect, useState, type CSSProperties } from 'react'
import { hitchSummary } from '@/core/hitchLog'
import { hitchLog, hitchReport } from './perfRecorder'

const panel: CSSProperties = {
  position: 'fixed',
  left: 8,
  // Above the title's settings button.
  bottom: 60,
  zIndex: 1000,
  maxWidth: 'calc(100vw - 16px)',
  padding: '6px 8px',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.72)',
  color: '#fff',
  font: '11px/1.4 ui-monospace, Menlo, monospace',
}

const button: CSSProperties = { marginTop: 4, font: 'inherit', padding: '2px 8px', cursor: 'pointer' }

/** `?perf=1` (#536): the hitch log's headline, refreshed twice a second, and Copy report for pasting into an issue. */
export default function PerfPanel() {
  const [summary, setSummary] = useState(() => hitchSummary(hitchLog))
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setSummary(hitchSummary(hitchLog)), 500)
    return () => window.clearInterval(id)
  }, [])

  const copy = () => {
    const text = hitchReport()
    if (!navigator.clipboard) {
      setFallback(text)
      return
    }
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setFallback(text),
    )
  }

  return (
    <div style={panel} data-no-fire data-testid="perf-panel">
      <div>perf: {summary}</div>
      <button type="button" style={button} onClick={copy}>
        {copied ? 'Copied' : 'Copy report'}
      </button>
      {fallback !== null && (
        // Clipboard refused (an insecure origin, an old browser): the report to select and copy by hand.
        <textarea
          readOnly
          value={fallback}
          rows={8}
          style={{ display: 'block', width: '80vw', marginTop: 4, font: 'inherit' }}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
        />
      )}
    </div>
  )
}
