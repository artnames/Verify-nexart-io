-- Fix: Restrict recertification_runs SELECT to authenticated users only
-- This hides infrastructure details (node_endpoint, upstream_body, error_message) from anonymous access

DROP POLICY IF EXISTS "Public read access for recertification runs" ON public.recertification_runs;

CREATE POLICY "Authenticated users can read recertification runs"
ON public.recertification_runs
FOR SELECT
TO authenticated
USING (true);