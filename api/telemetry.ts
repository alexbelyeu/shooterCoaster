/** Real-player telemetry (#373): POST a page load's report, GET the last 24 hours' summary. Setup: docs/TELEMETRY.md. */
import { getSummary, postReport, type TelemetryDeps } from './_lib/telemetryHandler.js'
import { telemetryDb } from './_lib/telemetryDb.js'

const deps = (): TelemetryDeps => ({ db: telemetryDb(process.env), salt: process.env.SUPABASE_SECRET_KEY ?? '', now: Date.now, random: Math.random })

export function GET(request: Request): Promise<Response> {
  return getSummary(request, deps())
}

export function POST(request: Request): Promise<Response> {
  return postReport(request, deps())
}
