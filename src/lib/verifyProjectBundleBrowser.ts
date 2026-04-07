/**
 * Browser-safe reimplementation of verifyProjectBundle from @nexart/ai-execution.
 *
 * The SDK's verifyProjectBundle uses Node.js crypto.createHash("sha256") internally,
 * which causes "(void 0) is not a function" at runtime in the browser.
 *
 * This module mirrors the SDK's verification logic exactly, but uses WebCrypto
 * (crypto.subtle.digest) for all hashing operations.
 *
 * Canonical JSON algorithm matches the SDK's toCanonicalJson:
 *   - sorted keys, no whitespace, null preserved, undefined skipped
 */

/* ------------------------------------------------------------------ */
/*  Canonical JSON (mirrors SDK's canonicalize exactly)               */
/* ------------------------------------------------------------------ */

function toCanonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number not allowed in canonical JSON: ${value}`);
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(item => toCanonicalJson(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries = keys
      .map(key => {
        const val = obj[key];
        if (val === undefined) return null;
        return JSON.stringify(key) + ':' + toCanonicalJson(val);
      })
      .filter(e => e !== null);
    return '{' + entries.join(',') + '}';
  }
  throw new Error(`Unsupported type for canonical JSON: ${typeof value}`);
}

/* ------------------------------------------------------------------ */
/*  WebCrypto SHA-256                                                 */
/* ------------------------------------------------------------------ */

async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashUtf8(value: string): Promise<string> {
  return `sha256:${await sha256Hex(value)}`;
}

async function hashCanonicalJson(value: unknown): Promise<string> {
  const canonical = toCanonicalJson(value);
  return `sha256:${await sha256Hex(canonical)}`;
}

async function computeInputHash(input: unknown): Promise<string> {
  return typeof input === 'string' ? hashUtf8(input) : hashCanonicalJson(input);
}

async function computeOutputHash(output: unknown): Promise<string> {
  return typeof output === 'string' ? hashUtf8(output) : hashCanonicalJson(output);
}

async function computeCertificateHashBrowser(payload: unknown): Promise<string> {
  const canonical = toCanonicalJson(payload);
  return `sha256:${await sha256Hex(canonical)}`;
}

async function computeProjectHashBrowser(payload: unknown): Promise<string> {
  const canonical = toCanonicalJson(payload);
  return `sha256:${await sha256Hex(canonical)}`;
}

/* ------------------------------------------------------------------ */
/*  Verify codes (mirrors SDK enum)                                   */
/* ------------------------------------------------------------------ */

export const CerVerifyCode = {
  OK: 'OK',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
  INVALID_SHA256_FORMAT: 'INVALID_SHA256_FORMAT',
  INPUT_HASH_MISMATCH: 'INPUT_HASH_MISMATCH',
  OUTPUT_HASH_MISMATCH: 'OUTPUT_HASH_MISMATCH',
  SNAPSHOT_HASH_MISMATCH: 'SNAPSHOT_HASH_MISMATCH',
  CERTIFICATE_HASH_MISMATCH: 'CERTIFICATE_HASH_MISMATCH',
  CANONICALIZATION_ERROR: 'CANONICALIZATION_ERROR',
  PROJECT_HASH_MISMATCH: 'PROJECT_HASH_MISMATCH',
  STEP_REGISTRY_MISMATCH: 'STEP_REGISTRY_MISMATCH',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/* ------------------------------------------------------------------ */
/*  Result types (mirrors SDK types)                                  */
/* ------------------------------------------------------------------ */

export interface ProjectBundleStepVerifyResult {
  stepId: string;
  sequence: number;
  executionId: string;
  certificateHash?: string;
  ok: boolean;
  code: string;
  errors: string[];
}

export interface ProjectBundleVerifyResult {
  ok: boolean;
  code: string;
  errors: string[];
  projectHashValid?: boolean;
  structuralValid?: boolean;
  totalSteps?: number;
  passedSteps?: number;
  failedSteps?: number;
  steps: ProjectBundleStepVerifyResult[];
}

/* ------------------------------------------------------------------ */
/*  validateParameters (mirrors SDK)                                  */
/* ------------------------------------------------------------------ */

function validateParameters(params: any): string[] {
  const errors: string[] = [];
  if (typeof params.temperature !== 'number' || !Number.isFinite(params.temperature)) {
    errors.push(`parameters.temperature must be a finite number, got: ${params.temperature}`);
  }
  if (typeof params.maxTokens !== 'number' || !Number.isFinite(params.maxTokens)) {
    errors.push(`parameters.maxTokens must be a finite number, got: ${params.maxTokens}`);
  }
  if (params.topP !== null && (typeof params.topP !== 'number' || !Number.isFinite(params.topP))) {
    errors.push(`parameters.topP must be a finite number or null, got: ${params.topP}`);
  }
  if (params.seed !== null && (typeof params.seed !== 'number' || !Number.isFinite(params.seed))) {
    errors.push(`parameters.seed must be a finite number or null, got: ${params.seed}`);
  }
  return errors;
}

/* ------------------------------------------------------------------ */
/*  verifySnapshot (browser-safe, async)                              */
/* ------------------------------------------------------------------ */

interface SnapshotVerifyResult {
  ok: boolean;
  errors: string[];
  code: string;
  details?: string[];
}

async function verifySnapshot(snapshot: any): Promise<SnapshotVerifyResult> {
  const schemaErrors: string[] = [];
  const formatErrors: string[] = [];
  const inputHashErrors: string[] = [];
  const outputHashErrors: string[] = [];

  if (snapshot.type !== 'ai.execution.v1') {
    schemaErrors.push(`Expected type "ai.execution.v1", got "${snapshot.type}"`);
  }
  if (snapshot.protocolVersion !== '1.2.0') {
    schemaErrors.push(`Expected protocolVersion "1.2.0", got "${snapshot.protocolVersion}"`);
  }
  if (snapshot.executionSurface !== 'ai') {
    schemaErrors.push(`Expected executionSurface "ai", got "${snapshot.executionSurface}"`);
  }
  if (!snapshot.executionId || typeof snapshot.executionId !== 'string') {
    schemaErrors.push('executionId must be a non-empty string');
  }
  if (!snapshot.timestamp || typeof snapshot.timestamp !== 'string') {
    schemaErrors.push('timestamp must be a non-empty string');
  }
  if (!snapshot.provider || typeof snapshot.provider !== 'string') {
    schemaErrors.push('provider must be a non-empty string');
  }
  if (!snapshot.model || typeof snapshot.model !== 'string') {
    schemaErrors.push('model must be a non-empty string');
  }
  if (!snapshot.prompt || typeof snapshot.prompt !== 'string') {
    schemaErrors.push('prompt must be a non-empty string');
  }
  if (snapshot.input === undefined || snapshot.input === null) {
    schemaErrors.push('input must be a string or object');
  }
  if (snapshot.output === undefined || snapshot.output === null) {
    schemaErrors.push('output must be a string or object');
  }

  const paramErrors = validateParameters(snapshot.parameters);
  schemaErrors.push(...paramErrors);

  if (!snapshot.inputHash || !snapshot.inputHash.startsWith('sha256:')) {
    formatErrors.push(`inputHash must start with "sha256:", got "${snapshot.inputHash}"`);
  }
  if (!snapshot.outputHash || !snapshot.outputHash.startsWith('sha256:')) {
    formatErrors.push(`outputHash must start with "sha256:", got "${snapshot.outputHash}"`);
  }

  if (formatErrors.length === 0) {
    const expectedInputHash = await computeInputHash(snapshot.input);
    if (snapshot.inputHash !== expectedInputHash) {
      inputHashErrors.push(`inputHash mismatch: expected ${expectedInputHash}, got ${snapshot.inputHash}`);
    }
    const expectedOutputHash = await computeOutputHash(snapshot.output);
    if (snapshot.outputHash !== expectedOutputHash) {
      outputHashErrors.push(`outputHash mismatch: expected ${expectedOutputHash}, got ${snapshot.outputHash}`);
    }
  }

  const errors = [...schemaErrors, ...formatErrors, ...inputHashErrors, ...outputHashErrors];
  if (errors.length === 0) {
    return { ok: true, errors: [], code: CerVerifyCode.OK };
  }

  let code: string;
  let details: string[];
  if (schemaErrors.length > 0) {
    code = CerVerifyCode.SCHEMA_ERROR; details = schemaErrors;
  } else if (formatErrors.length > 0) {
    code = CerVerifyCode.INVALID_SHA256_FORMAT; details = formatErrors;
  } else if (inputHashErrors.length > 0 && outputHashErrors.length > 0) {
    code = CerVerifyCode.SNAPSHOT_HASH_MISMATCH; details = [...inputHashErrors, ...outputHashErrors];
  } else if (inputHashErrors.length > 0) {
    code = CerVerifyCode.INPUT_HASH_MISMATCH; details = inputHashErrors;
  } else if (outputHashErrors.length > 0) {
    code = CerVerifyCode.OUTPUT_HASH_MISMATCH; details = outputHashErrors;
  } else {
    code = CerVerifyCode.UNKNOWN_ERROR; details = errors;
  }
  return { ok: false, errors, code, details };
}

/* ------------------------------------------------------------------ */
/*  verifyCer (browser-safe, async)                                   */
/* ------------------------------------------------------------------ */

function buildContext(signals: unknown[] | undefined): { signals: unknown[] } | undefined {
  if (!signals || !Array.isArray(signals) || signals.length === 0) return undefined;
  return { signals };
}

interface CerVerifyResult {
  ok: boolean;
  errors: string[];
  code: string;
  details?: string[];
}

async function verifyCerBrowser(bundle: any): Promise<CerVerifyResult> {
  const schemaErrors: string[] = [];
  const formatErrors: string[] = [];

  if (bundle.bundleType !== 'cer.ai.execution.v1') {
    schemaErrors.push(`Expected bundleType "cer.ai.execution.v1", got "${bundle.bundleType}"`);
  }
  if (bundle.version !== '0.1') {
    schemaErrors.push(`Expected version "0.1", got "${bundle.version}"`);
  }
  if (!bundle.createdAt || typeof bundle.createdAt !== 'string') {
    schemaErrors.push('createdAt must be a non-empty string');
  }
  if (!bundle.certificateHash || !bundle.certificateHash.startsWith('sha256:')) {
    formatErrors.push(`certificateHash must start with "sha256:", got "${bundle.certificateHash}"`);
  }
  if (!bundle.snapshot) {
    schemaErrors.push('snapshot is required');
    const allErrors = [...schemaErrors, ...formatErrors];
    return { ok: false, errors: allErrors, code: CerVerifyCode.SCHEMA_ERROR, details: schemaErrors };
  }

  let canonicalizationError: string | null = null;
  let snapshotResult: SnapshotVerifyResult | null = null;
  try {
    snapshotResult = await verifySnapshot(bundle.snapshot);
  } catch (err) {
    canonicalizationError = err instanceof Error ? err.message : String(err);
  }

  if (canonicalizationError !== null) {
    const errors = [...schemaErrors, ...formatErrors, canonicalizationError];
    return { ok: false, errors, code: CerVerifyCode.CANONICALIZATION_ERROR, details: [canonicalizationError] };
  }

  const snapshotErrors = snapshotResult!.errors;
  const certHashErrors: string[] = [];

  try {
    const payload: any = {
      bundleType: 'cer.ai.execution.v1',
      createdAt: bundle.createdAt,
      snapshot: bundle.snapshot,
      version: '0.1',
    };
    const verifyContext = buildContext(bundle.context?.signals);
    if (verifyContext) {
      payload.context = verifyContext;
    }
    const expectedHash = await computeCertificateHashBrowser(payload);
    if (bundle.certificateHash !== expectedHash) {
      certHashErrors.push(`certificateHash mismatch: expected ${expectedHash}, got ${bundle.certificateHash}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errors = [...schemaErrors, ...formatErrors, ...snapshotErrors, msg];
    return { ok: false, errors, code: CerVerifyCode.CANONICALIZATION_ERROR, details: [msg] };
  }

  const errors = [...schemaErrors, ...formatErrors, ...snapshotErrors, ...certHashErrors];
  if (errors.length === 0) {
    return { ok: true, errors: [], code: CerVerifyCode.OK };
  }

  let code: string;
  let details: string[];
  if (schemaErrors.length > 0) {
    code = CerVerifyCode.SCHEMA_ERROR; details = schemaErrors;
  } else if (formatErrors.length > 0) {
    code = CerVerifyCode.INVALID_SHA256_FORMAT; details = formatErrors;
  } else if (certHashErrors.length > 0 && snapshotErrors.length === 0) {
    code = CerVerifyCode.CERTIFICATE_HASH_MISMATCH; details = certHashErrors;
  } else if (snapshotResult && snapshotResult.code !== CerVerifyCode.OK) {
    code = snapshotResult.code; details = snapshotResult.details ?? snapshotErrors;
  } else if (certHashErrors.length > 0) {
    code = CerVerifyCode.CERTIFICATE_HASH_MISMATCH; details = certHashErrors;
  } else {
    code = CerVerifyCode.UNKNOWN_ERROR; details = errors;
  }
  return { ok: false, errors, code, details };
}

