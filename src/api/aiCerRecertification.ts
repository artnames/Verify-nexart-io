/**
 * AI CER Recertification API - Client-side functions for AI execution attestation
 */

import type { AICERBundle } from '@/types/aiCerBundle';
import { validateAICERForAttestation } from '@/types/aiCerBundle';
import type { AICERRecertifyResponse } from '@/components/AICERRecertificationStatus';
import { stripSensitiveForAttestation, findUndefinedPaths } from '@/lib/attestationSanitize';

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
 * Strips sensitive fields (input/output/prompt) via delete (not undefined assignment),
 * then runs removeUndefinedDeep to guarantee no undefined values reach the node.
 */
export async function recertifyAICER(
  recordId: string,
  bundle: AICERBundle,
): Promise<AICERRecertifyResponse> {
  // Client-side preflight — schema validation
  const preflight = validateAICERForAttestation(bundle);
  if (!preflight.attestable) {
    return {
      ok: false,
      status: 'skipped',
      errorCode: 'PREFLIGHT_FAILED',
      errorMessage: `Missing required fields: ${preflight.missingFields.join(', ')}`,
    };
  }

  // Sanitize: deep-clone, delete sensitive keys, strip any remaining undefined
  const sanitizedBundle = stripSensitiveForAttestation(bundle);

  // Preflight: check for any remaining undefined paths
  const undefinedPaths = findUndefinedPaths(sanitizedBundle);
  if (undefinedPaths.length > 0) {
    console.error('[AIRecertifyAPI] Payload contains undefined paths:', undefinedPaths);
    return {
      ok: false,
      status: 'error',
      errorCode: 'INVALID_PAYLOAD',
      errorMessage: `Attestation payload contains unsupported fields (undefined): ${undefinedPaths.join(', ')}`,
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
        body: JSON.stringify({ recordId, bundle: sanitizedBundle }),
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
