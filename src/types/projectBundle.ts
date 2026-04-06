/**
 * Project Bundle types for NexArt project-level verification.
 *
 * A project bundle groups multiple individually certified executions
 * (CER steps) into a single verifiable project artifact.
 */

export interface ProjectBundleStep {
  sequence: number;
  label?: string;
  title?: string;
  stepType?: string;
  executionId?: string;
  certificateHash?: string;
  recordedAt?: string;
  model?: string;
  tool?: string;
  provider?: string;
  /** The full CER bundle for this step */
  bundle: Record<string, unknown>;
  /** Step-level verification status (populated by verify logic) */
  verificationStatus?: 'pass' | 'fail' | 'error' | 'pending';
  verificationCode?: string;
  verificationDetails?: string[];
}

export interface ProjectBundleManifest {
  bundleType: 'cer.project.v1';
  version?: string;
  projectId: string;
  title?: string;
  goal?: string;
  summary?: string;
  finalOutput?: string;
  app?: string;
  framework?: string;
  tags?: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  /** Project-level hash covering the manifest + ordered step hashes */
  projectHash?: string;
  /** Ordered certified steps */
  steps: ProjectBundleStep[];
  /** Protocol metadata */
  protocolVersion?: string;
  /** Additional metadata */
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Detect whether a bundle is a Project Bundle
 */
export function isProjectBundle(bundle: unknown): bundle is ProjectBundleManifest {
  if (!bundle || typeof bundle !== 'object') return false;
  const b = bundle as Record<string, unknown>;
  return (
    b.bundleType === 'cer.project.v1' &&
    Array.isArray(b.steps)
  );
}

/**
 * Verify project bundle structural validity
 */
export function validateProjectBundleStructure(bundle: unknown): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bundle || typeof bundle !== 'object') {
    return { valid: false, errors: ['Invalid bundle: must be a JSON object'], warnings };
  }

  const b = bundle as Record<string, unknown>;

  if (b.bundleType !== 'cer.project.v1') {
    errors.push('bundleType must be "cer.project.v1"');
  }

  if (!b.projectId || typeof b.projectId !== 'string') {
    errors.push('Missing projectId');
  }

  if (!Array.isArray(b.steps)) {
    errors.push('Missing or invalid steps array');
    return { valid: errors.length === 0, errors, warnings };
  }

  const steps = b.steps as unknown[];
  if (steps.length === 0) {
    warnings.push('Project bundle contains no steps');
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step || typeof step !== 'object') {
      errors.push(`Step ${i}: not a valid object`);
      continue;
    }
    const s = step as Record<string, unknown>;
    if (typeof s.sequence !== 'number') {
      warnings.push(`Step ${i}: missing sequence number`);
    }
    if (!s.bundle || typeof s.bundle !== 'object') {
      errors.push(`Step ${i}: missing bundle object`);
    }
  }

  if (!b.title) warnings.push('Missing title');
  if (!b.startedAt) warnings.push('Missing startedAt');
  if (!b.completedAt) warnings.push('Missing completedAt');

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Sort steps by sequence number
 */
export function sortStepsBySequence(steps: ProjectBundleStep[]): ProjectBundleStep[] {
  return [...steps].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}
