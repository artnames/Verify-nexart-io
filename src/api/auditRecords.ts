/**
 * Audit Records API - Storage and retrieval for Certified Execution Records
 */

import { supabase } from '@/integrations/supabase/client';
import { canonicalize, computeCertificateHash } from '@/lib/canonicalize';
import { 
  normalizeHash, 
  resolveExpectedImageHash, 
  resolveExpectedAnimationHash 
} from '@/lib/hashResolver';
import type { 
  CERBundle, 
  AuditRecordRow, 
  ImportSource, 
  RenderStatus,
  AuditMode 
} from '@/types/auditRecord';
import { 
  validateCERBundle, 
  extractTitle, 
  extractStatement, 
  extractClaimType,
  extractSubject 
} from '@/types/auditRecord';

// Re-export normalizeHash for backwards compatibility
export { normalizeHash } from '@/lib/hashResolver';

/**
 * Get an audit record by its certificate hash
 */
export async function getAuditRecordByHash(hash: string): Promise<AuditRecordRow | null> {
  const normalizedHash = normalizeHash(hash);
  if (!normalizedHash) return null;
  
  const { data, error } = await supabase
    .from('audit_records')
    .select('*')
    .eq('certificate_hash', normalizedHash)
    .maybeSingle();
    
  if (error) {
    console.error('[AuditAPI] Error fetching record:', error);
    return null;
  }
  
  return data as AuditRecordRow | null;
}

/**
 * List audit records with optional filters
 */
export async function listAuditRecords(options?: {
  limit?: number;
  offset?: number;
  renderStatus?: RenderStatus;
  claimType?: string;
}): Promise<AuditRecordRow[]> {
  let query = supabase
    .from('audit_records')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }
  
  if (options?.renderStatus) {
    query = query.eq('render_status', options.renderStatus);
  }
  
  if (options?.claimType) {
    query = query.eq('claim_type', options.claimType);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[AuditAPI] Error listing records:', error);
    return [];
  }
  
  return (data || []) as AuditRecordRow[];
}

/**
 * Import a bundle and store as an audit record
 */
export async function importAuditRecord(
  bundle: CERBundle,
  source: ImportSource
): Promise<{ 
  success: boolean; 
  certificateHash?: string; 
  error?: string;
  authRequired?: boolean;
}> {
  // Validate bundle
  const validation = validateCERBundle(bundle);
  if (!validation.valid) {
    return { 
      success: false, 
      error: `Invalid bundle: ${validation.errors.join(', ')}` 
    };
  }
  
  // Compute canonical JSON and certificate hash
  const canonicalJson = canonicalize(bundle);
  const certificateHash = await computeCertificateHash(bundle);
  
  // Check if record already exists
  const existing = await getAuditRecordByHash(certificateHash);
  if (existing) {
    return { 
      success: true, 
      certificateHash,
      error: 'Record already exists'
    };
  }
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      certificateHash,
      error: 'Authentication required to import records',
      authRequired: true,
    };
  }
  
  // Use shared hash resolver for consistent hash extraction
  const expectedImageHash = resolveExpectedImageHash(bundle);
  const expectedAnimationHash = resolveExpectedAnimationHash(bundle);
  
  // Prepare record
  const record: Record<string, unknown> = {
    certificate_hash: certificateHash,
    bundle_version: bundle.bundleVersion || 'unknown',
    mode: validation.mode || 'static',
    bundle_created_at: bundle.createdAt || null,
    claim_type: extractClaimType(bundle),
    title: extractTitle(bundle)?.slice(0, 500) || null,
    statement: extractStatement(bundle)?.slice(0, 2000) || null,
    subject: extractSubject(bundle)?.slice(0, 200) || null,
    expected_image_hash: expectedImageHash,
    expected_animation_hash: expectedAnimationHash,
    certificate_verified: true,
    render_status: validation.hasSnapshot && expectedImageHash ? 'PENDING' : 'SKIPPED',
    bundle_json: bundle as unknown,
    canonical_json: canonicalJson,
    import_source: source,
    imported_by: user.id,
  };
  
  const { error } = await supabase
    .from('audit_records')
    .insert(record as never);
    
  if (error) {
    console.error('[AuditAPI] Error inserting record:', error);
    return { 
      success: false, 
      certificateHash,
      error: `Database error: ${error.message}` 
    };
  }
  
  return { success: true, certificateHash };
}

/**
 * Update render verification status for a record
 */
export async function updateRenderStatus(
  certificateHash: string,
  status: RenderStatus,
  renderVerified?: boolean
): Promise<boolean> {
  // Note: This will fail due to RLS (no updates allowed)
  // This is intentional - audit records are immutable
  // For status updates, we'd need a separate verification_logs table
  console.warn('[AuditAPI] Render status updates are not allowed - records are immutable');
  return false;
}

/**
 * Response from the fetch-bundle edge function
 */
interface FetchBundleProxyResponse {
  ok: boolean;
  bundle?: unknown;
  fetchedFrom?: string;
  upstreamStatus?: number;
  requestId?: string;
  error?: string;
  message?: string;
  bodyPreview?: string;
  suggestion?: string;
}

/**
 * Fetch bundle from a URL via the server-side proxy to avoid CORS issues
 */
export async function fetchBundleFromUrl(url: string): Promise<{
  success: boolean;
  bundle?: CERBundle;
  error?: string;
  errorCode?: string;
  fetchedFrom?: string;
  upstreamStatus?: number;
  requestId?: string;
  bodyPreview?: string;
  suggestion?: string;
}> {
  try {
    // Use direct fetch to the edge function with URL as query param
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-bundle?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    
    const result: FetchBundleProxyResponse = await response.json();
    
    if (!result.ok || !result.bundle) {
      return { 
        success: false, 
        error: result.message || result.error || 'Failed to fetch bundle',
        errorCode: result.error,
        fetchedFrom: result.fetchedFrom,
        upstreamStatus: result.upstreamStatus,
        requestId: result.requestId,
        bodyPreview: result.bodyPreview,
        suggestion: result.suggestion,
      };
    }
    
    // Validate the fetched bundle
    const validation = validateCERBundle(result.bundle as CERBundle);
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Invalid bundle: ${validation.errors.join(', ')}`,
        fetchedFrom: result.fetchedFrom,
        upstreamStatus: result.upstreamStatus,
        requestId: result.requestId,
      };
    }
    
    return { 
      success: true, 
      bundle: result.bundle as CERBundle,
      fetchedFrom: result.fetchedFrom,
      upstreamStatus: result.upstreamStatus,
      requestId: result.requestId,
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Parse and validate a bundle from JSON string
 */
export function parseBundleJson(jsonString: string): {
  success: boolean;
  bundle?: CERBundle;
  error?: string;
  validation?: ReturnType<typeof validateCERBundle>;
} {
  let bundle: CERBundle;
  
  try {
    bundle = JSON.parse(jsonString);
  } catch {
    return { success: false, error: 'Invalid JSON format' };
  }
  
  const validation = validateCERBundle(bundle);
  
  if (!validation.valid) {
    return { 
      success: false, 
      error: `Missing required fields: ${validation.errors.join(', ')}`,
      validation,
    };
  }
  
  return { success: true, bundle, validation };
}
