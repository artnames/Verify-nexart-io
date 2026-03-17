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

/* ------------------------------------------------------------------ */
/*  Detection                                                          */
/* ------------------------------------------------------------------ */

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

  it('detects v2 via verificationEnvelope.envelopeType', () => {
    const bundle = {
      meta: {
        verificationEnvelope: { envelopeType: 'nexart.verification.envelope.v2' },
        verificationEnvelopeSignature: 'abc123',
      },
    };
    expect(hasVerificationEnvelope(bundle)).toBe(true);
  });

  it('returns false when no envelope fields', () => {
    expect(hasVerificationEnvelope({ meta: { source: 'test' } })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  JCS Canonicalization                                                */
/* ------------------------------------------------------------------ */

describe('jcsCanonicalizeToString', () => {
  it('sorts keys alphabetically', () => {
    expect(jcsCanonicalizeToString({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('handles nested objects', () => {
    const result = jcsCanonicalizeToString({ z: { b: 2, a: 1 }, a: 0 });
    expect(result).toBe('{"a":0,"z":{"a":1,"b":2}}');
  });

  it('preserves array order (does NOT sort)', () => {
    expect(jcsCanonicalizeToString([3, 1, 2])).toBe('[3,1,2]');
  });

  it('preserves null', () => {
    expect(jcsCanonicalizeToString(null)).toBe('null');
    expect(jcsCanonicalizeToString({ a: null, b: 1 })).toBe('{"a":null,"b":1}');
  });

  it('drops undefined values', () => {
    expect(jcsCanonicalizeToString({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it('handles booleans', () => {
    expect(jcsCanonicalizeToString({ a: true, b: false })).toBe('{"a":true,"b":false}');
  });

  it('handles non-finite numbers as null', () => {
    expect(jcsCanonicalizeToString({ a: Infinity, b: NaN })).toBe('{"a":null,"b":null}');
  });
});

/* ------------------------------------------------------------------ */
/*  v2 Payload Reconstruction — Node Parity                            */
/* ------------------------------------------------------------------ */

describe('reconstructV2SignablePayload', () => {
  it('reads attestation from verificationEnvelope.attestation (NOT meta.attestation)', () => {
    const bundle = {
      bundleType: 'cer.ai.execution.v1',
      snapshot: { model: 'gpt-4' },
      meta: {
        verificationEnvelopeSignature: 'sig123',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: {
          envelopeType: 'nexart.verification.envelope.v2',
          attestation: {
            attestationId: 'att-1',
            attestedAt: '2026-01-01T00:00:00Z',
            kid: 'k1',
            nodeRuntimeHash: 'sha256:abc',
            protocolVersion: '1.2.0',
          },
        },
        // This MUST NOT be used as attestation source
        attestation: {
          attestationId: 'WRONG',
          attestedAt: 'WRONG',
          attestorKeyId: 'WRONG',
        },
        source: 'test',
      },
    };

    const { payload } = reconstructV2SignablePayload(bundle);
    const att = payload.attestation as Record<string, unknown>;

    expect(att.attestationId).toBe('att-1');
    expect(att.attestedAt).toBe('2026-01-01T00:00:00Z');
    expect(att.kid).toBe('k1');
    expect(att.nodeRuntimeHash).toBe('sha256:abc');
    expect(att.protocolVersion).toBe('1.2.0');
    expect(Object.keys(att).sort()).toEqual([
      'attestationId', 'attestedAt', 'kid', 'nodeRuntimeHash', 'protocolVersion',
    ]);
  });

  it('strips ALL envelope-related response-level fields from bundle meta', () => {
    const bundle = {
      bundleType: 'test',
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeVerification: { status: 'valid' },
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { envelopeType: 'nexart.verification.envelope.v2', attestation: {} },
        source: 'real-data',
      },
    };

    const { payload, excludedFields } = reconstructV2SignablePayload(bundle);
    const innerMeta = (payload.bundle as any).meta;

    expect(innerMeta.verificationEnvelopeSignature).toBeUndefined();
    expect(innerMeta.verificationEnvelopeVerification).toBeUndefined();
    expect(innerMeta.verificationEnvelopeType).toBeUndefined();
    expect(innerMeta.verificationEnvelope).toBeUndefined();
    expect(innerMeta.source).toBe('real-data');

    expect(excludedFields).toContain('meta.verificationEnvelopeSignature');
    expect(excludedFields).toContain('meta.verificationEnvelopeVerification');
    expect(excludedFields).toContain('meta.verificationEnvelope');
    expect(excludedFields).toContain('meta.verificationEnvelopeType');
  });

  it('removes meta entirely when empty after stripping', () => {
    const bundle = {
      bundleType: 'test',
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: {} },
      },
    };

    const { payload } = reconstructV2SignablePayload(bundle);
    expect((payload.bundle as any).meta).toBeUndefined();
  });

  it('no-meta bundle and empty-after-strip bundle produce same canonical payload', () => {
    const bundleNoMeta = { bundleType: 'test', snapshot: { x: 1 } };
    const bundleEmptyMeta = {
      bundleType: 'test',
      snapshot: { x: 1 },
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: {} },
      },
    };

    const c1 = jcsCanonicalizeToString(reconstructV2SignablePayload(bundleNoMeta).payload);
    const c2 = jcsCanonicalizeToString(reconstructV2SignablePayload(bundleEmptyMeta).payload);
    expect(c1).toBe(c2);
  });

  it('preserves null values in bundle', () => {
    const bundle = {
      bundleType: 'test',
      snapshot: { modelVersion: null, model: 'gpt-4' },
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: {} },
      },
    };

    const canonical = jcsCanonicalizeToString(reconstructV2SignablePayload(bundle).payload);
    expect(canonical).toContain('"modelVersion":null');
  });

  it('preserves array order in bundle', () => {
    const bundle = {
      bundleType: 'test',
      context: { signals: [{ step: 2 }, { step: 0 }, { step: 1 }] },
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: {} },
      },
    };

    const signals = ((reconstructV2SignablePayload(bundle).payload.bundle as any).context.signals);
    expect(signals[0].step).toBe(2);
    expect(signals[1].step).toBe(0);
    expect(signals[2].step).toBe(1);
  });

  it('tampered signed field changes canonical output', () => {
    const make = (model: string) => ({
      bundleType: 'cer.ai.execution.v1',
      snapshot: { model },
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: { kid: 'k1' } },
      },
    });

    const c1 = jcsCanonicalizeToString(reconstructV2SignablePayload(make('gpt-4')).payload);
    const c2 = jcsCanonicalizeToString(reconstructV2SignablePayload(make('gpt-3.5')).payload);
    expect(c1).not.toBe(c2);
  });

  it('array reordering changes canonical output', () => {
    const make = (signals: any[]) => ({
      bundleType: 'test',
      context: { signals },
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: {} },
      },
    });

    const c1 = jcsCanonicalizeToString(reconstructV2SignablePayload(make([{ a: 1 }, { b: 2 }])).payload);
    const c2 = jcsCanonicalizeToString(reconstructV2SignablePayload(make([{ b: 2 }, { a: 1 }])).payload);
    expect(c1).not.toBe(c2);
  });

  it('wrong attestation source produces different payload', () => {
    const bundle = {
      bundleType: 'test',
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: {
          attestation: { kid: 'correct-key', attestationId: 'correct-id' },
        },
        attestation: { attestorKeyId: 'wrong-key', attestationId: 'wrong-id' },
      },
    };

    const { payload } = reconstructV2SignablePayload(bundle);
    const att = payload.attestation as Record<string, unknown>;
    expect(att.kid).toBe('correct-key');
    expect(att.attestationId).toBe('correct-id');
  });

  it('excluded-field-only change keeps same canonical payload', () => {
    const make = (sig: string) => ({
      bundleType: 'test',
      snapshot: { x: 1 },
      meta: {
        verificationEnvelopeSignature: sig,
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: { kid: 'k1' } },
      },
    });

    const c1 = jcsCanonicalizeToString(reconstructV2SignablePayload(make('sig-A')).payload);
    const c2 = jcsCanonicalizeToString(reconstructV2SignablePayload(make('sig-B')).payload);
    expect(c1).toBe(c2);
  });

  it('payload shape is exactly { attestation, bundle, envelopeType }', () => {
    const bundle = {
      bundleType: 'test',
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: { kid: 'k1' } },
      },
    };

    const { payload } = reconstructV2SignablePayload(bundle);
    expect(Object.keys(payload).sort()).toEqual(['attestation', 'bundle', 'envelopeType']);
    expect(payload.envelopeType).toBe('nexart.verification.envelope.v2');
  });
});

