/**
 * Pure extraction helpers — read-only access to the bundle.
 * Never mutate the bundle object.
 */

import type {
  BundleKind,
  CertSummary,
  InputFields,
  ExecutionConditions,
  OutputFields,
  MetadataFields,
  HashEvidence,
  AttestationFields,
} from './types';

const get = (obj: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce((o: any, k) => o?.[k], obj);
};

export function extractSummary(
  bundle: Record<string, unknown>,
  kind: BundleKind,
  status: 'pass' | 'fail' | 'error',
): CertSummary {
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;
  const meta = bundle.meta as Record<string, unknown> | undefined;

  const certType = kind === 'ai-execution'
    ? 'AI Execution Record'
    : 'Code Mode Certified Run';

  const issuedAt = (bundle.createdAt as string)
    || (snapshot?.timestamp as string)
    || null;

  const application = (snapshot?.appId as string)
    || (meta?.source as string)
    || (bundle.subject as string)
    || null;

  const protocolVersion = (snapshot?.protocolVersion as string)
    || (bundle.canonicalProtocolVersion as string)
    || (get(bundle, 'attestation.protocolVersion') as string)
    || null;

  const sdkVersion = (snapshot?.sdkVersion as string)
    || (bundle.version as string)
    || (bundle.bundleVersion as string)
    || null;

  const bundleSizeBytes = new Blob([JSON.stringify(bundle)]).size;

  // AI CER extras
  const provider = snapshot?.provider as string | undefined;
  const model = snapshot?.model as string | undefined;
  const modelVersion = snapshot?.modelVersion as string | undefined;
  const workflowId = (snapshot?.workflowId as string) || (meta?.workflowId as string) || undefined;
  const conversationId = (snapshot?.conversationId as string) || (meta?.conversationId as string) || undefined;
  const executionId = snapshot?.executionId as string | undefined;
  const executionSurface = snapshot?.executionSurface as string | undefined;
  const stepIndex = snapshot?.stepIndex as number | undefined;
  const prevStepHash = (snapshot?.prevStepHash as string) || (meta?.prevStepHash as string) || undefined;
  const snapshotTimestamp = snapshot?.timestamp as string | undefined;
  const source = meta?.source as string | undefined;
  const tags = meta?.tags as string[] | undefined;

  // Extract attestation block
  const attestation = extractAttestationBlock(bundle);

  return {
    certType,
    status,
    issuedAt,
    application,
    protocolVersion,
    sdkVersion,
    bundleSizeBytes,
    certificateHash: (bundle.certificateHash as string) || null,
    bundleType: (bundle.bundleType as string) || undefined,
    bundleVersion: (bundle.version as string) || (bundle.bundleVersion as string) || undefined,
    provider,
    model,
    modelVersion,
    workflowId,
    conversationId,
    executionId,
    executionSurface,
    stepIndex,
    prevStepHash,
    snapshotTimestamp,
    source,
    tags,
    attestation,
  };
}

/** Extract attestation block from bundle (read-only) — checks both top-level and meta.attestation */
function extractAttestationBlock(bundle: Record<string, unknown>): AttestationFields | undefined {
  // Prefer meta.attestation (AI CER standard location), fall back to top-level
  const meta = bundle.meta as Record<string, unknown> | undefined;
  const metaAtt = meta?.attestation as Record<string, unknown> | undefined;
  const topAtt = bundle.attestation as Record<string, unknown> | undefined;
  const att = (metaAtt && typeof metaAtt === 'object') ? metaAtt : topAtt;
  
  if (!att || typeof att !== 'object') return undefined;

  // Check for signed receipt in any location
  const hasSignedReceipt = !!(
    att.receipt || att.signature || att.signatureB64Url ||
    (metaAtt && (metaAtt.receipt || metaAtt.signature || metaAtt.signatureB64Url))
  );

  // Determine verified status from attestationStatus or verified field
  const verified = att.verified === true
    || (att.attestationStatus as string) === 'ATTESTED';

  return {
    verified,
    attestationId: (att.attestationId || att.attestationHash) as string | undefined,
    nodeRuntimeHash: att.nodeRuntimeHash as string | undefined,
    protocolVersion: att.protocolVersion as string | undefined,
    attestedAt: att.attestedAt as string | undefined,
    requestId: att.requestId as string | undefined,
    checks: att.checks as AttestationFields['checks'] | undefined,
    hasSignedReceipt,
  };
}

