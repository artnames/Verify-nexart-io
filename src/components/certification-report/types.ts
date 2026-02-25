/**
 * Shared types for the Certification Report UI.
 */

export type BundleKind = 'ai-execution' | 'code-mode';

export interface CertificationReportProps {
  /** Raw bundle object (read-only, never mutated) */
  bundle: Record<string, unknown>;
  /** Detected bundle kind */
  bundleKind: BundleKind;
  /** Verification status */
  verifyStatus: 'pass' | 'fail' | 'error';
  /** Reason code on failure */
  verifyCode?: string;
  /** Detail lines on failure */
  verifyDetails?: string[];
  /** Additional children rendered after the report (e.g. Node Attestation, Attestation actions) */
  children?: React.ReactNode;
}

/** Extracted summary fields common to both bundle types */
export interface CertSummary {
  certType: string;
  status: 'pass' | 'fail' | 'error';
  issuedAt: string | null;
  application: string | null;
  protocolVersion: string | null;
  sdkVersion: string | null;
  bundleSizeBytes: number;
  certificateHash: string | null;
}

/** Fields for the "Inputs" panel */
export interface InputFields {
  /** For AI CER: prompt / input */
  prompt?: unknown;
  input?: unknown;
  /** For Code Mode: claim, source, vars */
  claim?: unknown;
  source?: unknown;
  vars?: Record<string, unknown>;
  code?: string;
  seed?: number;
}

/** Fields for the "Execution Conditions" panel */
export interface ExecutionConditions {
  provider?: string;
  model?: string;
  modelVersion?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;
  engine?: string;
  runtime?: string;
  policy?: string;
  determinism?: string;
  workflowId?: string;
  runId?: string;
  stepIndex?: number;
  prevStepHash?: string;
  executionId?: string;
  parameters?: Record<string, unknown>;
}

/** Fields for the "Outputs" panel */
export interface OutputFields {
  output?: unknown;
  result?: unknown;
  decision?: unknown;
}

/** Fields for the "Metadata" panel */
export interface MetadataFields {
  source?: string;
  tags?: string[];
  appId?: string;
  conversationId?: string;
  workflowId?: string;
  executionId?: string;
  extra: Record<string, unknown>;
}

/** Extracted hash evidence */
export interface HashEvidence {
  certificateHash?: string;
  inputHash?: string;
  outputHash?: string;
  expectedImageHash?: string;
  expectedAnimationHash?: string;
  bundleType?: string;
  bundleVersion?: string;
}