/* ------------------------------------------------------------------ */
/*  Full verification flow                                              */
/* ------------------------------------------------------------------ */

describe('verifyVerificationEnvelope', () => {
  it('returns absent for bundles without envelope', async () => {
    const result = await verifyVerificationEnvelope({ bundleType: 'test' });
    expect(result.status).toBe('absent');
  });

  it('returns error for missing public key (v2)', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const bundle = {
      meta: {
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelopeSignature: 'fakeSig',
        verificationEnvelope: { attestation: {} },
      },
    };

    const result = await verifyVerificationEnvelope(bundle, 'https://fake.node');
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('missing_public_key');
    expect(result.envelopeType).toBe('v2');
  });

  it('returns error for missing signature (v2)', async () => {
    const bundle = {
      meta: {
        verificationEnvelopeType: 'nexart.verification.envelope.v2',
        verificationEnvelope: { attestation: {} },
      },
    };
    const result = await verifyVerificationEnvelope(bundle);
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('missing_signature');
  });

  it('returns error for missing public key (v1)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ keys: [] }) });
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

  it('returns malformed_envelope for v1 with non-object envelope', async () => {
    const bundle = {
      meta: {
        verificationEnvelope: 'not-an-object',
        verificationEnvelopeSignature: 'abc',
      },
    };
    const result = await verifyVerificationEnvelope(bundle);
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('malformed_envelope');
  });
});
