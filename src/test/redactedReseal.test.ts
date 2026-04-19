/**
 * Tests for redacted reseal verification path.
 *
 * Confirms that public-safe redacted resealed CER artifacts:
 *  - are detected via meta.attestation.mode === 'redacted_reseal' or missing snapshot raw fields
 *  - are not falsely surfaced as CANONICALIZATION_ERROR / FAIL by the SDK
 *  - verify against the standard envelope hash
 *  - degrade to CONTEXT_NOT_PROTECTED when context.signals are present outside the hash scope
 *  - hard-fail with CERTIFICATE_HASH_MISMATCH if the envelope hash genuinely doesn't match
 */

import { describe, it, expect } from 'vitest';
import { verifyUploadedBundleAsync } from '@/lib/verifyBundle';

// Real reseal observed on prod (env hash matches without context).
const realReseal = {
  meta: {
    tags: ['demo'],
    source: 'audiot-demonstrator',
    attestation: {
      mode: 'redacted_reseal',
      hash: 'sha256:e848fde55a4143453d181ed26b79350842c98c967d63959afbb603e2624885d2',
      receipt: { receiptVersion: 'attestation.receipt.v1' },
      attestationId: 'a',
      attestorKeyId: 'k1',
      protocolVersion: '1.2.0',
      signatureB64Url: 'sig',
    },
  },
  context: {
    signals: [
      { step: 0, type: 'audit_started', actor: 'a', source: 'a', status: 'ok', payload: { authenticated: false, conversationId: 'Z5-pES2yiXElLSgH' }, timestamp: '2026-04-19T19:38:34.596Z' },
      { step: 1, type: 'input_loaded', actor: 'a', source: 'a', status: 'ok', payload: { provider: 'mock', inputLength: 8 }, timestamp: '2026-04-19T19:38:35.566Z' },
      { step: 2, type: 'policy_check_performed', actor: 'a', source: 'a', status: 'ok', payload: { policy: 'NexArt Baseline AI Use Policy', outcome: 'ALLOW', version: '1.0.0', severity: 'none', matchedUserRules: 0, matchedSensitiveCategories: [] }, timestamp: '2026-04-19T19:38:35.566Z' },
      { step: 3, type: 'recommendation_generated', actor: 'a', source: 'a', status: 'ok', payload: { model: 'mock-v1', executed: true, workflowId: 'policy-decision', outputLength: 1407 }, timestamp: '2026-04-19T19:38:35.878Z' },
      { step: 4, type: 'audit_completed', actor: 'a', source: 'a', status: 'ok', payload: { model: 'mock-v1', workflowId: 'policy-decision', signalCount: 4 }, timestamp: '2026-04-19T19:38:35.926Z' },
    ],
  },
  version: '0.1',
  snapshot: {
    type: 'ai.execution.v1',
    appId: 'llm-audit-ledger',
    model: 'mock-v1',
    provider: 'mock',
    inputHash: 'sha256:7f98506ac7260e0e07f44b12711de667391b133a45ff4c8d2478667416b0f7a1',
    stepIndex: 1,
    timestamp: '2026-04-19T19:38:35.926Z',
    outputHash: 'sha256:72a51605ed711e111b604fd810a24a063fb0c2c8e04c0d8330e7ac48ef4bbf4b',
    parameters: { seed: 1301081050, topP: 1, maxTokens: 1000, temperature: 0.7 },
    sdkVersion: '0.14.0',
    workflowId: 'policy-decision',
    executionId: 'KN1PHJwC8tfTe0DhPcXCwFus',
    modelVersion: null,
    conversationId: 'Z5-pES2yiXElLSgH',
    protocolVersion: '1.2.0',
    executionSurface: 'ai',
  },
  createdAt: '2026-04-19T19:38:35.926Z',
  bundleType: 'cer.ai.execution.v1',
  certificateHash: 'sha256:e848fde55a4143453d181ed26b79350842c98c967d63959afbb603e2624885d2',
};

describe('Redacted reseal verification', () => {
  it('does NOT surface CANONICALIZATION_ERROR for a legitimate redacted reseal', async () => {
    const result = await verifyUploadedBundleAsync(realReseal);
    expect(result.code).not.toBe('CANONICALIZATION_ERROR');
  });

  it('verifies the public envelope and downgrades to CONTEXT_NOT_PROTECTED (signals outside hash scope)', async () => {
    const result = await verifyUploadedBundleAsync(realReseal);
    expect(result.code).toBe('CONTEXT_NOT_PROTECTED');
    expect(result.degraded).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.contextIntegrityProtected).toBe(false);
    expect(result.verificationScope).toBe('core-only');
  });

  it('returns OK when the reseal has no context.signals', async () => {
    const noCtx = { ...realReseal };
    delete (noCtx as any).context;
    const result = await verifyUploadedBundleAsync(noCtx);
    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.contextIntegrityProtected).toBe(true);
  });

  it('returns CERTIFICATE_HASH_MISMATCH when the reseal envelope is tampered', async () => {
    const tampered = JSON.parse(JSON.stringify(realReseal));
    tampered.snapshot.executionId = 'TAMPERED';
    const result = await verifyUploadedBundleAsync(tampered);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CERTIFICATE_HASH_MISMATCH');
    expect(result.degraded).toBeFalsy();
  });

  it('detects reseal even without explicit meta.attestation.mode flag (snapshot lacks prompt/input/output)', async () => {
    const implicit = JSON.parse(JSON.stringify(realReseal));
    delete implicit.meta.attestation.mode;
    const result = await verifyUploadedBundleAsync(implicit);
    // Should still route through reseal path (snapshot is missing raw fields)
    expect(result.code).not.toBe('CANONICALIZATION_ERROR');
    expect(result.code).toBe('CONTEXT_NOT_PROTECTED');
  });
});
