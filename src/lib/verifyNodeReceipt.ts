/**
 * Browser-safe Node Receipt verification for Project Bundles.
 *
 * Verifies Ed25519 signatures on nodeReceipt objects returned by
 * node.nexart.io alongside Project Bundles.
 *
 * Uses WebCrypto exclusively — no Node.js crypto APIs.
 */

const NODE_PUBLIC_KEY_URL = 'https://node.nexart.io/.well-known/nexart-node.json';

export interface NodeReceiptVerifyResult {
  status: 'valid' | 'invalid' | 'absent' | 'error';
  detail: string;
  kid?: string;
  signedAt?: string;
  projectHash?: string;
}

export interface NodeReceipt {
  projectHash?: string;
  registeredAt?: string;
  signedAt?: string;
  signature?: string;
  kid?: string;
  nodeId?: string;
  [key: string]: unknown;
}

function base64UrlToBytes(b64url: string): Uint8Array {
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
 * Fetch the node's Ed25519 public key from the well-known endpoint.
 */
async function fetchNodeKey(kid?: string): Promise<CryptoKey | null> {
  try {
    const res = await fetch(NODE_PUBLIC_KEY_URL, { cache: 'force-cache' });
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

    if (keyData.publicKeyJwk) {
      return crypto.subtle.importKey(
        'jwk',
        keyData.publicKeyJwk,
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
    }

    if (keyData.publicKeySpkiB64) {
      const b64 = keyData.publicKeySpkiB64.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return crypto.subtle.importKey(
        'spki',
        bytes.buffer,
        { name: 'Ed25519' },
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
 * Canonicalize for signing: sorted keys, no whitespace (JCS-like).
 */
function canonicalizeForSigning(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    if (obj[key] !== undefined) sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

/**
 * Verify a nodeReceipt returned alongside a Project Bundle.
 *
 * The receipt is expected to contain:
 * - projectHash: the project hash it endorses
 * - signature: base64url Ed25519 signature
 * - kid: key ID used for signing
 * - signedAt / registeredAt: timestamp
 *
 * The signed payload is the receipt object minus the signature field,
 * canonicalized with sorted keys.
 */
export async function verifyNodeReceipt(
  receipt: NodeReceipt | null | undefined,
  expectedProjectHash?: string,
): Promise<NodeReceiptVerifyResult> {
  if (!receipt || typeof receipt !== 'object') {
    return { status: 'absent', detail: 'No node receipt provided.' };
  }

  const signature = receipt.signature;
  if (!signature || typeof signature !== 'string') {
    return { status: 'absent', detail: 'Node receipt has no signature.' };
  }

  // Build signable payload: receipt minus signature
  const { signature: _sig, ...signableFields } = receipt;
  
  try {
    const key = await fetchNodeKey(receipt.kid);
    if (!key) {
      return {
        status: 'error',
        detail: 'Could not fetch node public key for receipt verification.',
        kid: receipt.kid,
      };
    }

    const canonical = canonicalizeForSigning(signableFields as Record<string, unknown>);
    const data = new TextEncoder().encode(canonical);
    const sigBytes = base64UrlToBytes(signature);

    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      sigBytes.buffer as ArrayBuffer,
      data,
    );

    if (!valid) {
      return {
        status: 'invalid',
        detail: 'Node receipt signature verification failed.',
        kid: receipt.kid,
        signedAt: receipt.signedAt || receipt.registeredAt,
        projectHash: receipt.projectHash,
      };
    }

    // Cross-check project hash if provided
    if (expectedProjectHash && receipt.projectHash && receipt.projectHash !== expectedProjectHash) {
      return {
        status: 'invalid',
        detail: `Node receipt project hash mismatch. Receipt: ${receipt.projectHash}, expected: ${expectedProjectHash}.`,
        kid: receipt.kid,
        signedAt: receipt.signedAt || receipt.registeredAt,
        projectHash: receipt.projectHash,
      };
    }

    return {
      status: 'valid',
      detail: 'Node receipt signature verified.',
      kid: receipt.kid,
      signedAt: receipt.signedAt || receipt.registeredAt,
      projectHash: receipt.projectHash,
    };
  } catch (err) {
    return {
      status: 'error',
      detail: err instanceof Error ? err.message : 'Receipt verification error.',
      kid: receipt.kid,
    };
  }
}
