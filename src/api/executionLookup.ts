/**
 * Execution ID Lookup — resolves an executionId to a CER bundle
 * by querying the public-certificate endpoint via the fetch-bundle proxy.
 *
 * This uses the same public-safe CER storage path populated by
 * the Decision Certifier after /v1/cer/ai/certify.
 */

import { fetchBundleFromUrl } from '@/api/auditRecords';
import type { CERBundle } from '@/types/auditRecord';
import type { WrapperMetadata } from '@/api/auditRecords';

export interface ExecutionLookupResult {
  success: boolean;
  bundle?: CERBundle;
  certificateHash?: string;
  error?: string;
  wrapperMetadata?: WrapperMetadata;
}

/**
 * Look up a public CER record by its execution ID.
 * Routes through the fetch-bundle proxy → Decision Certifier public-certificate endpoint.
 */
export async function lookupByExecutionId(executionId: string): Promise<ExecutionLookupResult> {
  if (!executionId || typeof executionId !== 'string' || executionId.trim().length === 0) {
    return { success: false, error: 'No execution ID provided.' };
  }

  try {
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-bundle?executionId=${encodeURIComponent(executionId.trim())}`;

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    const result = await response.json();

    // Safety net: if the proxy didn't unwrap, extract nested bundle
    let bundleData = result.bundle;
    if (bundleData && typeof bundleData === 'object' && typeof bundleData.bundle === 'object' && bundleData.bundle !== null) {
      console.warn('[ExecutionLookup] Client-side unwrap: proxy returned nested wrapper');
      bundleData = bundleData.bundle;
    }

    if (!result.ok || !bundleData) {
      const rawMsg = result.message || result.error || `No record found for execution ID: ${executionId}`;
      return {
        success: false,
        error: rawMsg,
      };
    }

    const bundle = result.bundle as CERBundle;

    // Extract certificateHash from wrapper metadata or from the bundle itself
    const certificateHash =
      result.wrapperMetadata?.certificateHash ||
      (bundle as Record<string, unknown>).certificateHash as string ||
      undefined;

    return {
      success: true,
      bundle,
      certificateHash,
      wrapperMetadata: result.wrapperMetadata,
    };
  } catch (err) {
    console.error('[ExecutionLookup] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
