/**
 * Project Bundle types for NexArt project-level verification.
 *
 * These types mirror the canonical definitions from @nexart/ai-execution.
 * Detection helper is thin — routing only, no verification semantics.
 *
 * Canonical verification is performed by verifyProjectBundle() from the SDK.
 */

// Re-export SDK types for consumer convenience
export type {
  ProjectBundle,
  ProjectBundleVerifyResult,
  ProjectBundleStepEntry,
  ProjectBundleStepVerifyResult,
  ProjectBundleIntegrity,
  ProjectBundleStepModelIdentity,
  ProjectBundleStepType,
} from '@nexart/ai-execution';

/**
 * Detect whether a raw JSON object is a NexArt project bundle.
 *
 * This is a lightweight routing check only — it does NOT validate structure.
 * Canonical validation is performed by verifyProjectBundle() from the SDK.
 */
export function isProjectBundle(bundle: unknown): boolean {
  if (!bundle || typeof bundle !== 'object') return false;
  const b = bundle as Record<string, unknown>;
  return b.bundleType === 'cer.project.bundle.v1';
}
