/**
 * AI CER Package format — the official export format used by apps like nexartaiauditor.
 *
 * Structure:
 * {
 *   "cer": { ...raw CER bundle... },
 *   "verificationEnvelope": { attestation: {...}, envelopeType: "..." },
 *   "verificationEnvelopeSignature": "base64url...",
 *   "receipt": { ... },
 *   "signature": "..."
 * }
 *
 * Detection: top-level `cer` key exists and is a non-null object.
 */

import type { CERBundle } from '@/types/auditRecord';

export interface CERPackage {
  cer: CERBundle;
  verificationEnvelope?: Record<string, unknown>;
  verificationEnvelopeSignature?: string;
  receipt?: Record<string, unknown>;
  signature?: string;
  [key: string]: unknown;
}

/**
 * Metadata extracted from a CER package, carried alongside the raw bundle.
 */
export interface PackageEnvelopeData {
  verificationEnvelope?: Record<string, unknown>;
  verificationEnvelopeSignature?: string;
  receipt?: Record<string, unknown>;
  signature?: string;
}

/**
 * Detect whether a parsed JSON object is the official CER package format.
 * Rule: top-level `cer` exists and is a non-null object.
 */
export function isCERPackage(obj: unknown): obj is CERPackage {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return o.cer !== null && o.cer !== undefined && typeof o.cer === 'object' && !Array.isArray(o.cer);
}

/**
 * Extract the raw CER bundle and package-level envelope data from a CER package.
 */
export function extractFromPackage(pkg: CERPackage): {
  bundle: CERBundle;
  envelopeData: PackageEnvelopeData;
} {
  const envelopeData: PackageEnvelopeData = {};

  if (pkg.verificationEnvelope && typeof pkg.verificationEnvelope === 'object') {
    envelopeData.verificationEnvelope = pkg.verificationEnvelope;
  }
  if (typeof pkg.verificationEnvelopeSignature === 'string') {
    envelopeData.verificationEnvelopeSignature = pkg.verificationEnvelopeSignature;
  }
  if (pkg.receipt && typeof pkg.receipt === 'object') {
    envelopeData.receipt = pkg.receipt;
  }
  if (typeof pkg.signature === 'string') {
    envelopeData.signature = pkg.signature;
  }

  return {
    bundle: pkg.cer,
    envelopeData,
  };
}
