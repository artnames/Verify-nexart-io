import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasVerificationEnvelope,
  verifyVerificationEnvelope,
  reconstructV2SignablePayload,
  jcsCanonicalizeToString,
} from '@/lib/verifyEnvelope';

// Mock fetch for node public key
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('hasVerificationEnvelope', () => {
  it('returns false for null/undefined', () => {
    expect(hasVerificationEnvelope(null)).toBe(false);
    expect(hasVerificationEnvelope(undefined)).toBe(false);
  });

  it('detects v1 envelope', () => {
    const bundle = {
      meta: {
        verificationEnvelope: { bundleType: 'test' },
        verificationEnvelopeSignature: 'abc123',
      },
    };
    expect(hasVerificationEnvelope(bundle)).toBe(true);
  });

  it('detects v2 envelope via meta.verificationEnvelopeType', () => {
    const bundle = {
      meta: {
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelopeSignature: 'abc123',
      },
    };
    expect(hasVerificationEnvelope(bundle)).toBe(true);
  });

  it('returns false when no envelope fields', () => {
    expect(hasVerificationEnvelope({ meta: { source: 'test' } })).toBe(false);
  });
});

describe('jcsCanonicalizeToString', () => {
  it('sorts keys alphabetically', () => {
    expect(jcsCanonicalizeToString({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('handles nested objects', () => {
    const result = jcsCanonicalizeToString({ z: { b: 2, a: 1 }, a: 0 });
    expect(result).toBe('{"a":0,"z":{"a":1,"b":2}}');
  });

  it('preserves arrays', () => {
    expect(jcsCanonicalizeToString([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles null', () => {
    expect(jcsCanonicalizeToString(null)).toBe('null');
  });
});

describe('reconstructV2SignablePayload', () => {
  it('excludes verificationEnvelopeSignature and verificationEnvelopeVerification', () => {
    const bundle = {
      bundleType: 'cer.ai.execution.v1',
      snapshot: { model: 'gpt-4' },
      meta: {
        verificationEnvelopeSignature: 'sig123',
        verificationEnvelopeVerification: { status: 'valid' },
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        attestation: {
          attestationId: 'att-1',
          attestedAt: '2026-01-01',
          attestorKeyId: 'k1',
          nodeRuntimeHash: 'sha256:abc',
          protocolVersion: '1.2.0',
        },
      },
    };

    const { payload, excludedFields } = reconstructV2SignablePayload(bundle);

    // Excluded fields should be listed
    expect(excludedFields).toContain('meta.verificationEnvelopeSignature');
    expect(excludedFields).toContain('meta.verificationEnvelopeVerification');

    // The payload bundle should not contain excluded fields
    const innerMeta = (payload.bundle as any).meta;
    expect(innerMeta.verificationEnvelopeSignature).toBeUndefined();
    expect(innerMeta.verificationEnvelopeVerification).toBeUndefined();

    // Attestation summary should be extracted
    expect(payload.attestation).toEqual({
      attestationId: 'att-1',
      attestedAt: '2026-01-01',
      kid: 'k1',
      nodeRuntimeHash: 'sha256:abc',
      protocolVersion: '1.2.0',
    });

    expect(payload.envelopeType).toBe('nexart.verification.envelope.v2');
  });

  it('excluded-field-only change keeps same payload', () => {
    const bundle1 = {
      bundleType: 'test',
      meta: {
        verificationEnvelopeSignature: 'sig-A',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
      },
    };
    const bundle2 = {
      bundleType: 'test',
      meta: {
        verificationEnvelopeSignature: 'sig-B',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
      },
    };

    const p1 = jcsCanonicalizeToString(reconstructV2SignablePayload(bundle1).payload);
    const p2 = jcsCanonicalizeToString(reconstructV2SignablePayload(bundle2).payload);
    expect(p1).toBe(p2);
  });

  it('signed field change produces different payload', () => {
    const base = {
      bundleType: 'test',
      snapshot: { model: 'gpt-4' },
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
      },
    };
    const tampered = {
      ...base,
      snapshot: { model: 'gpt-3.5' },
    };

    const p1 = jcsCanonicalizeToString(reconstructV2SignablePayload(base).payload);
    const p2 = jcsCanonicalizeToString(reconstructV2SignablePayload(tampered).payload);
    expect(p1).not.toBe(p2);
  });
});

describe('verifyVerificationEnvelope', () => {
  it('returns absent for bundles without envelope', async () => {
    const result = await verifyVerificationEnvelope({ bundleType: 'test' });
    expect(result.status).toBe('absent');
  });

  it('returns error when node public key fetch fails for v2', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const bundle = {
      bundleType: 'test',
      meta: {
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelopeSignature: 'fakeSig',
      },
    };

    const result = await verifyVerificationEnvelope(bundle, 'https://fake.node');
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('missing_public_key');
    expect(result.envelopeType).toBe('v2');
  });

  it('returns error for v2 envelope with missing signature', async () => {
    const bundle = {
      meta: {
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        // no signature
      },
    };
    const result = await verifyVerificationEnvelope(bundle);
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('missing_signature');
  });

  it('returns error when node returns empty keys for v1', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [] }),
    });

    const bundle = {
      meta: {
        verificationEnvelope: { test: true },
        verificationEnvelopeSignature: 'abc',
      },
    };

    const result = await verifyVerificationEnvelope(bundle, 'https://fake.node');
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('missing_public_key');
    expect(result.envelopeType).toBe('v1');
  });
});
