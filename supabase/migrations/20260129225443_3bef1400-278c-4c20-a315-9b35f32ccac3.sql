-- Create audit_records table for Certified Execution Records
CREATE TABLE public.audit_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_hash text NOT NULL UNIQUE,
  bundle_version text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('static', 'loop', 'decision', 'attestation')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  bundle_created_at timestamp with time zone,
  
  -- Claim/Input data
  claim_type text,
  title text CHECK (title IS NULL OR length(title) <= 500),
  statement text CHECK (statement IS NULL OR length(statement) <= 2000),
  subject text CHECK (subject IS NULL OR length(subject) <= 200),
  
  -- Hashes
  expected_image_hash text,
  expected_animation_hash text,
  
  -- Verification status
  certificate_verified boolean DEFAULT false,
  render_verified boolean,
  render_status text CHECK (render_status IS NULL OR render_status IN ('PENDING', 'VERIFIED', 'FAILED', 'SKIPPED')),
  last_verified_at timestamp with time zone,
  
  -- Full bundle storage
  bundle_json jsonb NOT NULL CHECK (octet_length(bundle_json::text) <= 500000),
  canonical_json text NOT NULL CHECK (octet_length(canonical_json) <= 500000),
  
  -- Metadata
  import_source text CHECK (import_source IN ('hash', 'url', 'upload', 'internal')),
  imported_by uuid REFERENCES auth.users(id),
  
  -- Indexes for common queries
  CONSTRAINT valid_certificate_hash CHECK (certificate_hash ~ '^[a-f0-9]{64}$')
);

-- Create indexes
CREATE INDEX idx_audit_records_created_at ON public.audit_records(created_at DESC);
CREATE INDEX idx_audit_records_certificate_hash ON public.audit_records(certificate_hash);
CREATE INDEX idx_audit_records_claim_type ON public.audit_records(claim_type);
CREATE INDEX idx_audit_records_render_status ON public.audit_records(render_status);

-- Enable RLS
ALTER TABLE public.audit_records ENABLE ROW LEVEL SECURITY;

-- Public read access for audit transparency
CREATE POLICY "Public read access for audit records"
  ON public.audit_records FOR SELECT
  USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated users can insert audit records"
  ON public.audit_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No updates allowed - records are immutable
CREATE POLICY "No updates - audit records are immutable"
  ON public.audit_records FOR UPDATE
  USING (false);

-- No deletes allowed - records are permanent
CREATE POLICY "No deletes - audit records are permanent"
  ON public.audit_records FOR DELETE
  USING (false);