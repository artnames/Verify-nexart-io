/**
 * Hash Resolution Utility for CER Bundles
 * 
 * Single source of truth for resolving expected image/animation hashes
 * from various bundle formats and locations.
 */

import type { CERBundle } from '@/types/auditRecord';

/**
 * Normalize a hash value:
 * - Strip optional "sha256:" prefix
 * - Lowercase for comparison
 * 
 * @param hash - Raw hash value (may have prefix)
 * @returns Normalized 64-char hex string or null
 */
export function normalizeHash(hash: string | null | undefined): string | null {
  if (!hash || typeof hash !== 'string') return null;
  const normalized = hash.replace(/^sha256:/i, '').toLowerCase().trim();
  // Validate it's a valid 64-char hex string
  if (!/^[a-f0-9]{64}$/.test(normalized)) return null;
  return normalized;
}

/**
 * Format a hash for display with sha256: prefix
 * 
 * @param hash - Normalized hash (64-char hex)
 * @returns Hash with sha256: prefix for display
 */
export function formatHashForDisplay(hash: string | null | undefined): string {
  if (!hash) return '(none)';
  const normalized = normalizeHash(hash);
  if (!normalized) return '(invalid)';
  return `sha256:${normalized}`;
}

/**
 * Truncate a hash for compact display
 * 
 * @param hash - Full hash value
 * @param prefixLen - Characters to show at start
 * @param suffixLen - Characters to show at end
 * @returns Truncated hash like "abc123...def456"
 */
export function truncateHash(
  hash: string | null | undefined, 
  prefixLen = 8, 
  suffixLen = 8
): string {
  if (!hash) return '(none)';
  const normalized = normalizeHash(hash);
  if (!normalized) return '(invalid)';
  if (normalized.length <= prefixLen + suffixLen + 3) return normalized;
  return `${normalized.slice(0, prefixLen)}...${normalized.slice(-suffixLen)}`;
}

/**
 * Compare two hashes after normalization
 * 
 * @param hash1 - First hash (may have prefix)
 * @param hash2 - Second hash (may have prefix)
 * @returns true if hashes match after normalization
 */
export function hashesMatch(
  hash1: string | null | undefined, 
  hash2: string | null | undefined
): boolean {
  const n1 = normalizeHash(hash1);
  const n2 = normalizeHash(hash2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

/**
 * Resolve the expected image hash from a CER bundle
 * 
 * Checks multiple locations in priority order:
 * 1. bundle.expectedImageHash (explicit field)
 * 2. bundle.baseline.posterHash (NexArt baseline)
 * 3. bundle.baseline.expectedImageHash (alternative name)
 * 4. bundle.baseline.imageHash (legacy name)
 * 5. bundle.posterHash (top-level legacy)
 * 6. bundle.expectedPosterHash (alternative top-level)
 * 
 * @param bundle - The CER bundle object
 * @returns Normalized 64-char hex hash or null if not found
 */
export function resolveExpectedImageHash(bundle: CERBundle): string | null {
  // Priority 1: Explicit expectedImageHash field
  if (bundle.expectedImageHash) {
    const normalized = normalizeHash(bundle.expectedImageHash);
    if (normalized) return normalized;
  }
  
  // Priority 2: baseline.posterHash (NexArt standard)
  if (bundle.baseline?.posterHash) {
    const normalized = normalizeHash(bundle.baseline.posterHash);
    if (normalized) return normalized;
  }
  
  // Priority 3: baseline.expectedImageHash
  if (bundle.baseline?.expectedImageHash) {
    const normalized = normalizeHash(bundle.baseline.expectedImageHash);
    if (normalized) return normalized;
  }
  
  // Priority 4: baseline.imageHash (legacy)
  if (bundle.baseline?.imageHash) {
    const normalized = normalizeHash(bundle.baseline.imageHash);
    if (normalized) return normalized;
  }
  
  // Priority 5: Top-level posterHash
  if ((bundle as Record<string, unknown>).posterHash) {
    const normalized = normalizeHash((bundle as Record<string, unknown>).posterHash as string);
    if (normalized) return normalized;
  }
  
  // Priority 6: Top-level expectedPosterHash
  if (bundle.expectedPosterHash) {
    const normalized = normalizeHash(bundle.expectedPosterHash);
    if (normalized) return normalized;
  }
  
  return null;
}

/**
 * Resolve the expected animation hash from a CER bundle (loop mode)
 * 
 * Checks multiple locations in priority order:
 * 1. bundle.expectedAnimationHash (explicit field)
 * 2. bundle.baseline.animationHash (NexArt baseline)
 * 3. bundle.baseline.expectedAnimationHash (alternative name)
 * 
 * @param bundle - The CER bundle object
 * @returns Normalized 64-char hex hash or null if not found
 */
export function resolveExpectedAnimationHash(bundle: CERBundle): string | null {
  // Priority 1: Explicit expectedAnimationHash
  if (bundle.expectedAnimationHash) {
    const normalized = normalizeHash(bundle.expectedAnimationHash);
    if (normalized) return normalized;
  }
  
  // Priority 2: baseline.animationHash
  if (bundle.baseline?.animationHash) {
    const normalized = normalizeHash(bundle.baseline.animationHash);
    if (normalized) return normalized;
  }
  
  // Priority 3: baseline.expectedAnimationHash
  if (bundle.baseline?.expectedAnimationHash) {
    const normalized = normalizeHash(bundle.baseline.expectedAnimationHash);
    if (normalized) return normalized;
  }
  
  return null;
}

/**
 * Get the source location where the expected image hash was found
 * Useful for debugging and transparency
 * 
 * @param bundle - The CER bundle object
 * @returns Description of where the hash was found
 */
export function getImageHashSource(bundle: CERBundle): string {
  if (bundle.expectedImageHash && normalizeHash(bundle.expectedImageHash)) {
    return 'bundle.expectedImageHash';
  }
  if (bundle.baseline?.posterHash && normalizeHash(bundle.baseline.posterHash)) {
    return 'bundle.baseline.posterHash';
  }
  if (bundle.baseline?.expectedImageHash && normalizeHash(bundle.baseline.expectedImageHash)) {
    return 'bundle.baseline.expectedImageHash';
  }
  if (bundle.baseline?.imageHash && normalizeHash(bundle.baseline.imageHash)) {
    return 'bundle.baseline.imageHash';
  }
  if ((bundle as Record<string, unknown>).posterHash) {
    const normalized = normalizeHash((bundle as Record<string, unknown>).posterHash as string);
    if (normalized) return 'bundle.posterHash';
  }
  if (bundle.expectedPosterHash && normalizeHash(bundle.expectedPosterHash)) {
    return 'bundle.expectedPosterHash';
  }
  return '(not found)';
}
