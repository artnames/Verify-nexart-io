/**
 * AI CER Recertification API - Client-side functions for AI execution attestation
 */

import type { AICERBundle } from '@/types/aiCerBundle';
import type { AICERRecertifyResponse } from '@/components/AICERRecertificationStatus';

/**
 * Request canonical attestation for an AI CER bundle
 */
export async function recertifyAICER(
  recordId: string,
  bundle: AICERBundle,
): Promise<AICERRecertifyResponse> {
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
