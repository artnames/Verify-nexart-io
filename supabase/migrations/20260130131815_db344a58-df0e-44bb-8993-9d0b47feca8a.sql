-- Create table for storing canonical recertification results
CREATE TABLE public.recertification_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.audit_records(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Node/endpoint info (for traceability)
  node_endpoint TEXT NOT NULL,
  
  -- Protocol metadata
  protocol_version TEXT,
  protocol_defaulted BOOLEAN DEFAULT false,
  
  -- Runtime and output hashes
  runtime_hash TEXT,
  output_hash TEXT,
  expected_hash TEXT,
  
  -- Status: pass, fail, error, skipped
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'error', 'skipped')),
  
  -- HTTP response info
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  
  -- Timing
  duration_ms INTEGER,
  
  -- Request fingerprint (hash of snapshot inputs)
  request_fingerprint TEXT
);

-- Enable RLS
ALTER TABLE public.recertification_runs ENABLE ROW LEVEL SECURITY;

-- Public read access for transparency
CREATE POLICY "Public read access for recertification runs"
ON public.recertification_runs
FOR SELECT
USING (true);

-- Authenticated users can create runs
CREATE POLICY "Authenticated users can create recertification runs"
ON public.recertification_runs
FOR INSERT
WITH CHECK (true);

-- No updates allowed - runs are immutable
CREATE POLICY "No updates - recertification runs are immutable"
ON public.recertification_runs
FOR UPDATE
USING (false);

-- No deletes allowed - runs are permanent
CREATE POLICY "No deletes - recertification runs are permanent"
ON public.recertification_runs
FOR DELETE
USING (false);

-- Create index on record_id for efficient lookups
CREATE INDEX idx_recertification_runs_record_id ON public.recertification_runs(record_id);

-- Create index on created_at for time-based queries
CREATE INDEX idx_recertification_runs_created_at ON public.recertification_runs(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE public.recertification_runs IS 'Stores canonical re-certification results for imported audit records';