/**
 * Verification Envelope — highest-trust layer for AI CER bundles.
 *
 * Supports two envelope types:
 *
 * v1 (legacy): Signs a small summary object stored at meta.verificationEnvelope.
 *   Verification: canonicalize meta.verificationEnvelope, verify signature.
 *
 * v2 (full-bundle): Signs the exact canonical signable payload derived from the
 *   full CER bundle, excluding only self-referential/runtime fields.
 *   Verification: reconstruct signable payload from the live bundle, canonicalize
 *   with JCS (RFC 8785), verify signature.
 *
 * Does NOT change CER protocol semantics.
 */

const DEFAULT_NODE_URL = 'https://node.nexart.io';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type EnvelopeType = 'v1' | 'v2';

export type EnvelopeStatus =
  | 'valid'
  | 'invalid'
  | 'absent'
  | 'error'
  | 'unsupported';

export interface VerificationEnvelopeResult {
  status: EnvelopeStatus;
  /** Human-readable detail */
  detail: string;
  /** Detected envelope type */
  envelopeType?: EnvelopeType;
  /** The envelope / signable payload that was verified */
  envelope?: Record<string, unknown>;
  /** Key ID used for verification */
  kid?: string;
  /** Algorithm used */
  algorithm?: string;
  /** Excluded fields (v2) */
  excludedFields?: string[];
  /** Error sub-type for UI granularity */
  errorKind?: 'invalid_signature' | 'unsupported_type' | 'missing_public_key'
    | 'missing_signature' | 'malformed_envelope' | 'canonicalization_error'
    | 'fetch_error';
}

/* ------------------------------------------------------------------ */
/*  v2 constants                                                       */
/* ------------------------------------------------------------------ */

const V2_ENVELOPE_TYPE = 'nexart.verification.envelope.v2';

/** Fields excluded from the v2 signable payload (self-referential / runtime) */
const V2_EXCLUDED_META_FIELDS = [
  'meta.verificationEnvelopeSignature',
  'meta.verificationEnvelopeVerification',
] as const;

/* ------------------------------------------------------------------ */
/*  Detection                                                          */
/* ------------------------------------------------------------------ */

export function hasVerificationEnvelope(bundle: unknown): boolean {
  if (!bundle || typeof bundle !== 'object') return false;
  const b = bundle as Record<string, unknown>;
  const meta = b.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object') return false;

  // v2: has envelopeType discriminator
  if (meta.verificationEnvelopeType === V2_ENVELOPE_TYPE && meta.verificationEnvelopeSignature) {
    return true;
  }
  // Also detect v2 from envelope object containing envelopeType
  const env = meta.verificationEnvelope as Record<string, unknown> | undefined;
  if (env && typeof env === 'object' && env.envelopeType === V2_ENVELOPE_TYPE && meta.verificationEnvelopeSignature) {
    return true;
  }
  // v1: has verificationEnvelope + verificationEnvelopeSignature
  if (meta.verificationEnvelope && meta.verificationEnvelopeSignature) {
    return true;
  }
  return false;
}

function detectEnvelopeType(bundle: Record<string, unknown>): EnvelopeType | null {
  const meta = bundle.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object') return null;

  if (meta.verificationEnvelopeType === V2_ENVELOPE_TYPE) return 'v2';

  const env = meta.verificationEnvelope as Record<string, unknown> | undefined;
  if (env && typeof env === 'object' && env.envelopeType === V2_ENVELOPE_TYPE) return 'v2';

  if (meta.verificationEnvelope && meta.verificationEnvelopeSignature) return 'v1';

  return null;
}

/* ------------------------------------------------------------------ */
/*  JCS / RFC 8785 Canonicalization                                    */
/* ------------------------------------------------------------------ */

/**
 * RFC 8785 (JCS) canonicalization.
 *
 * Rules:
 * - Object keys sorted by UTF-16 code units (default JS sort)
 * - Numbers serialized per ES2015 (JSON.stringify handles this)
 * - No whitespace
 * - Recursive
 */
function jcsCanonicalizeValue(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => jcsCanonicalizeValue(v));
  }
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) {
        sorted[key] = jcsCanonicalizeValue(v);
      }
    }
    return sorted;
  }
  return undefined;
}

export function jcsCanonicalizeToString(value: unknown): string {
  return JSON.stringify(jcsCanonicalizeValue(value));
}

/* ------------------------------------------------------------------ */
/*  v2: Signable payload reconstruction                                */
/* ------------------------------------------------------------------ */

/**
 * Reconstruct the v2 signable payload from a live CER bundle.
 * Mirrors the node-side derivation exactly.
 */