export function extractInputs(bundle: Record<string, unknown>, kind: BundleKind): InputFields {
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;

  if (kind === 'ai-execution') {
    return {
      prompt: snapshot?.prompt,
      input: snapshot?.input,
    };
  }

  // Code Mode
  const claim = bundle.claim as unknown;
  const source = (bundle.sources as unknown) || (get(bundle, 'claim.sources') as unknown);
  const code = snapshot?.code as string | undefined;
  const seed = snapshot?.seed as number | undefined;

  // Extract vars (VAR0..VAR9)
  const vars: Record<string, unknown> = {};
  if (snapshot) {
    for (const key of Object.keys(snapshot)) {
      if (/^VAR\d+$/i.test(key) || key === 'vars') {
        vars[key] = snapshot[key];
      }
    }
  }

  return { claim, source, code, seed, vars: Object.keys(vars).length > 0 ? vars : undefined };
}

export function extractConditions(bundle: Record<string, unknown>, kind: BundleKind): ExecutionConditions {
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;

  if (kind === 'ai-execution') {
    const params = snapshot?.parameters as Record<string, unknown> | undefined;
    return {
      provider: snapshot?.provider as string | undefined,
      model: snapshot?.model as string | undefined,
      modelVersion: snapshot?.modelVersion as string | undefined,
      temperature: params?.temperature as number | undefined,
      maxTokens: (params?.maxTokens ?? params?.max_tokens) as number | undefined,
      topP: (params?.topP ?? params?.top_p) as number | undefined,
      seed: params?.seed as number | undefined,
      executionId: snapshot?.executionId as string | undefined,
      executionSurface: snapshot?.executionSurface as string | undefined,
      stepIndex: snapshot?.stepIndex as number | undefined,
      workflowId: snapshot?.workflowId as string | undefined,
      parameters: params,
    };
  }

  // Code Mode
  return {
    engine: snapshot?.engine as string | undefined,
    runtime: snapshot?.runtime as string | undefined,
    policy: (bundle.policy as string) || (get(bundle, 'decision.policy') as string) || undefined,
    determinism: snapshot?.determinism as string | undefined,
    seed: snapshot?.seed as number | undefined,
    workflowId: (get(bundle, 'meta.workflowId') as string) || undefined,
    runId: (get(bundle, 'meta.runId') as string) || undefined,
    stepIndex: get(bundle, 'meta.stepIndex') as number | undefined,
    prevStepHash: get(bundle, 'meta.prevStepHash') as string | undefined,
  };
}

export function extractOutputs(bundle: Record<string, unknown>, kind: BundleKind): OutputFields {
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;

  if (kind === 'ai-execution') {
    return {
      output: snapshot?.output,
    };
  }

  return {
    output: bundle.output,
    result: bundle.result,
    decision: bundle.decision,
  };
}

export function extractMetadata(bundle: Record<string, unknown>, kind: BundleKind): MetadataFields {
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;
  const meta = (bundle.meta as Record<string, unknown>) || {};

  const fields: MetadataFields = {
    source: meta.source as string | undefined,
    tags: meta.tags as string[] | undefined,
    appId: (snapshot?.appId as string) || (meta.appId as string) || undefined,
    conversationId: meta.conversationId as string | undefined,
    workflowId: meta.workflowId as string | undefined,
    executionId: snapshot?.executionId as string | undefined,
    extra: {},
  };

  // Collect remaining meta keys not already mapped
  const knownMetaKeys = new Set(['source', 'tags', 'appId', 'conversationId', 'workflowId', 'attestation']);
  for (const [k, v] of Object.entries(meta)) {
    if (!knownMetaKeys.has(k) && v !== undefined && v !== null) {
      fields.extra[k] = v;
    }
  }

  return fields;
}

/** Extract context signals from the bundle. Returns empty array if none. */
export function extractContextSignals(bundle: Record<string, unknown>): Array<Record<string, unknown>> {
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;
  const meta = bundle.meta as Record<string, unknown> | undefined;

  // Check snapshot.signals, meta.signals, and top-level signals
  const raw = (snapshot?.signals ?? meta?.signals ?? bundle.signals) as unknown;
  if (!Array.isArray(raw)) return [];

  // Filter to objects that at least have a 'type' field
  return raw.filter(
    (s): s is Record<string, unknown> =>
      s !== null && typeof s === 'object' && typeof (s as any).type === 'string',
  );
}

export function extractEvidence(bundle: Record<string, unknown>, kind: BundleKind): HashEvidence {
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;

  return {
    certificateHash: bundle.certificateHash as string | undefined,
    inputHash: snapshot?.inputHash as string | undefined,
    outputHash: snapshot?.outputHash as string | undefined,
    expectedImageHash: (bundle.expectedImageHash as string)
      || (get(bundle, 'baseline.posterHash') as string)
      || (get(bundle, 'baseline.imageHash') as string)
      || undefined,
    expectedAnimationHash: (bundle.expectedAnimationHash as string)
      || (get(bundle, 'baseline.animationHash') as string)
      || undefined,
    bundleType: (bundle.bundleType as string) || undefined,
    bundleVersion: (bundle.version as string) || (bundle.bundleVersion as string) || undefined,
  };
}
