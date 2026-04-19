/**
 * Canonical bundle verification pipeline.
 *
 * Single source of truth for integrity checks.
 * Uses browser-safe WebCrypto for AI CER bundles.
 * Code Mode → Recânon's own canonicalize + SHA-256 check.
 *
 * IMPORTANT: No Node.js crypto APIs are used here.
 */

import { isAICERBundle } from '@/types/aiCerBundle';
import { canonicalize, computeCertificateHash } from '@/lib/canonicalize';
import { verifyCerAsync } from '@nexart/ai-execution';

/* ------------------------------------------------------------------ */
/*  Normalised result returned to the UI                              */
/* ------------------------------------------------------------------ */

export type VerificationScope = 'full' | 'core-only';

export interface BundleVerifyResult {
  ok: boolean;
  code: string;
  details: string[];
  errors: string[];
  bundleType: string;
  /** True when context signals are covered by the certificate hash */
  contextIntegrityProtected?: boolean;
  /**
   * Verification scope.
   * - "full": all present fields (snapshot + context/signals) are hash-covered
   * - "core-only": only core fields (snapshot) matched; context/signals present but NOT protected
   */
  verificationScope?: VerificationScope;
  /**
   * Which field groups are covered by the certificate hash.
   */
  integrityCoverage?: string[];
  /**
   * True when the bundle is technically valid but context/signals are present
   * and NOT covered by the hash (degraded trust).
   */
  degraded?: boolean;
}

/* ------------------------------------------------------------------ */
/*  WebCrypto helpers (browser-safe, no Node crypto)                  */
/* ------------------------------------------------------------------ */

/**
 * SHA-256 hex via WebCrypto SubtleCrypto.
 * Returns "sha256:<64hex>"
 */
async function sha256HexWebCrypto(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

/**
 * Canonicalize a value: sorted keys recursively, no whitespace.
 * Matches the algorithm used by @nexart/ai-execution for certificate hashing.
 */
const MAX_DEPTH = 100;

function canonicalizeValue(value: unknown, depth: number = 0): unknown {
  if (depth > MAX_DEPTH) {
    throw new Error(`Canonicalization aborted: nesting depth exceeds ${MAX_DEPTH}`);
  }
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(v => canonicalizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) sorted[key] = canonicalizeValue(v, depth + 1);
    }
    return sorted;
  }
  return undefined;
}

/**
 * Browser-safe AI CER verification.
 *
 * SOURCE OF TRUTH: @nexart/ai-execution v0.14.0 `verifyCerAsync`.
 * The SDK applies the canonical protocol-1.2.0 hash scope, which only binds
 * `context.signals` (not arbitrary `context` metadata). This is what produces
 * the certificate hash on the auditor side, so the verifier MUST use the same
 * logic to avoid false `CONTEXT_NOT_PROTECTED` downgrades.
 *
 * Backward compatibility: if the SDK rejects the bundle with a hash mismatch
 * but the legacy no-context envelope matches, we surface a true DEGRADED
 * (CONTEXT_NOT_PROTECTED) result for older resealed/pre-v0.11 records.
 */