export function reconstructV2SignablePayload(bundle: Record<string, unknown>): {
  payload: Record<string, unknown>;
  excludedFields: string[];
} {
  // Deep clone the bundle
  const cleaned = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  const meta = cleaned.meta as Record<string, unknown> | undefined;

  const excludedFields: string[] = [];

  if (meta && typeof meta === 'object') {
    // Remove self-referential fields
    if ('verificationEnvelopeSignature' in meta) {
      delete meta.verificationEnvelopeSignature;
      excludedFields.push('meta.verificationEnvelopeSignature');
    }
    if ('verificationEnvelopeVerification' in meta) {
      delete meta.verificationEnvelopeVerification;
      excludedFields.push('meta.verificationEnvelopeVerification');
    }

    // If meta is now empty, remove it entirely
    if (Object.keys(meta).length === 0) {
      delete cleaned.meta;
    }
  }

  // Extract attestation summary from the bundle's attestation data
  const att = (cleaned.meta as Record<string, unknown> | undefined)?.attestation as Record<string, unknown> | undefined;
  const attestationSummary: Record<string, unknown> = {};
  if (att && typeof att === 'object') {
    if (att.attestationId) attestationSummary.attestationId = att.attestationId;
    if (att.attestedAt) attestationSummary.attestedAt = att.attestedAt;
    if (att.attestorKeyId) attestationSummary.kid = att.attestorKeyId;
    if (att.nodeRuntimeHash) attestationSummary.nodeRuntimeHash = att.nodeRuntimeHash;
    if (att.protocolVersion) attestationSummary.protocolVersion = att.protocolVersion;
  }

  const payload: Record<string, unknown> = {
    attestation: attestationSummary,
    bundle: cleaned,
    envelopeType: V2_ENVELOPE_TYPE,
  };

  return { payload, excludedFields };
}

/* ------------------------------------------------------------------ */
/*  Crypto helpers                                                     */
/* ------------------------------------------------------------------ */

