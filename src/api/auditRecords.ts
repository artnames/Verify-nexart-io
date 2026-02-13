/**
 * Audit Records API - Storage and retrieval for Certified Execution Records
 * 
 * Hybrid approach:
 * - Reads from BOTH local storage and Supabase (merges, deduplicates by hash)
 * - Writes to local storage (no auth required)
 * - Supabase read is best-effort (may fail for anonymous users on some tables)
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
import { isAICERBundle, extractAICERTitle, extractAICERSubject } from '@/types/aiCerBundle';
import {
  listLocalRecords,
  getLocalRecordByHash,
  importLocalRecord,
  toAuditRecordRow,
} from '@/storage/localAuditLog';

// Re-export normalizeHash for backwards compatibility
export { normalizeHash } from '@/lib/hashResolver';

/**
 * Get an audit record by its certificate hash.
 * Checks local storage first, then Supabase.
 */
export async function getAuditRecordByHash(hash: string): Promise<AuditRecordRow | null> {
  const normalizedHash = normalizeHash(hash);
  if (!normalizedHash) return null;
  
  // Check local storage first
  const local = getLocalRecordByHash(normalizedHash);
  if (local) return toAuditRecordRow(local);
  
  // Fall back to Supabase (public read)
  try {
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
  } catch {
    return null;
  }
}

/**
 * List audit records — merges local + Supabase, deduplicates by hash.
 */
export async function listAuditRecords(options?: {
  limit?: number;
  offset?: number;
  renderStatus?: RenderStatus;
  claimType?: string;
}): Promise<AuditRecordRow[]> {
  const limit = options?.limit || 100;
  
  // Get local records
  const localRecords = listLocalRecords(limit).map(toAuditRecordRow);
  
  // Try Supabase (best-effort)
  let supabaseRecords: AuditRecordRow[] = [];
  try {
    let query = supabase
      .from('audit_records')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (limit) query = query.limit(limit);
    if (options?.offset) query = query.range(options.offset, options.offset + limit - 1);
    if (options?.renderStatus) query = query.eq('render_status', options.renderStatus);
    if (options?.claimType) query = query.eq('claim_type', options.claimType);
    
    const { data, error } = await query;
    if (!error && data) {
      supabaseRecords = data as AuditRecordRow[];
    }
  } catch {
    // Supabase unavailable — use local only
  }
  
  // Merge and deduplicate by certificate_hash (local wins)
  const seenHashes = new Set(localRecords.map(r => r.certificate_hash));
  const merged = [...localRecords];
  for (const r of supabaseRecords) {
    if (!seenHashes.has(r.certificate_hash)) {
      seenHashes.add(r.certificate_hash);
      merged.push(r);
    }
  }
  
  // Sort by created_at descending
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return merged.slice(0, limit);
}

/**
 * Import a bundle — saves to local storage (no auth required).
 */
export async function importAuditRecord(
  bundle: CERBundle,
  source: ImportSource,
  wrapperMetadata?: WrapperMetadata
): Promise<{ 
  success: boolean; 
  certificateHash?: string; 
  error?: string;
  authRequired?: boolean;
}> {
  return importLocalRecord(bundle, source, wrapperMetadata);
}

/**
 * Update render verification status for a record
 */
export async function updateRenderStatus(
  certificateHash: string,
  status: RenderStatus,
  renderVerified?: boolean
): Promise<boolean> {
  console.warn('[AuditAPI] Render status updates are not allowed - records are immutable');
  return false;
}

// Decision Certifier public certificate endpoint base URL
const DECISION_CERTIFIER_PUBLIC_BASE = 'https://nxjkrwcxyhftoaenyztu.supabase.co/functions/v1/public-certificate';

/**
 * Wrapper metadata from public-certificate endpoint
 */
export interface WrapperMetadata {
  source: 'public-certificate';
  certificateHash?: string;
  createdAt?: string;
  status?: string;
  expectedImageHash?: string;
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
  wrapperMetadata?: WrapperMetadata;
}

/**
 * Check if input looks like a certificate hash (not a URL)
 */
export function looksLikeHash(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.startsWith('sha256:')) {
    const hex = trimmed.slice(7);
    return /^[a-f0-9]{64}$/.test(hex);
  }
  if (/^[a-f0-9]{64}$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Build the public certificate URL for a given hash
 */
export function buildPublicCertificateUrl(hash: string): string {
  const normalized = normalizeHash(hash);
  if (!normalized) {
    throw new Error('Invalid hash format');
  }
  return `${DECISION_CERTIFIER_PUBLIC_BASE}/sha256:${normalized}`;
}

/**
 * Get the Decision Certifier public endpoint base URL
 */
export function getDecisionCertifierBaseUrl(): string {
  return DECISION_CERTIFIER_PUBLIC_BASE;
}

/**
 * Fetch bundle from a URL or hash via the server-side proxy
 */
export async function fetchBundleFromUrl(urlOrHash: string): Promise<{
  success: boolean;
  bundle?: CERBundle;
  error?: string;
  errorCode?: string;
  fetchedFrom?: string;
  upstreamStatus?: number;
  requestId?: string;
  bodyPreview?: string;
  suggestion?: string;
  constructedUrl?: string;
  wrapperMetadata?: WrapperMetadata;
}> {
  try {
    let queryParam: string;
    let constructedUrl: string | undefined;
    
    if (looksLikeHash(urlOrHash)) {
      queryParam = `hash=${encodeURIComponent(urlOrHash)}`;
      try {
        constructedUrl = buildPublicCertificateUrl(urlOrHash);
      } catch {
        // continue
      }
    } else {
      queryParam = `url=${encodeURIComponent(urlOrHash)}`;
    }
    
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-bundle?${queryParam}`;
    
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
        constructedUrl,
      };
    }
    
    const validation = validateCERBundle(result.bundle as CERBundle);
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Invalid bundle: ${validation.errors.join(', ')}`,
        fetchedFrom: result.fetchedFrom,
        upstreamStatus: result.upstreamStatus,
        requestId: result.requestId,
        constructedUrl,
      };
    }
    
    return { 
      success: true, 
      bundle: result.bundle as CERBundle,
      fetchedFrom: result.fetchedFrom,
      upstreamStatus: result.upstreamStatus,
      requestId: result.requestId,
      constructedUrl,
      wrapperMetadata: result.wrapperMetadata,
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
