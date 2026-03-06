/**
 * Execution ID Lookup — resolves an executionId to a CER bundle
 * by querying audit_records where bundle_json->'snapshot'->>'executionId' matches.
 */

import { supabase } from '@/integrations/supabase/client';
import type { CERBundle } from '@/types/auditRecord';

export interface ExecutionLookupResult {
  success: boolean;
  bundle?: CERBundle;
  certificateHash?: string;
  error?: string;
}

/**
 * Look up an audit record by its execution ID (stored in bundle_json->snapshot->executionId).
 * Uses the public SELECT RLS policy on audit_records.
 */
export async function lookupByExecutionId(executionId: string): Promise<ExecutionLookupResult> {
  if (!executionId || typeof executionId !== 'string' || executionId.trim().length === 0) {
    return { success: false, error: 'No execution ID provided.' };
  }

  try {
    const { data, error } = await supabase
      .from('audit_records')
      .select('certificate_hash, bundle_json')
      .filter('bundle_json->snapshot->>executionId', 'eq', executionId.trim())
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[ExecutionLookup] Query error:', error);
      return { success: false, error: 'Database query failed.' };
    }

    if (!data) {
      return { success: false, error: `No record found for execution ID: ${executionId}` };
    }

    return {
      success: true,
      bundle: data.bundle_json as unknown as CERBundle,
      certificateHash: data.certificate_hash,
    };
  } catch (err) {
    console.error('[ExecutionLookup] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
