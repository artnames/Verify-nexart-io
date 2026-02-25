/**
 * extractSignedReceiptEnvelope — multi-layout extraction of signed receipt fields
 *
 * Searches common bundle layouts for receipt + signature + kid fields:
 *   Layout A: bundle.receipt / bundle.signature / bundle.attestorKeyId|kid
 *   Layout B: bundle.meta.attestation.receipt / .signature / .attestorKeyId
 *   Layout C: bundle.proof|certification|seal.receipt / .signature / .attestorKeyId
 *   Layout D: bundle.attestation.receipt (existing shape)
 *
 * Returns a normalized envelope or null if none found.
 * Read-only — never mutates the bundle.
 */

export interface SignedReceiptEnvelope {
  receipt: unknown;
  signatureB64Url: string;
  kid: string;
  nodeId?: string;
  /** Which layout path the receipt was found in */
  source: string;
}

export interface ReceiptFieldProbe {
  hasReceipt: boolean;
  hasSignature: boolean;
  hasKid: boolean;
  hasAttestationId: boolean;
  /** Path where attestation-like data was found, if any */
  foundIn: string | null;
}

/** Paths to probe for receipt data (in priority order) */
const LAYOUT_PATHS: { label: string; extract: (b: any) => any }[] = [
  // Layout D: existing shape (attestation.receipt as object)
  { label: 'attestation', extract: (b) => b?.attestation },
  // Layout A: top-level
  { label: 'top-level', extract: (b) => b },
  // Layout B: meta.attestation
  { label: 'meta.attestation', extract: (b) => b?.meta?.attestation },
  // Layout C: proof / certification / seal
  { label: 'proof', extract: (b) => b?.proof },
  { label: 'certification', extract: (b) => b?.certification },
  { label: 'seal', extract: (b) => b?.seal },
];

function getReceipt(obj: any): unknown | null {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.receipt != null) return obj.receipt;
  return null;
}

function getSignature(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  return obj.signatureB64Url ?? obj.signature ?? null;
}

function getKid(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  return obj.attestorKeyId ?? obj.kid ?? null;
}

function getNodeId(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  return obj.nodeId ?? null;
}

/**
 * Extract a signed receipt envelope from the bundle by probing multiple layouts.
 * Returns null if no complete receipt+signature+kid triple is found.
 */
export function extractSignedReceiptEnvelope(bundle: unknown): SignedReceiptEnvelope | null {
  if (!bundle || typeof bundle !== 'object') return null;

  for (const { label, extract } of LAYOUT_PATHS) {
    const obj = extract(bundle);
    if (!obj || typeof obj !== 'object') continue;

    const receipt = getReceipt(obj);
    const sig = getSignature(obj);
    const kid = getKid(obj);

    if (receipt != null && sig && kid) {
      return {
        receipt,
        signatureB64Url: sig,
        kid,
        nodeId: getNodeId(obj) ?? getNodeId(bundle as any),
        source: label,
      };
    }
  }

  return null;
}

/**
 * Probe the bundle for which receipt-related fields exist (even partial).
 * Used for diagnostic UI — shows found/missing status for each field.
 */
export function probeReceiptFields(bundle: unknown): ReceiptFieldProbe {
  const result: ReceiptFieldProbe = {
    hasReceipt: false,
    hasSignature: false,
    hasKid: false,
    hasAttestationId: false,
    foundIn: null,
  };

  if (!bundle || typeof bundle !== 'object') return result;

  for (const { label, extract } of LAYOUT_PATHS) {
    const obj = extract(bundle);
    if (!obj || typeof obj !== 'object') continue;

    const receipt = getReceipt(obj);
    const sig = getSignature(obj);
    const kid = getKid(obj);
    const attestationId = (obj as any).attestationId ?? (obj as any).attestationHash ?? null;

    if (receipt != null || sig || kid || attestationId) {
      result.hasReceipt = receipt != null;
      result.hasSignature = !!sig;
      result.hasKid = !!kid;
      result.hasAttestationId = !!attestationId;
      result.foundIn = label;
      return result;
    }
  }

  return result;
}
