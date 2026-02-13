/**
 * AI CER Recertification API - Client-side functions for AI execution attestation
 */

import type { AICERBundle } from '@/types/aiCerBundle';
import { validateAICERForAttestation } from '@/types/aiCerBundle';
import type { AICERRecertifyResponse } from '@/components/AICERRecertificationStatus';
import { sanitizeForNode } from '@/lib/attestationSanitize';
import { getNodeApiKey } from '@/storage/nodeApiKey';

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

  // Sanitize: single pipeline — clone, strip sensitive, removeUndefinedDeep, validate
  const { payload: sanitizedBundle, undefinedPaths } = sanitizeForNode(bundle);

  if (undefinedPaths.length > 0) {
    console.error('[AIRecertifyAPI] Payload contains undefined paths:', undefinedPaths);
    return {
      ok: false,
      status: 'error',
      errorCode: 'INVALID_PAYLOAD',
      errorMessage: `Cannot attest: payload contains unsupported values (undefined).`,
      undefinedPaths: undefinedPaths.slice(0, 20),
      sanitizedPayload: sanitizedBundle,
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
    
    const nodeKey = getNodeApiKey();
    if (nodeKey) {
      headers['X-Node-Api-Key'] = nodeKey;
    }
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recertify-ai-cer`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ recordId, bundle: sanitizedBundle }),
      }
    );

    const result = await response.json();
    return { ...result, sanitizedPayload: sanitizedBundle } as AICERRecertifyResponse;
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
