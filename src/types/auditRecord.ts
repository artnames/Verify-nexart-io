/**
 * Certified Execution Record (CER) types
 * 
 * Defines the schema for audit records that can be imported,
 * stored, and verified through the Recanon platform.
 */

/**
 * Supported bundle modes
 */
export type AuditMode = 'static' | 'loop' | 'decision' | 'attestation';

/**
 * Render verification status
 */
export type RenderStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'SKIPPED';

/**
 * Import source for audit records
 */
export type ImportSource = 'hash' | 'url' | 'upload' | 'internal';

/**
 * Source/evidence entry in a bundle
 */
export interface AuditSource {
  label: string;
  url?: string;
  retrievedAt?: string;
  selectorOrEvidence?: string;
}

/**
 * Claim or input snapshot data
 */
export interface AuditClaim {
  type?: string;
  title?: string;
  statement?: string;
  subject?: string;
  eventDate?: string;
  notes?: string;
  details?: Record<string, unknown>;
}

/**
 * Canonical/protocol metadata
 */
export interface AuditCanonical {
  via?: string;
  protocol?: string;
  protocolVersion?: string;
  rendererVersion?: string;
  nodeVersion?: string;
  sdkVersion?: string;
}

/**
 * Execution snapshot (NexArt format)
 */
export interface AuditSnapshot {
  code: string;
  seed: number;
  vars: number[];
  execution?: {
    frames: number;
    loop: boolean;
  };
}

/**
 * Baseline hashes for verification
 */
export interface AuditBaseline {
  posterHash?: string;
  animationHash?: string;
  expectedImageHash?: string;
  expectedAnimationHash?: string;
  imageHash?: string;
}

/**
 * Check/verification status
 */
export interface AuditCheck {
  lastCheckedAt?: string;
  result?: string;
  status?: string;
}

/**
 * Full Certified Execution Record bundle schema
 * Supports multiple formats (recanon.event.v1, legacy, external)
 */
export interface CERBundle {
  // Required fields
  bundleVersion?: string;
  createdAt?: string;
  mode?: AuditMode;
  
  // Claim/input data (one of these should be present)
  claim?: AuditClaim;
  inputSnapshot?: Record<string, unknown>;
  input?: Record<string, unknown>;
  
  // Sources/evidence
  sources?: AuditSource[];
  
  // Protocol metadata
  canonical?: AuditCanonical;
  protocol?: AuditCanonical;
  
  // Execution conditions (recanon.execution.v1 format)
  executionConditions?: {
    engine?: string;
    engineVersion?: string;
    runtime?: string;
    runtimeVersion?: string;
    deterministic?: boolean;
    [key: string]: unknown;
  };
  
  // Execution snapshot (optional, for NexArt bundles)
  snapshot?: AuditSnapshot;
  
  // Baseline hashes
  baseline?: AuditBaseline;
  expectedImageHash?: string;
  expectedPosterHash?: string;
  expectedAnimationHash?: string;
  
  // Check status
  check?: AuditCheck;
  status?: string;
  
  // Output/result data
  output?: Record<string, unknown>;
  result?: Record<string, unknown>;
  decision?: Record<string, unknown>;
  
  // Certification details (recanon.execution.v1 format)
  certification?: {
    hash?: string;
    algorithm?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
  
  // Certificate hash (if pre-computed)
  certificateHash?: string;
  
  // Allow additional fields
  [key: string]: unknown;
}

/**
 * Validation result for bundle import
 */
export interface BundleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedBundle?: CERBundle;
  mode?: AuditMode;
  expectedImageHash?: string | null;
  expectedAnimationHash?: string | null;
  hasSnapshot?: boolean;
}

/**
 * Database row for audit_records table
 */
export interface AuditRecordRow {
  id: string;
  certificate_hash: string;
  bundle_version: string;
  mode: AuditMode;
  created_at: string;
  bundle_created_at: string | null;
  claim_type: string | null;
  title: string | null;
  statement: string | null;
  subject: string | null;
  expected_image_hash: string | null;
  expected_animation_hash: string | null;
  certificate_verified: boolean;
  render_verified: boolean | null;
  render_status: RenderStatus | null;
  last_verified_at: string | null;
  bundle_json: CERBundle;
  canonical_json: string;
  import_source: ImportSource | null;
  imported_by: string | null;
}

