import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasVerificationEnvelope,
  jcsCanonicalizeToString,
  reconstructV2SignablePayload,
  verifyVerificationEnvelope,
} from '@/lib/verifyEnvelope';

type AnyRecord = Record<string, any>;

const V2_TYPE = 'nexart.verification.envelope.v2';
const V2_EXCLUDED = [
  'meta.verificationEnvelopeSignature',
  'meta.verificationEnvelopeVerification',
] as const;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function toBase64Url(buffer: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(buffer))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function createEd25519KeyMaterial() {
  const pair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair;

  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);

  return {
    privateKey: pair.privateKey,
    manifest: {
      keys: [
        {
          kid: 'k1',
          alg: 'Ed25519',
          use: 'sig',
          publicKeyJwk: publicJwk,
        },
      ],
    },
  };
}

function makeBaseV2Bundle(): AnyRecord {
  return {
    bundleType: 'cer.ai.execution.v1',
    version: '1.0',
    createdAt: '2026-03-18T00:00:00.000Z',
    certificateHash: 'sha256:demo',
    snapshot: {
      model: 'gpt-5',
      nullableField: null,
      output: { score: 0.99 },
    },
    context: {
      signals: [{ step: 2 }, { step: 0 }, { step: 1 }],
    },
    meta: {
      verificationEnvelope: {
        envelopeType: V2_TYPE,
        attestation: {
          attestationId: 'att-1',
          attestedAt: '2026-03-18T00:00:01.000Z',
          kid: 'k1',
          nodeRuntimeHash: 'sha256:runtime',
          protocolVersion: '1.2.0',
          extraFieldIgnoredByVerifier: 'ignore-me',
        },
      },
      // Must not be used as the signed attestation source
      attestation: {
        attestationId: 'WRONG-SOURCE',
        kid: 'WRONG-SOURCE',
      },
      source: 'live-node',
      tags: ['prod'],
    },
  };
}

async function signBundleAsNodeV2(bundle: AnyRecord, privateKey: CryptoKey): Promise<string> {
  const { payload } = reconstructV2SignablePayload(bundle);
  const canonical = jcsCanonicalizeToString(payload);
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    new TextEncoder().encode(canonical),
  );
  return toBase64Url(signature);
}

async function makeSignedV2Bundle() {
  const { privateKey, manifest } = await createEd25519KeyMaterial();
  const bundle = makeBaseV2Bundle();
  const signature = await signBundleAsNodeV2(bundle, privateKey);

  // Excluded fields are added after signing by design.
  bundle.meta.verificationEnvelopeSignature = signature;
  bundle.meta.verificationEnvelopeVerification = { status: 'ok', checkedAt: 'now' };

  return { bundle, manifest };
}

describe('hasVerificationEnvelope', () => {
  it('detects v2 envelope when signature + discriminator are present', () => {
    const bundle = makeBaseV2Bundle();
    bundle.meta.verificationEnvelopeSignature = 'sig';
    expect(hasVerificationEnvelope(bundle)).toBe(true);
  });

  it('returns false when envelope signature is missing', () => {
    expect(hasVerificationEnvelope(makeBaseV2Bundle())).toBe(false);
  });
});