/* ------------------------------------------------------------------ */
/*  buildHashPayload (mirrors SDK exactly)                            */
/* ------------------------------------------------------------------ */

function buildHashPayload(fields: any): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    bundleType: 'cer.project.bundle.v1',
    version: '0.1',
    protocolVersion: '1.2.0',
    projectBundleId: fields.projectBundleId,
    projectTitle: fields.projectTitle,
    startedAt: fields.startedAt,
    completedAt: fields.completedAt,
    totalSteps: fields.totalSteps,
    stepRegistry: fields.stepRegistry,
  };
  if (fields.projectGoal !== undefined) payload.projectGoal = fields.projectGoal;
  if (fields.projectSummary !== undefined) payload.projectSummary = fields.projectSummary;
  if (fields.appName !== undefined) payload.appName = fields.appName;
  if (fields.frameworkName !== undefined) payload.frameworkName = fields.frameworkName;
  if (fields.tags !== undefined && fields.tags.length > 0) payload.tags = fields.tags;
  return payload;
}

/* ------------------------------------------------------------------ */
/*  verifyProjectBundle (browser-safe, async)                         */
/* ------------------------------------------------------------------ */

export async function verifyProjectBundleBrowser(bundle: any): Promise<ProjectBundleVerifyResult> {
  if (!bundle || typeof bundle !== 'object' || bundle.bundleType !== 'cer.project.bundle.v1') {
    return {
      ok: false,
      code: CerVerifyCode.SCHEMA_ERROR,
      errors: ['verifyProjectBundle: input is not a valid project bundle (bundleType must be "cer.project.bundle.v1")'],
      steps: [],
    };
  }

  const b = bundle;
  const projectErrors: string[] = [];
  const stepResults: ProjectBundleStepVerifyResult[] = [];

  if (b.version !== '0.1') projectErrors.push(`version must be "0.1", got "${b.version}"`);
  if (b.protocolVersion !== '1.2.0') projectErrors.push(`protocolVersion must be "1.2.0", got "${b.protocolVersion}"`);
  if (!b.projectBundleId || typeof b.projectBundleId !== 'string') projectErrors.push('projectBundleId must be a non-empty string');
  if (!b.projectTitle || typeof b.projectTitle !== 'string') projectErrors.push('projectTitle must be a non-empty string');
  if (!b.startedAt || typeof b.startedAt !== 'string') projectErrors.push('startedAt must be a non-empty string');
  if (!b.completedAt || typeof b.completedAt !== 'string') projectErrors.push('completedAt must be a non-empty string');

  const integrityOk = b.integrity && typeof b.integrity === 'object'
    && typeof b.integrity.projectHash === 'string'
    && b.integrity.projectHash.startsWith('sha256:')
    && b.integrity.algorithm === 'sha256-canonical-json';

  if (!b.integrity || typeof b.integrity !== 'object') {
    projectErrors.push('integrity block is required');
  } else {
    if (!b.integrity.projectHash || !b.integrity.projectHash.startsWith('sha256:'))
      projectErrors.push('integrity.projectHash must be a "sha256:"-prefixed string');
    if (b.integrity.algorithm !== 'sha256-canonical-json')
      projectErrors.push(`integrity.algorithm must be "sha256-canonical-json", got "${b.integrity.algorithm}"`);
  }

  if (!Array.isArray(b.stepRegistry) || b.stepRegistry.length === 0) {
    projectErrors.push('stepRegistry must be a non-empty array');
    return {
      ok: false, code: CerVerifyCode.SCHEMA_ERROR, errors: projectErrors,
      structuralValid: false, totalSteps: typeof b.totalSteps === 'number' ? b.totalSteps : undefined,
      steps: [],
    };
  }

  if (!b.embeddedBundles || typeof b.embeddedBundles !== 'object' || Array.isArray(b.embeddedBundles)) {
    projectErrors.push('embeddedBundles must be a plain object keyed by stepId');
    return {
      ok: false, code: CerVerifyCode.SCHEMA_ERROR, errors: projectErrors,
      structuralValid: false, totalSteps: typeof b.totalSteps === 'number' ? b.totalSteps : undefined,
      steps: [],
    };
  }

  if (typeof b.totalSteps !== 'number' || b.totalSteps !== b.stepRegistry.length) {
    projectErrors.push(`totalSteps mismatch: declared ${b.totalSteps} but stepRegistry has ${b.stepRegistry.length} entries`);
  }

  // Validate stepRegistry structural integrity
  const allStepIds = new Set<string>();
  for (const step of b.stepRegistry) {
    if (step.stepId && typeof step.stepId === 'string') allStepIds.add(step.stepId);
  }

  const seenStepIds = new Set<string>();
  const seenExecutionIds = new Set<string>();
  for (const step of b.stepRegistry) {
    if (!step.stepId || typeof step.stepId !== 'string') {
      projectErrors.push('stepRegistry entry is missing a valid stepId'); continue;
    }
    if (seenStepIds.has(step.stepId)) projectErrors.push(`duplicate stepId: "${step.stepId}"`);
    seenStepIds.add(step.stepId);
    if (!step.executionId || typeof step.executionId !== 'string') {
      projectErrors.push(`step "${step.stepId}": executionId must be a non-empty string`);
    } else {
      if (seenExecutionIds.has(step.executionId))
        projectErrors.push(`duplicate executionId: "${step.executionId}" (at step "${step.stepId}")`);
      seenExecutionIds.add(step.executionId);
    }
  }

  const seenSequences = new Set<number>();
  for (const step of b.stepRegistry) {
    if (!step.stepId) continue;
    if (typeof step.sequence !== 'number' || !Number.isInteger(step.sequence) || step.sequence < 0) {
      projectErrors.push(`step "${step.stepId}": sequence must be a non-negative integer`);
    } else {
      if (seenSequences.has(step.sequence))
        projectErrors.push(`duplicate sequence value: ${step.sequence} (at step "${step.stepId}")`);
      seenSequences.add(step.sequence);
    }
  }

  for (const step of b.stepRegistry) {
    if (!step.stepId) continue;
    if (step.parentStepIds && step.parentStepIds.length > 0) {
      for (const parentId of step.parentStepIds) {
        if (!allStepIds.has(parentId))
          projectErrors.push(`step "${step.stepId}": parentStepId "${parentId}" does not resolve to a known stepId`);
      }
    }
  }

  const structuralValid = projectErrors.length === 0;

  // Verify each embedded CER
  for (const step of b.stepRegistry) {
    if (!step.stepId) continue;
    const embedded = b.embeddedBundles[step.stepId];
    const stepErrors: string[] = [];
    let stepCode: string = CerVerifyCode.OK;

    if (!embedded) {
      stepErrors.push(`step "${step.stepId}": no embedded bundle found in embeddedBundles`);
      stepCode = CerVerifyCode.STEP_REGISTRY_MISMATCH;
    } else {
      const embeddedExecId = embedded.snapshot?.executionId;
      if (embeddedExecId !== step.executionId) {
        stepErrors.push(`step "${step.stepId}": executionId mismatch — registry has "${step.executionId}", embedded bundle has "${embeddedExecId}"`);
        stepCode = CerVerifyCode.STEP_REGISTRY_MISMATCH;
      }
      if (embedded.certificateHash !== step.certificateHash) {
        stepErrors.push(`step "${step.stepId}": certificateHash mismatch — registry has "${step.certificateHash}", embedded bundle has "${embedded.certificateHash}"`);
        if (stepCode === CerVerifyCode.OK) stepCode = CerVerifyCode.CERTIFICATE_HASH_MISMATCH;
      }

      let innerResult: CerVerifyResult | null;
      try {
        innerResult = await verifyCerBrowser(embedded);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stepErrors.push(`step "${step.stepId}" embedded CER threw during verification: ${msg}`);
        if (stepCode === CerVerifyCode.OK) stepCode = CerVerifyCode.CANONICALIZATION_ERROR;
        innerResult = null;
      }
      if (innerResult && !innerResult.ok) {
        for (const e of innerResult.errors) {
          stepErrors.push(`step "${step.stepId}" embedded CER: ${e}`);
        }
        if (stepCode === CerVerifyCode.OK) stepCode = innerResult.code;
      }
    }

    stepResults.push({
      stepId: step.stepId,
      sequence: typeof step.sequence === 'number' ? step.sequence : -1,
      executionId: step.executionId ?? '',
      certificateHash: step.certificateHash,
      ok: stepErrors.length === 0,
      code: stepCode,
      errors: stepErrors,
    });
  }

  const passedSteps = stepResults.filter(s => s.ok).length;
  const failedSteps = stepResults.filter(s => !s.ok).length;

  // Verify project hash
  let projectHashValid: boolean | undefined = undefined;
  if (integrityOk) {
    try {
      const hashPayload = buildHashPayload({
        projectBundleId: b.projectBundleId,
        projectTitle: b.projectTitle,
        startedAt: b.startedAt,
        completedAt: b.completedAt,
        totalSteps: b.totalSteps,
        stepRegistry: b.stepRegistry,
        projectGoal: b.projectGoal,
        projectSummary: b.projectSummary,
        appName: b.appName,
        frameworkName: b.frameworkName,
        tags: b.tags,
      });
      const expectedHash = await computeProjectHashBrowser(hashPayload);
      if (b.integrity.projectHash !== expectedHash) {
        projectErrors.push(`integrity.projectHash mismatch: expected ${expectedHash}, got ${b.integrity.projectHash}`);
        projectHashValid = false;
      } else {
        projectHashValid = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      projectErrors.push(`project hash computation error: ${msg}`);
      projectHashValid = false;
    }
  }

  const stepErrorsFlat = stepResults.flatMap(s => s.errors);
  const allErrors = [...projectErrors, ...stepErrorsFlat];
  const allOk = allErrors.length === 0;

  if (allOk) {
    return {
      ok: true, code: CerVerifyCode.OK, errors: [],
      projectHashValid: true, structuralValid: true,
      totalSteps: b.totalSteps, passedSteps, failedSteps: 0,
      steps: stepResults,
    };
  }

  const hasProjectHashMismatch = projectErrors.some(e => e.includes('projectHash mismatch'));
  const hasStepRegistryMismatch = stepResults.some(s => s.code === CerVerifyCode.STEP_REGISTRY_MISMATCH);
  const hasCertHashMismatch = stepResults.some(s => s.code === CerVerifyCode.CERTIFICATE_HASH_MISMATCH);

  let code: string;
  if (hasProjectHashMismatch) code = CerVerifyCode.PROJECT_HASH_MISMATCH;
  else if (hasStepRegistryMismatch) code = CerVerifyCode.STEP_REGISTRY_MISMATCH;
  else if (hasCertHashMismatch) code = CerVerifyCode.CERTIFICATE_HASH_MISMATCH;
  else if (projectErrors.length > 0) code = CerVerifyCode.SCHEMA_ERROR;
  else {
    const failedStep = stepResults.find(s => !s.ok);
    code = failedStep?.code ?? CerVerifyCode.UNKNOWN_ERROR;
  }

  const result: ProjectBundleVerifyResult = {
    ok: false, code, errors: allErrors,
    structuralValid,
    totalSteps: typeof b.totalSteps === 'number' ? b.totalSteps : undefined,
    passedSteps, failedSteps,
    steps: stepResults,
  };
  if (projectHashValid !== undefined) result.projectHashValid = projectHashValid;
  return result;
}