/**
 * Required fields for bundle validation
 */
export const REQUIRED_BUNDLE_FIELDS = [
  'bundleVersion OR createdAt',
  'mode OR snapshot OR claim',
] as const;

/**
 * Validate a CER bundle for import
 */
export function validateCERBundle(bundle: unknown): BundleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!bundle || typeof bundle !== 'object') {
    return { valid: false, errors: ['Invalid bundle: must be a JSON object'], warnings };
  }
  
  const b = bundle as CERBundle;
  
  // Check for at least some identifying information
  if (!b.bundleVersion && !b.createdAt && !b.mode) {
    errors.push('Missing required field: bundleVersion, createdAt, or mode');
  }
  
  // Check for claim/input data
  const hasClaim = b.claim && typeof b.claim === 'object';
  const hasInput = (b.inputSnapshot || b.input) && typeof (b.inputSnapshot || b.input) === 'object';
  const hasSnapshot = b.snapshot && typeof b.snapshot === 'object';
  const hasOutput = b.output || b.result || b.decision;
  
  if (!hasClaim && !hasInput && !hasSnapshot && !hasOutput) {
    warnings.push('Bundle has no claim, input, snapshot, or output data');
  }
  
  // Validate snapshot if present
  if (hasSnapshot) {
    const snapshot = b.snapshot!;
    if (!snapshot.code || typeof snapshot.code !== 'string') {
      errors.push('Missing required field: snapshot.code must be a non-empty string');
    }
    if (typeof snapshot.seed !== 'number') {
      errors.push('Missing required field: snapshot.seed must be a number');
    }
    if (!Array.isArray(snapshot.vars)) {
      errors.push('Missing required field: snapshot.vars must be an array');
    }
  }
  
  // Determine mode
  let mode: AuditMode = 'static';
  if (b.mode) {
    if (['static', 'loop', 'decision', 'attestation'].includes(b.mode)) {
      mode = b.mode;
    } else {
      warnings.push(`Unknown mode "${b.mode}", defaulting to "static"`);
    }
  } else if (hasSnapshot && b.snapshot?.execution?.loop) {
    mode = 'loop';
  } else if (b.decision) {
    mode = 'decision';
  }
  
  // Extract expected hashes
  let expectedImageHash: string | null = null;
  let expectedAnimationHash: string | null = null;
  
  // Check multiple locations for hashes
  expectedImageHash = 
    b.expectedImageHash ||
    b.expectedPosterHash ||
    b.baseline?.expectedImageHash ||
    b.baseline?.posterHash ||
    b.baseline?.imageHash ||
    null;
    
  if (mode === 'loop') {
    expectedAnimationHash =
      b.expectedAnimationHash ||
      b.baseline?.expectedAnimationHash ||
      b.baseline?.animationHash ||
      null;
  }
  
  // Validate loop mode has animation hash if snapshot present
  if (mode === 'loop' && hasSnapshot && !expectedAnimationHash) {
    warnings.push('Loop mode bundle with snapshot is missing expectedAnimationHash');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedBundle: b,
    mode,
    expectedImageHash,
    expectedAnimationHash,
    hasSnapshot,
  };
}

/**
 * Extract title from various bundle formats
 */
export function extractTitle(bundle: CERBundle): string | null {
  return (
    bundle.claim?.title ||
    (bundle.inputSnapshot as Record<string, unknown>)?.title as string ||
    (bundle.input as Record<string, unknown>)?.title as string ||
    null
  );
}

/**
 * Extract statement from various bundle formats
 */
export function extractStatement(bundle: CERBundle): string | null {
  return (
    bundle.claim?.statement ||
    (bundle.inputSnapshot as Record<string, unknown>)?.statement as string ||
    (bundle.input as Record<string, unknown>)?.description as string ||
    null
  );
}

/**
 * Extract claim type from various bundle formats
 */
export function extractClaimType(bundle: CERBundle): string | null {
  return (
    bundle.claim?.type ||
    (bundle.inputSnapshot as Record<string, unknown>)?.type as string ||
    null
  );
}

/**
 * Extract subject from various bundle formats
 */
export function extractSubject(bundle: CERBundle): string | null {
  return (
    bundle.claim?.subject ||
    (bundle.inputSnapshot as Record<string, unknown>)?.subject as string ||
    null
  );
}
