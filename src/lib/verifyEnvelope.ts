/**
 * Verification Envelope — highest-trust layer for AI CER bundles.
 *
 * The verification envelope signs the full authoritative display surface:
 *   { bundleType, certificateHash, createdAt, snapshot, context, attestation summary }
 *
 * Verification uses the node's public key (same source as receipt verification)
 * via WebCrypto ECDSA P-256 / SHA-256.
 *
 * Does NOT change CER protocol semantics.
 */

const DEFAULT_NODE_URL = 'https://node.nexart.io';

export interface VerificationEnvelopeResult {
  status: 'valid' | 'invalid' | 'absent' | 'error';
  /** Human-readable detail */
  detail: string;
  /** The envelope object that was verified (when present) */
  envelope?: Record<string, unknown>;
  /** Key ID used for verification */
  kid?: string;
}

/**
 * Detect whether a bundle carries a verification envelope.
 */
export function hasVerificationEnvelope(bundle: unknown): boolean {
  if (!bundle || typeof bundle !== 'object') return false;
  const b = bundle as Record<string, unknown>;
  const meta = b.meta as Record<string, unknown> | undefined;
  return !!(
    meta &&
    typeof meta === 'object' &&
    meta.verificationEnvelope &&
    meta.verificationEnvelopeSignature
  );
}

/**
 * Extract the raw envelope and signature from the bundle.
 */
function extractEnvelope(bundle: Record<string, unknown>): {
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
    signatureB64Url: sig as string,
  };
}

/**
 * Canonicalize a value: sorted keys recursively, no whitespace.
 * Matches the canonicalization used by the signing node.
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
 * Decode a base64url string to Uint8Array.
 */
function base64UrlToBytes(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch the node's public key for verification.
 * Returns the CryptoKey ready for ECDSA verify, or null.
 */
async function fetchNodePublicKey(
  nodeUrl: string,
  kid?: string,
): Promise<CryptoKey | null> {
  try {
    const res = await fetch(`${nodeUrl}/.well-known/nexart-node.json`, {
      cache: 'force-cache',
    });
    if (!res.ok) return null;

    const manifest = await res.json();
    const keys = manifest.keys || manifest.publicKeys || [];

    // Find by kid if specified, otherwise use the first signing key
    let keyData: any = null;
    if (kid) {
      keyData = keys.find((k: any) => k.kid === kid || k.id === kid);
    }
    if (!keyData && keys.length > 0) {
      keyData = keys.find((k: any) => k.use === 'sig' || k.use === 'verify') || keys[0];
    }

    if (!keyData) return null;

    // Support JWK format
    if (keyData.kty) {
      return crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'ECDSA', namedCurve: keyData.crv || 'P-256' },
        false,
        ['verify'],
      );
    }

    // Support raw base64url-encoded SPKI
    if (keyData.publicKey || keyData.spki) {
      const raw = base64UrlToBytes(keyData.publicKey || keyData.spki);
      return crypto.subtle.importKey(
        'spki',
        raw,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Verify the verification envelope signature.
 *
 * @param bundle  The full uploaded AI CER bundle
 * @param nodeUrl Node URL to fetch public keys from
 * @returns       Verification result
 */
export async function verifyVerificationEnvelope(
  bundle: unknown,
  nodeUrl?: string,
): Promise<VerificationEnvelopeResult> {
  if (!bundle || typeof bundle !== 'object') {
    return { status: 'absent', detail: 'No bundle provided.' };
  }

  const b = bundle as Record<string, unknown>;

  const extracted = extractEnvelope(b);
  if (!extracted) {
    return { status: 'absent', detail: 'No verification envelope present.' };
  }

  const { envelope, signatureB64Url } = extracted;

  try {
    // Canonicalize the envelope for signature verification
    const canonicalJson = JSON.stringify(canonicalizeValue(envelope));
    const data = new TextEncoder().encode(canonicalJson);
    const sigBytes = base64UrlToBytes(signatureB64Url);

    // Determine kid from envelope or meta
    const meta = b.meta as Record<string, unknown>;
    const kid =
      (envelope as any).kid ||
      (meta?.attestation as any)?.attestorKeyId ||
      (meta?.attestation as any)?.kid ||
      undefined;

    const resolvedUrl = nodeUrl || DEFAULT_NODE_URL;
    const publicKey = await fetchNodePublicKey(resolvedUrl, kid);

    if (!publicKey) {
      return {
        status: 'error',
        detail: 'Could not fetch node public key for envelope verification.',
        envelope,
        kid,
      };
    }

    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sigBytes,
      data,
    );

    if (valid) {
      return {
        status: 'valid',
        detail: 'Verification envelope signature is valid.',
        envelope,
        kid,
      };
    } else {
      return {
        status: 'invalid',
        detail: 'Verification envelope signature does not match. The artifact may have been tampered with.',
        envelope,
        kid,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      detail: `Envelope verification error: ${msg}`,
      envelope,
    };
  }
}

/**
 * Get the set of field paths that the verification envelope covers.
 * Used by the UI to explain what the envelope protects.
 */
export function getEnvelopeCoveredFields(envelope: Record<string, unknown>): string[] {
  return Object.keys(envelope).sort();
}
