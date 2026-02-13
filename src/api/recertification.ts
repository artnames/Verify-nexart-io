/**
 * Recertification API - Client-side functions for canonical re-certification
 */

import { supabase } from '@/integrations/supabase/client';
import type { CERBundle } from '@/types/auditRecord';

/**
 * Recertification run result from the database
 */
export interface RecertificationRun {
  id: string;
  record_id: string;
  created_at: string;
  node_endpoint: string;
  protocol_version: string | null;
  protocol_defaulted: boolean;
  runtime_hash: string | null;
  output_hash: string | null;
  expected_hash: string | null;
  status: 'pass' | 'fail' | 'error' | 'skipped';
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
  request_fingerprint: string | null;
  upstream_body?: string | null;
  node_request_id?: string | null;
  attempted_at?: string | null;
}

/**
 * Response from the recertify edge function
 */
export interface RecertifyResponse {
  ok: boolean;
  status: 'pass' | 'fail' | 'error' | 'skipped';
  outputHash?: string;
  expectedHash?: string;
  match?: boolean;
  protocolVersion?: string;
  protocolDefaulted?: boolean;
  runtimeHash?: string;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  reason?: string;
  message?: string;
  durationMs?: number;
  requestFingerprint?: string;
  requestId?: string;
}

/**
 * Trigger canonical re-certification for a bundle
 */
export async function recertifyBundle(
  recordId: string,
  bundle: CERBundle,
  sourceUrl?: string,
  expectedHash?: string
): Promise<RecertifyResponse> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recertify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          recordId,
          bundle,
          sourceUrl,
          expectedHash,
        }),
      }
    );

    const result = await response.json();
    return result as RecertifyResponse;
  } catch (error) {
    console.error('[RecertifyAPI] Error:', error);
    return {
      ok: false,
      status: 'error',
      errorCode: 'NETWORK_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get recertification runs for a record
 */
export async function getRecertificationRuns(recordId: string): Promise<RecertificationRun[]> {
  const { data, error } = await supabase
    .from('recertification_runs')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[RecertifyAPI] Error fetching runs:', error);
    return [];
  }

  return (data || []) as unknown as RecertificationRun[];
}

/**
 * Get the latest recertification run for a record
 */
export async function getLatestRecertificationRun(recordId: string): Promise<RecertificationRun | null> {
  const { data, error } = await supabase
    .from('recertification_runs')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RecertifyAPI] Error fetching latest run:', error);
    return null;
  }

  return data as unknown as RecertificationRun | null;
}