function base64UrlToBytes(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

async function fetchNodePublicKey(
  nodeUrl: string,
  kid?: string,
): Promise<{ key: CryptoKey; alg: string; kid?: string } | null> {
  try {
    const res = await fetch(`${nodeUrl}/.well-known/nexart-node.json`, {
      cache: 'force-cache',
    });
    if (!res.ok) return null;

    const manifest = await res.json();
    const keys = manifest.keys || manifest.publicKeys || [];

    let keyData: any = null;
    if (kid) {
      keyData = keys.find((k: any) => k.kid === kid || k.id === kid);
    }
    if (!keyData && keys.length > 0) {
      keyData = keys.find((k: any) => k.use === 'sig' || k.use === 'verify') || keys[0];
    }
    if (!keyData) return null;

    const alg = keyData.alg || 'Ed25519';

    // Ed25519 via JWK
    if (alg === 'Ed25519' && keyData.publicKeyJwk) {
      const jwk = keyData.publicKeyJwk;
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
      return { key, alg: 'Ed25519', kid: keyData.kid };
    }

    // Ed25519 via SPKI
    if (alg === 'Ed25519' && keyData.publicKeySpkiB64) {
      const spkiB64 = keyData.publicKeySpkiB64;
      const b64 = spkiB64.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const key = await crypto.subtle.importKey(
        'spki',
        bytes.buffer,
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
      return { key, alg: 'Ed25519', kid: keyData.kid };
    }

    // ECDSA P-256 via JWK (legacy v1)
    if (keyData.kty === 'EC' || keyData.crv === 'P-256') {
      const key = await crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'ECDSA', namedCurve: keyData.crv || 'P-256' },
        false,
        ['verify'],
      );
      return { key, alg: 'ECDSA-P256', kid: keyData.kid };
    }

    // ECDSA P-256 via SPKI (legacy v1)
    if (keyData.publicKey || keyData.spki) {
      const raw = base64UrlToBytes(keyData.publicKey || keyData.spki);
      const key = await crypto.subtle.importKey(
        'spki',
        raw,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      return { key, alg: 'ECDSA-P256', kid: keyData.kid };
    }

    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  v1 legacy verification                                             */
/* ------------------------------------------------------------------ */

function extractV1Envelope(bundle: Record<string, unknown>): {
  envelope: Record<string, unknown>;
  signatureB64Url: string;
} | null {
  const meta = bundle.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object') return null;

  const envelope = meta.verificationEnvelope;
  const sig = meta.verificationEnvelopeSignature;

  if (!envelope || typeof envelope !== 'object') return null;
  if (!sig || typeof sig !== 'string') return null;

  return {
    envelope: envelope as Record<string, unknown>,
    signatureB64Url: sig,
  };
}

async function verifyV1Envelope(
  bundle: Record<string, unknown>,
  nodeUrl: string,
): Promise<VerificationEnvelopeResult> {
  const extracted = extractV1Envelope(bundle);
  if (!extracted) {
    return {
      status: 'error',
      detail: 'Malformed v1 envelope: missing verificationEnvelope or signature.',
      envelopeType: 'v1',
      errorKind: 'malformed_envelope',
    };
  }

  const { envelope, signatureB64Url } = extracted;

  try {
    const canonicalJson = jcsCanonicalizeToString(envelope);
    const data = new TextEncoder().encode(canonicalJson);
    const sigBytes = base64UrlToBytes(signatureB64Url);

    const meta = bundle.meta as Record<string, unknown>;
    const kid =
      (envelope as any).kid ||
      (meta?.attestation as any)?.attestorKeyId ||
      (meta?.attestation as any)?.kid ||
      undefined;

    const keyResult = await fetchNodePublicKey(nodeUrl, kid);
    if (!keyResult) {
      return {
        status: 'error',
        detail: 'Could not fetch node public key for v1 envelope verification.',
        envelopeType: 'v1',
        envelope,
        kid,
        errorKind: 'missing_public_key',
      };
    }

    const verifyAlgo = keyResult.alg === 'Ed25519'
      ? { name: 'Ed25519' }
      : { name: 'ECDSA', hash: 'SHA-256' };

    const valid = await crypto.subtle.verify(
      verifyAlgo,
      keyResult.key,
      sigBytes,
      data,
    );

    return {
      status: valid ? 'valid' : 'invalid',
      detail: valid
        ? 'Legacy envelope signature verified. This envelope covers only a limited signed summary, not the full bundle.'
        : 'Legacy envelope signature does not match. The signed summary may have been tampered with.',
      envelopeType: 'v1',
      envelope,
      kid: keyResult.kid || kid,
      algorithm: keyResult.alg,
      errorKind: valid ? undefined : 'invalid_signature',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      detail: `Legacy envelope verification error: ${msg}`,
      envelopeType: 'v1',
      envelope,
      errorKind: 'canonicalization_error',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  v2 full-bundle verification                                        */
/* ------------------------------------------------------------------ */

async function verifyV2Envelope(
  bundle: Record<string, unknown>,
  nodeUrl: string,
): Promise<VerificationEnvelopeResult> {
  const meta = bundle.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object') {
    return {
      status: 'error',
      detail: 'Malformed v2 envelope: no meta object.',
      envelopeType: 'v2',
      errorKind: 'malformed_envelope',
    };
  }

  const signatureB64Url = meta.verificationEnvelopeSignature;
  if (!signatureB64Url || typeof signatureB64Url !== 'string') {
    return {
      status: 'error',
      detail: 'Missing v2 envelope signature (meta.verificationEnvelopeSignature).',
      envelopeType: 'v2',
      errorKind: 'missing_signature',
    };
  }

  try {
    // Reconstruct the exact signable payload
    const { payload, excludedFields } = reconstructV2SignablePayload(bundle);
    const canonicalJson = jcsCanonicalizeToString(payload);
    const data = new TextEncoder().encode(canonicalJson);
    const sigBytes = base64UrlToBytes(signatureB64Url);

    // Determine kid
    const att = meta.attestation as Record<string, unknown> | undefined;
    const kid = att?.attestorKeyId as string | undefined ||
                att?.kid as string | undefined ||
                undefined;

    const keyResult = await fetchNodePublicKey(nodeUrl, kid);
    if (!keyResult) {
      return {
        status: 'error',
        detail: 'Could not fetch node public key for v2 envelope verification.',
        envelopeType: 'v2',
        kid,
        errorKind: 'missing_public_key',
        excludedFields,
      };
    }

    const verifyAlgo = keyResult.alg === 'Ed25519'
      ? { name: 'Ed25519' }
      : { name: 'ECDSA', hash: 'SHA-256' };

    const valid = await crypto.subtle.verify(
      verifyAlgo,
      keyResult.key,
      sigBytes,
      data,
    );

    return {
      status: valid ? 'valid' : 'invalid',
      detail: valid
        ? 'Full bundle envelope verified. The node signed the exact canonical CER bundle payload. Any post-issuance modification to the signed bundle payload causes verification to fail.'
        : 'Full bundle envelope invalid. The reconstructed canonical payload does not match the node signature. The bundle may have been modified after issuance.',
      envelopeType: 'v2',
      envelope: payload,
      kid: keyResult.kid || kid,
      algorithm: keyResult.alg,
      excludedFields,
      errorKind: valid ? undefined : 'invalid_signature',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      detail: `v2 envelope verification error: ${msg}`,
      envelopeType: 'v2',
      errorKind: 'canonicalization_error',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export async function verifyVerificationEnvelope(
  bundle: unknown,
  nodeUrl?: string,
): Promise<VerificationEnvelopeResult> {
  if (!bundle || typeof bundle !== 'object') {
    return { status: 'absent', detail: 'No bundle provided.' };
  }

  const b = bundle as Record<string, unknown>;
  const type = detectEnvelopeType(b);

  if (!type) {
    return { status: 'absent', detail: 'No verification envelope present.' };
  }

  const resolvedUrl = nodeUrl || DEFAULT_NODE_URL;

  if (type === 'v2') {
    return verifyV2Envelope(b, resolvedUrl);
  }

  return verifyV1Envelope(b, resolvedUrl);
}

/* ------------------------------------------------------------------ */
/*  Covered fields helper                                              */
/* ------------------------------------------------------------------ */

export function getEnvelopeCoveredFields(
  envelope: Record<string, unknown>,
  envelopeType?: EnvelopeType,
): string[] {
  if (envelopeType === 'v2') {
    // v2 covers the full bundle minus excluded fields
    return [
      'bundleType',
      'certificateHash',
      'createdAt',
      'version',
      'snapshot.*',
      'context.*',
      'meta.attestation (summary)',
      'meta.source',
      'meta.tags',
    ];
  }
  // v1: keys of the envelope object
  return Object.keys(envelope).sort();
}