async function verifyAiCerBrowser(rawBundle: Record<string, unknown>): Promise<BundleVerifyResult> {
  const bundleType = (rawBundle.bundleType as string) || 'unknown';
  const storedHash = rawBundle.certificateHash as string | undefined;

  if (!storedHash || typeof storedHash !== 'string') {
    return {
      ok: false,
      code: 'SCHEMA_ERROR',
      details: ['Missing certificateHash field.'],
      errors: ['Missing certificateHash'],
      bundleType,
    };
  }

  // Detect contextual data presence (used for coverage reporting + legacy fallback)
  const context = rawBundle.context as Record<string, unknown> | undefined;
  const hasContext = !!(context && typeof context === 'object' && Object.keys(context).length > 0);
  const hasContextSignals = !!(context && Array.isArray((context as any).signals) && (context as any).signals.length > 0);
  const legacySignals = (rawBundle as any).signals
    ?? (rawBundle.snapshot as any)?.signals
    ?? (rawBundle.meta as any)?.signals;
  const hasLegacySignals = Array.isArray(legacySignals) && legacySignals.length > 0;
  const hasContextualData = hasContext || hasLegacySignals;

  // Primary: SDK-canonical verification
  let sdkResult: { ok: boolean; code: string; errors: string[]; details?: string[] };
  try {
    sdkResult = await verifyCerAsync(rawBundle as any) as any;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: 'CANONICALIZATION_ERROR',
      details: [msg],
      errors: [msg],
      bundleType,
    };
  }

  if (sdkResult.ok) {
    // Coverage reporting reflects what the SDK protocol actually binds:
    // snapshot is always covered; context.signals are bound when present.
    const coverage = ['bundleType', 'version', 'createdAt', 'snapshot'];
    if (hasContextSignals) coverage.push('context.signals');
    return {
      ok: true,
      code: 'OK',
      details: [],
      errors: [],
      bundleType,
      // contextIntegrityProtected reflects the protocol-bound subset (signals).
      // For modern v0.11+ records this is true when signals exist; metadata-only
      // context is intentionally not part of the hash by design.
      contextIntegrityProtected: hasContextSignals || !hasContextualData,
      verificationScope: 'full',
      integrityCoverage: coverage,
      degraded: false,
    };
  }

  // Backward-compat fallback: SDK rejected, but legacy no-context envelope may match.
  // Only relevant for pre-v0.11 / resealed records that were hashed without context.
  if (sdkResult.code === 'CERTIFICATE_HASH_MISMATCH') {
    try {
      const baseEnvelope: Record<string, unknown> = {
        bundleType: rawBundle.bundleType,
        version: rawBundle.version ?? rawBundle.bundleVersion,
        createdAt: rawBundle.createdAt,
        snapshot: rawBundle.snapshot,
      };
      const canonicalJson = JSON.stringify(canonicalizeValue(baseEnvelope));
      const computedHash = await sha256HexWebCrypto(canonicalJson);
      const normalizedExpected = storedHash.toLowerCase();

      if (computedHash === normalizedExpected) {
        const baseCoverage = ['bundleType', 'version', 'createdAt', 'snapshot'];
        if (hasContextualData) {
          // Genuinely degraded: contextual data exists but is NOT hash-bound.
          return {
            ok: false,
            degraded: true,
            code: 'CONTEXT_NOT_PROTECTED',
            details: [
              'Core record integrity verified (snapshot, bundleType, version, createdAt).',
              hasContext
                ? 'Context data is present but NOT covered by the certificate hash (legacy/resealed record).'
                : 'Signals data is present but NOT covered by the certificate hash (legacy record).',
              'Contextual data cannot be independently verified for this record.',
            ],
            errors: [],
            bundleType,
            contextIntegrityProtected: false,
            verificationScope: 'core-only',
            integrityCoverage: baseCoverage,
          };
        }
        // No context at all — clean legacy PASS
        return {
          ok: true,
          code: 'OK',
          details: [],
          errors: [],
          bundleType,
          contextIntegrityProtected: false,
          verificationScope: 'full',
          integrityCoverage: baseCoverage,
        };
      }
    } catch {
      // fall through to SDK error
    }
  }

  // Surface the SDK's verdict unchanged
  return {
    ok: false,
    code: sdkResult.code || 'CERTIFICATE_HASH_MISMATCH',
    details: sdkResult.details ?? (sdkResult.errors?.length ? sdkResult.errors : ['Certificate hash mismatch']),
    errors: sdkResult.errors ?? [],
    bundleType,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Sync verify — only works for Code Mode bundles.
 * AI CER bundles return PENDING; callers must use verifyUploadedBundleAsync.
 */
export function verifyUploadedBundle(rawBundle: unknown): BundleVerifyResult {
  if (!rawBundle || typeof rawBundle !== 'object') {
    return {
      ok: false,
      code: 'SCHEMA_ERROR',
      details: ['Bundle is not a valid object.'],
      errors: ['Bundle is not a valid object.'],
      bundleType: 'unknown',
    };
  }

  const bundle = rawBundle as Record<string, unknown>;
  const bundleType = (bundle.bundleType as string) || 'unknown';

  if (isAICERBundle(rawBundle)) {
    return {
      ok: false,
      code: 'PENDING',
      details: ['Use verifyUploadedBundleAsync for AI CER bundles.'],
      errors: [],
      bundleType,
    };
  }

  const storedHash = bundle.certificateHash as string | undefined;
  if (!storedHash) {
    return {
      ok: false,
      code: 'SCHEMA_ERROR',
      details: ['Bundle has no certificateHash field.'],
      errors: ['Missing certificateHash'],
      bundleType: bundleType || 'code-mode',
    };
  }

  return {
    ok: false,
    code: 'PENDING',
    details: ['Use verifyUploadedBundleAsync for Code Mode bundles.'],
    errors: [],
    bundleType: bundleType || 'code-mode',
  };
}

/**
 * Async variant — required for both AI CER (WebCrypto) and Code Mode.
 * This is the preferred entry point.
 */
export async function verifyUploadedBundleAsync(rawBundle: unknown): Promise<BundleVerifyResult> {
  if (!rawBundle || typeof rawBundle !== 'object') {
    return {
      ok: false,
      code: 'SCHEMA_ERROR',
      details: ['Bundle is not a valid object.'],
      errors: ['Bundle is not a valid object.'],
      bundleType: 'unknown',
    };
  }

  const bundle = rawBundle as Record<string, unknown>;
  const bundleType = (bundle.bundleType as string) || 'unknown';

  // AI CER — browser-safe WebCrypto verification
  if (isAICERBundle(rawBundle)) {
    return verifyAiCerBrowser(bundle);
  }

  // Code Mode — async hash via SubtleCrypto
  // IMPORTANT: The certificateHash field is excluded from the hash input
  // because it is the output of the hashing process (self-referential).
  // The hash envelope consists of all bundle fields EXCEPT certificateHash.
  const storedHash = bundle.certificateHash as string | undefined;
  if (!storedHash) {
    return {
      ok: false,
      code: 'SCHEMA_ERROR',
      details: ['Bundle has no certificateHash field.'],
      errors: ['Missing certificateHash'],
      bundleType: bundleType || 'code-mode',
    };
  }

  // Build hash input: full bundle minus the certificateHash field itself
  const { certificateHash: _excluded, ...hashInput } = bundle;
  const computedHash = await computeCertificateHash(hashInput);
  const normalizedExpected = storedHash.replace(/^sha256:/i, '').toLowerCase();

  // Also try with the full bundle for backward compatibility with records
  // that were hashed including certificateHash (legacy producer behavior)
  let ok = computedHash === normalizedExpected;
  if (!ok) {
    const legacyHash = await computeCertificateHash(bundle);
    ok = legacyHash === normalizedExpected;
  }

  return {
    ok,
    code: ok ? 'OK' : 'CERTIFICATE_HASH_MISMATCH',
    details: ok
      ? []
      : [`Expected ${normalizedExpected}, computed ${computedHash}`],
    errors: ok ? [] : ['Certificate hash mismatch'],
    bundleType: bundleType || 'code-mode',
    verificationScope: ok ? 'full' : undefined,
  };
}
