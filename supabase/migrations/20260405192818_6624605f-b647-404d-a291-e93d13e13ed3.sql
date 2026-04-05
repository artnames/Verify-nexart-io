-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public read access for audit records" ON public.audit_records;

-- Replace with authenticated-only SELECT
CREATE POLICY "Authenticated users can read audit records"
  ON public.audit_records
  FOR SELECT
  TO authenticated
  USING (true);