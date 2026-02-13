/**
 * AI Execution CER Bundle types
 * 
 * Defines the schema for AI execution records:
 * bundleType: "cer.ai.execution.v1"
 * snapshot.type: "ai.execution.v1"
 */

/**
 * AI Execution Snapshot
 */
export interface AIExecutionSnapshot {
  type: 'ai.execution.v1';
  provider: string;
  model: string;
  modelVersion?: string;
  executionId: string;
  timestamp: string;
  appId?: string;
  parameters?: Record<string, unknown>;
  inputHash: string;
  outputHash: string;
  /** Sensitive: raw prompt/input — hidden by default */
  input?: unknown;
  /** Sensitive: raw output — hidden by default */
  output?: unknown;
}

/**
 * AI Execution CER Bundle
 */
export interface AICERBundle {
  bundleType: 'cer.ai.execution.v1';
  version?: string;
  bundleVersion?: string;
  createdAt: string;
  certificateHash: string;
  snapshot: AIExecutionSnapshot;
  meta?: Record<string, unknown>;
  /** Allow additional fields */
  [key: string]: unknown;
}

/**
 * Detect whether a bundle is an AI Execution CER
 */
export function isAICERBundle(bundle: unknown): bundle is AICERBundle {
  if (!bundle || typeof bundle !== 'object') return false;
  const b = bundle as Record<string, unknown>;
  return (
    b.bundleType === 'cer.ai.execution.v1' ||
    (b.snapshot &&
      typeof b.snapshot === 'object' &&
      (b.snapshot as Record<string, unknown>).type === 'ai.execution.v1')
  );
}

/**
 * Validate an AI CER bundle for general import
 */
export function validateAICERBundle(bundle: unknown): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bundle || typeof bundle !== 'object') {
    return { valid: false, errors: ['Invalid bundle: must be a JSON object'], warnings };
  }

  const b = bundle as AICERBundle;

  if (b.bundleType !== 'cer.ai.execution.v1') {
    errors.push('bundleType must be "cer.ai.execution.v1"');
  }

  if (!b.snapshot || typeof b.snapshot !== 'object') {
    errors.push('Missing snapshot object');
    return { valid: errors.length === 0, errors, warnings };
  }

  const s = b.snapshot;

  if (s.type !== 'ai.execution.v1') {
    errors.push('snapshot.type must be "ai.execution.v1"');
  }
  if (!s.provider || typeof s.provider !== 'string') {
    errors.push('Missing snapshot.provider');
  }
  if (!s.model || typeof s.model !== 'string') {
    errors.push('Missing snapshot.model');
  }
  if (!s.executionId || typeof s.executionId !== 'string') {
    errors.push('Missing snapshot.executionId');
  }
  if (!s.timestamp || typeof s.timestamp !== 'string') {
    errors.push('Missing snapshot.timestamp');
  }
  if (!s.inputHash || typeof s.inputHash !== 'string') {
    warnings.push('Missing snapshot.inputHash');
  }
  if (!s.outputHash || typeof s.outputHash !== 'string') {
    warnings.push('Missing snapshot.outputHash');
  }

  if (!b.createdAt) {
    warnings.push('Missing createdAt');
  }
  if (!b.certificateHash) {
    warnings.push('Missing certificateHash');
  }

  return { valid: errors.length === 0, errors, warnings };
}

const CERT_HASH_RE = /^sha256:[a-f0-9]{64}$/;

/**
 * Validate that an AI CER bundle has all fields required for canonical attestation.
 * Returns { attestable: true } or { attestable: false, missingFields: [...] }.
 */
export function validateAICERForAttestation(bundle: unknown): {
  attestable: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];

  if (!bundle || typeof bundle !== 'object') {
    return { attestable: false, missingFields: ['bundle (not an object)'] };
  }

  const b = bundle as Record<string, unknown>;

  if (b.bundleType !== 'cer.ai.execution.v1') {
    missing.push('bundleType (must be cer.ai.execution.v1)');
  }

  // version: non-empty string
  const version = b.version ?? b.bundleVersion;
  if (!version || typeof version !== 'string' || (version as string).trim().length === 0) {
    missing.push('version');
  }

  // createdAt: ISO string
  if (!b.createdAt || typeof b.createdAt !== 'string') {
    missing.push('createdAt');
  } else {
    const d = new Date(b.createdAt as string);
    if (isNaN(d.getTime())) {
      missing.push('createdAt (invalid ISO date)');
    }
  }

  // certificateHash: sha256:<64 hex>
  if (!b.certificateHash || typeof b.certificateHash !== 'string') {
    missing.push('certificateHash');
  } else if (!CERT_HASH_RE.test((b.certificateHash as string).toLowerCase())) {
    missing.push('certificateHash (must match sha256:<64 hex>)');
  }

  // snapshot: non-null object
  if (!b.snapshot || typeof b.snapshot !== 'object') {
    missing.push('snapshot');
  }

  return { attestable: missing.length === 0, missingFields: missing };
}

/**
 * Extract title from AI CER bundle
 */
export function extractAICERTitle(bundle: AICERBundle): string {
  return `${bundle.snapshot.provider}/${bundle.snapshot.model} Execution`;
}

/**
 * Extract subject from AI CER bundle
 */
export function extractAICERSubject(bundle: AICERBundle): string {
  return bundle.snapshot.appId || bundle.snapshot.provider;
}
