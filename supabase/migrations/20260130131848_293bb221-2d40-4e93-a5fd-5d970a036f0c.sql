-- Drop and recreate the INSERT policy to require authenticated users explicitly
DROP POLICY IF EXISTS "Authenticated users can create recertification runs" ON public.recertification_runs;

CREATE POLICY "Authenticated users can create recertification runs"
ON public.recertification_runs
FOR INSERT
TO authenticated
WITH CHECK (true);