describe('reconstructV2SignablePayload parity', () => {
  it('mirrors node payload shape and keeps meta.verificationEnvelope in signed bundle', () => {
    const bundle = makeBaseV2Bundle();
    bundle.meta.verificationEnvelopeSignature = 'sig';
    bundle.meta.verificationEnvelopeVerification = { status: 'ok' };

    const { payload, excludedFields } = reconstructV2SignablePayload(bundle);

    expect(Object.keys(payload).sort()).toEqual(['attestation', 'bundle', 'envelopeType']);
    expect(payload.envelopeType).toBe(V2_TYPE);

    const attestation = payload.attestation as AnyRecord;
    expect(Object.keys(attestation).sort()).toEqual([
      'attestationId',
      'attestedAt',
      'kid',
      'nodeRuntimeHash',
      'protocolVersion',
    ]);

    const signedBundleMeta = (payload.bundle as AnyRecord).meta;
    expect(signedBundleMeta.verificationEnvelope).toBeDefined();
    expect(signedBundleMeta.verificationEnvelopeSignature).toBeUndefined();
    expect(signedBundleMeta.verificationEnvelopeVerification).toBeUndefined();

    expect(excludedFields).toEqual([...V2_EXCLUDED]);
  });

  it('empty-meta-after-strip and no-meta produce identical canonical payload', () => {
    const noMeta = { bundleType: 'x' };
    const excludedOnlyMeta = {
      bundleType: 'x',
      meta: {
        verificationEnvelopeSignature: 'sig',
        verificationEnvelopeVerification: { status: 'ok' },
      },
    };

    const c1 = jcsCanonicalizeToString(reconstructV2SignablePayload(noMeta).payload);
    const c2 = jcsCanonicalizeToString(reconstructV2SignablePayload(excludedOnlyMeta).payload);

    expect(c1).toBe(c2);
  });
});

describe('verifyVerificationEnvelope v2 parity', () => {
  it('fresh untouched v2 bundle verifies PASS', async () => {
    const { bundle, manifest } = await makeSignedV2Bundle();
    mockFetch.mockResolvedValue({ ok: true, json: async () => manifest });

    const result = await verifyVerificationEnvelope(bundle, 'https://fake.node');

    expect(result.status).toBe('valid');
    expect(result.envelopeType).toBe('v2');
    expect(result.excludedFields).toEqual([...V2_EXCLUDED]);
  });

  it('bundle with excluded metadata still verifies PASS', async () => {
    const { bundle, manifest } = await makeSignedV2Bundle();
    const injected = clone(bundle);
    injected.meta.verificationEnvelopeVerification = {
      status: 'injected-at-verify-time',
      traceId: 'trace-1',
    };

    mockFetch.mockResolvedValue({ ok: true, json: async () => manifest });
    const result = await verifyVerificationEnvelope(injected, 'https://fake.node');

    expect(result.status).toBe('valid');
  });

  it('tampered signed field verifies FAIL', async () => {
    const { bundle, manifest } = await makeSignedV2Bundle();
    const tampered = clone(bundle);
    tampered.snapshot.model = 'tampered-model';

    mockFetch.mockResolvedValue({ ok: true, json: async () => manifest });
    const result = await verifyVerificationEnvelope(tampered, 'https://fake.node');

    expect(result.status).toBe('invalid');
    expect(result.errorKind).toBe('invalid_signature');
  });

  it('wrong attestation source case verifies FAIL (must use verificationEnvelope.attestation)', async () => {
    const { bundle, manifest } = await makeSignedV2Bundle();
    const tampered = clone(bundle);

    // Tamper signed attestation field while keeping misleading meta.attestation present.
    tampered.meta.verificationEnvelope.attestation.attestationId = 'att-tampered';
    tampered.meta.attestation = {
      attestationId: 'att-1',
      kid: 'k1',
    };

    mockFetch.mockResolvedValue({ ok: true, json: async () => manifest });
    const result = await verifyVerificationEnvelope(tampered, 'https://fake.node');

    expect(result.status).toBe('invalid');
  });

  it('array reordering verifies FAIL', async () => {
    const { bundle, manifest } = await makeSignedV2Bundle();
    const tampered = clone(bundle);
    tampered.context.signals = [
      tampered.context.signals[2],
      tampered.context.signals[1],
      tampered.context.signals[0],
    ];

    mockFetch.mockResolvedValue({ ok: true, json: async () => manifest });
    const result = await verifyVerificationEnvelope(tampered, 'https://fake.node');

    expect(result.status).toBe('invalid');
  });

  it('null-preservation case verifies PASS', async () => {
    const { bundle, manifest } = await makeSignedV2Bundle();
    expect(bundle.snapshot.nullableField).toBeNull();

    mockFetch.mockResolvedValue({ ok: true, json: async () => manifest });
    const result = await verifyVerificationEnvelope(bundle, 'https://fake.node');

    expect(result.status).toBe('valid');
  });
});
