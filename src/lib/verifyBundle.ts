/**
 * Canonical bundle verification pipeline.
 *
 * Single source of truth for integrity checks.
 * Uses SDK verifiers on the RAW uploaded bundle — never on extracted/transformed objects.
 *
 * AI bundles  → @nexart/ai-execution  verifyCer()
 * Code Mode   → Recânon's own canonicalize + SHA-256 check
 */

import { verifyCer } from '@nexart/ai-execution';
import type { CerAiExecutionBundle } from '@nexart/ai-execution';
import { isAICERBundle } from '@/types/aiCerBundle';
import { canonicalize, computeCertificateHash } from '@/lib/canonicalize';

/* ------------------------------------------------------------------ */
/*  Normalised result returned to the UI                              */
/* ------------------------------------------------------------------ */

export interface BundleVerifyResult {
  ok: boolean;
  code: string;
  details: string[];
  errors: string[];
  bundleType: string;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Verify an uploaded bundle using the appropriate SDK verifier.
 *
 * IMPORTANT: `rawBundle` must be the original parsed JSON — no redaction,
 * no field extraction, no deep-clone mutations.
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

  // ── AI Execution CER ──────────────────────────────────────────────
  if (isAICERBundle(rawBundle)) {
    try {
      const sdkResult = verifyCer(rawBundle as unknown as CerAiExecutionBundle);
      return {
        ok: sdkResult.ok,
        code: sdkResult.code,
        details: sdkResult.details ?? [],
        errors: sdkResult.errors ?? [],
        bundleType,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: 'UNKNOWN_ERROR',
        details: [msg],
        errors: [msg],
        bundleType,
      };
    }
  }

  // ── Code Mode CER (legacy) ────────────────────────────────────────
  // Uses Recânon's canonicalize + SHA-256 to check certificateHash.
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

  // computeCertificateHash is async — but Code Mode bundles still use
  // the synchronous canonicalize path, so we wrap it.
  // For the sync API surface we use a sync hash comparison instead.
  // Since computeCertificateHash uses SubtleCrypto (async), we provide
  // an async variant too. The sync path here returns a "pending" that
  // callers resolve.
  return _verifyCodeModeSync(bundle, storedHash, bundleType);
}

/**
 * Async variant — required for Code Mode because SubtleCrypto is async.
 * AI CER verification is fully sync, but this works for both.
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

  // AI CER — synchronous SDK verify
  if (isAICERBundle(rawBundle)) {
    try {
      const sdkResult = verifyCer(rawBundle as unknown as CerAiExecutionBundle);
      return {
        ok: sdkResult.ok,
        code: sdkResult.code,
        details: sdkResult.details ?? [],
        errors: sdkResult.errors ?? [],
        bundleType,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: 'UNKNOWN_ERROR',
        details: [msg],
        errors: [msg],
        bundleType,
      };
    }
  }

  // Code Mode — async hash
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
  };
}

/* ------------------------------------------------------------------ */
/*  Internal                                                          */
/* ------------------------------------------------------------------ */

function _verifyCodeModeSync(
  bundle: Record<string, unknown>,
  storedHash: string,
  bundleType: string,
): BundleVerifyResult {
  // We can't do async in a sync function — return a best-effort result.
  // Callers needing Code Mode should prefer verifyUploadedBundleAsync.
  // For now, return 'pending' so the UI knows to call the async variant.
  return {
    ok: false,
    code: 'PENDING',
    details: ['Use verifyUploadedBundleAsync for Code Mode bundles.'],
    errors: [],
    bundleType: bundleType || 'code-mode',
  };
}
