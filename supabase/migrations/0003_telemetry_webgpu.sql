-- Player telemetry's WebGPU yes/no (#850): could the player's browser have run WebGPU (an adapter, never a device).
-- null = unknown (the check hadn't answered when the tab was hidden, or the report came from before #850).
-- Run once in the Supabase SQL editor (docs/TELEMETRY.md). Until it runs, /api/telemetry stores reports without it.
alter table public.telemetry_reports add column if not exists webgpu boolean;
