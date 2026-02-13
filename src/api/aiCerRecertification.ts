/**
 * AI CER Recertification API - Client-side functions for AI execution attestation
 */

import type { AICERBundle } from '@/types/aiCerBundle';
import { validateAICERForAttestation } from '@/types/aiCerBundle';
import type { AICERRecertifyResponse } from '@/components/AICERRecertificationStatus';

/**
 * Pre-flight validation result
 */
export interface AttestationPreflightResult {
  attestable: boolean;
  missingFields: string[];
}

/**
 * Validate an AI CER bundle for attestation (client-side preflight).
 */
export function preflightAttestationCheck(bundle: unknown): AttestationPreflightResult {
  return validateAICERForAttestation(bundle);
}

/**
 * Request canonical attestation for an AI CER bundle.
 * 
 * Sends the full bundle object (minus sensitive input/output) to the edge function,
 * which forwards it to the canonical node's /api/attest endpoint.
 */
export async function recertifyAICER(
  recordId: string,
  bundle: AICERBundle,
): Promise<AICERRecertifyResponse> {
  // Client-side preflight
  const preflight = validateAICERForAttestation(bundle);
  if (!preflight.attestable) {
    return {
      ok: false,
      status: 'skipped',
      errorCode: 'PREFLIGHT_FAILED',
      errorMessage: `Missing required fields: ${preflight.missingFields.join(', ')}`,
    };
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recertify-ai-cer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ recordId, bundle }),
      }
    );

    const result = await response.json();
    return result as AICERRecertifyResponse;
  } catch (error) {
    console.error('[AIRecertifyAPI] Error:', error);
    return {
      ok: false,
      status: 'error',
      errorCode: 'NETWORK_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Network error',
    };
  }
}
