-- Add upstream diagnostic columns to recertification_runs for audit traceability
ALTER TABLE public.recertification_runs
  ADD COLUMN IF NOT EXISTS upstream_body text,
  ADD COLUMN IF NOT EXISTS node_request_id text,
  ADD COLUMN IF NOT EXISTS attempted_at timestamp with time zone DEFAULT now();