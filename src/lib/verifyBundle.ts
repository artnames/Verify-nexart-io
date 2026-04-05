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
function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(v => canonicalizeValue(v));
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) sorted[key] = canonicalizeValue(v);
    }
    return sorted;
  }
  return undefined;
}

/**
 * Browser-safe AI CER verification.
 * Certificate hash is computed over exactly:
 *   { bundleType, version, createdAt, snapshot }
 * meta and attestation are excluded — matching @nexart/ai-execution rules.
 *
 * SECURITY FIX: When context/signals are present in the bundle but only the
 * core-only (no-context) strategy matches, the result is DEGRADED — not a
 * clean PASS. This prevents context stripping/modification from appearing
 * as a fully verified record.
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

  try {
    // Build envelope with context included (v0.11.0+ SDK behavior)
    const baseEnvelope: Record<string, unknown> = {
      bundleType: rawBundle.bundleType,
      version: rawBundle.version ?? rawBundle.bundleVersion,
      createdAt: rawBundle.createdAt,
      snapshot: rawBundle.snapshot,
    };

    const context = rawBundle.context as Record<string, unknown> | undefined;
    const hasContext = context && typeof context === 'object' && Object.keys(context).length > 0;

    // Backward compat: older bundles stored signals at root/snapshot/meta level
    const legacySignals = rawBundle.signals
      ?? (rawBundle.snapshot as any)?.signals
      ?? (rawBundle.meta as any)?.signals;
    const hasLegacySignals = Array.isArray(legacySignals) && legacySignals.length > 0;

    const hasContextualData = hasContext || hasLegacySignals;

    const normalizedExpected = storedHash.toLowerCase();

    // Strategy 1: Try with context included (v0.11.0+ originals)
    if (hasContext) {
      const envelopeWithCtx = { ...baseEnvelope, context };
      const canonicalJson = JSON.stringify(canonicalizeValue(envelopeWithCtx));
      const computedHash = await sha256HexWebCrypto(canonicalJson);
      if (computedHash === normalizedExpected) {
        return {
          ok: true,
          code: 'OK',
          details: [],
          errors: [],
          bundleType,
          contextIntegrityProtected: true,
          verificationScope: 'full',
          integrityCoverage: ['bundleType', 'version', 'createdAt', 'snapshot', 'context'],
          degraded: false,
        };
      }
    }

    // Strategy 2: Try with legacy signals at envelope root
    if (!hasContext && hasLegacySignals) {
      const envelopeWithSignals = { ...baseEnvelope, signals: legacySignals };
      const canonicalJson = JSON.stringify(canonicalizeValue(envelopeWithSignals));
      const computedHash = await sha256HexWebCrypto(canonicalJson);
      if (computedHash === normalizedExpected) {
        return {
          ok: true,
          code: 'OK',
          details: [],
          errors: [],
          bundleType,
          contextIntegrityProtected: true,
          verificationScope: 'full',
          integrityCoverage: ['bundleType', 'version', 'createdAt', 'snapshot', 'signals'],
          degraded: false,
        };
      }
    }

    // Strategy 3: Try without context/signals (resealed artifacts or pre-v0.11.0)
    {
      const canonicalJson = JSON.stringify(canonicalizeValue(baseEnvelope));
      const computedHash = await sha256HexWebCrypto(canonicalJson);
      if (computedHash === normalizedExpected) {
        const baseCoverage = ['bundleType', 'version', 'createdAt', 'snapshot'];

        // SECURITY: If context/signals ARE present but NOT hash-covered,
        // return DEGRADED — not a clean PASS.
        if (hasContextualData) {
          return {
            ok: false,
            degraded: true,
            code: 'CONTEXT_NOT_PROTECTED',
            details: [
              'Core record integrity verified (snapshot, bundleType, version, createdAt).',
              hasContext
                ? 'Context data is present but NOT covered by the certificate hash.'
                : 'Signals data is present but NOT covered by the certificate hash.',
              'Context or signals may have been added, modified, or replaced after certification.',
              'This does not necessarily indicate tampering, but contextual data cannot be independently verified.',
            ],
            errors: [],
            bundleType,
            contextIntegrityProtected: false,
            verificationScope: 'core-only',
            integrityCoverage: baseCoverage,
          };
        }

        // No context/signals at all — clean PASS (legacy or intentionally context-free)
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
    }

    // None matched — compute the most specific hash for the error message
    const fullEnvelope = hasContext
      ? { ...baseEnvelope, context }
      : hasLegacySignals
        ? { ...baseEnvelope, signals: legacySignals }
        : baseEnvelope;
    const canonicalJson = JSON.stringify(canonicalizeValue(fullEnvelope));
    const computedHash = await sha256HexWebCrypto(canonicalJson);

    return {
      ok: false,
      code: 'CERTIFICATE_HASH_MISMATCH',
      details: [`Expected ${normalizedExpected}, computed ${computedHash}`],
      errors: ['Certificate hash mismatch'],
      bundleType,
    };
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

  const computedHash = await computeCertificateHash(bundle);
  const normalizedExpected = storedHash.replace(/^sha256:/i, '').toLowerCase();
  const ok = computedHash === normalizedExpected;

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
