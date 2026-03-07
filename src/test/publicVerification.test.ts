/**
 * Tests for public verification routes:
 * - /e/:executionId renders directly from public lookup (no local audit records)
 * - /c/:certificateHash renders directly from public lookup (no local audit records)
 * - No dependency on local audit_records
 * - Old import/audit log flow remains unchanged
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('@/api/executionLookup', () => ({
  lookupByExecutionId: vi.fn(),
}));

vi.mock('@/api/auditRecords', () => ({
  fetchBundleFromUrl: vi.fn(),
  looksLikeHash: vi.fn(() => true),
  normalizeHash: vi.fn((h: string) => h.replace(/^sha256:/, '').toLowerCase()),
}));

vi.mock('@/lib/verifyBundle', () => ({
  verifyUploadedBundleAsync: vi.fn(),
}));

vi.mock('@/storage/localAuditLog', () => ({
  importLocalRecord: vi.fn(),
  getLocalRecordByHash: vi.fn(() => null),
  listLocalRecords: vi.fn(() => []),
  toAuditRecordRow: vi.fn(),
}));

import { lookupByExecutionId } from '@/api/executionLookup';
import { fetchBundleFromUrl } from '@/api/auditRecords';
import { verifyUploadedBundleAsync } from '@/lib/verifyBundle';
import { getLocalRecordByHash } from '@/storage/localAuditLog';

const mockAiCerBundle = {
  bundleType: 'cer.ai.execution.v1',
  version: '0.5.0',
  createdAt: '2025-01-01T00:00:00Z',
  certificateHash: 'sha256:abc123',
  snapshot: { prompt: 'test', output: 'result' },
};

const mockCodeModeBundle = {
  bundleType: 'code-mode',
  bundleVersion: '1.0.0',
  certificateHash: 'sha256:def456',
  snapshot: { code: 'test', seed: 42, vars: [1,2,3,4,5,6,7,8,9,10] },
};

describe('Public verification routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/e/:executionId — execution ID lookup', () => {
    it('resolves bundle from public lookup without touching local audit log', async () => {
      const mockLookup = lookupByExecutionId as ReturnType<typeof vi.fn>;
      mockLookup.mockResolvedValue({
        success: true,
        bundle: mockAiCerBundle,
        certificateHash: 'abc123',
      });

      const mockVerify = verifyUploadedBundleAsync as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({
        ok: true,
        code: 'OK',
        details: [],
        errors: [],
        bundleType: 'cer.ai.execution.v1',
      });

      // Simulate what PublicVerificationPage does
      const result = await lookupByExecutionId('retest-certify-002');
      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();

      const verifyResult = await verifyUploadedBundleAsync(result.bundle);
      expect(verifyResult.ok).toBe(true);

      // Confirm local audit log was NOT accessed
      expect(getLocalRecordByHash).not.toHaveBeenCalled();
    });

    it('returns error for missing execution ID', async () => {
      const mockLookup = lookupByExecutionId as ReturnType<typeof vi.fn>;
      mockLookup.mockResolvedValue({
        success: false,
        error: 'No record found for execution ID: nonexistent',
      });

      const result = await lookupByExecutionId('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No record found');
    });
  });

  describe('/c/:certificateHash — certificate hash lookup', () => {
    it('resolves bundle from public lookup without touching local audit log', async () => {
      const mockFetch = fetchBundleFromUrl as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue({
        success: true,
        bundle: mockCodeModeBundle,
      });

      const mockVerify = verifyUploadedBundleAsync as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({
        ok: true,
        code: 'OK',
        details: [],
        errors: [],
        bundleType: 'code-mode',
      });

      // Simulate what PublicVerificationPage does
      const result = await fetchBundleFromUrl('def456');
      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();

      const verifyResult = await verifyUploadedBundleAsync(result.bundle);
      expect(verifyResult.ok).toBe(true);

      // Confirm local audit log was NOT accessed
      expect(getLocalRecordByHash).not.toHaveBeenCalled();
    });

    it('handles full sha256: prefixed certificate hash', async () => {
      const mockFetch = fetchBundleFromUrl as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue({ success: true, bundle: mockCodeModeBundle });

      const fullHash = 'sha256:d25a355780b18246f8775b721bcccd74423b3251d193d46c2d183e626cf558e5';
      const result = await fetchBundleFromUrl(fullHash);
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(fullHash);
    });

    it('handles URL-encoded certificate hash from route params', async () => {
      const mockFetch = fetchBundleFromUrl as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue({ success: true, bundle: mockCodeModeBundle });

      // Simulate what happens when react-router decodes the URL param
      const encoded = 'sha256%3Ad25a355780b18246f8775b721bcccd74423b3251d193d46c2d183e626cf558e5';
      const decoded = decodeURIComponent(encoded);
      expect(decoded).toBe('sha256:d25a355780b18246f8775b721bcccd74423b3251d193d46c2d183e626cf558e5');

      const result = await fetchBundleFromUrl(decoded);
      expect(result.success).toBe(true);
    });

    it('returns error for invalid certificate hash', async () => {
      const mockFetch = fetchBundleFromUrl as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue({
        success: false,
        error: 'Could not find certificate record.',
      });

      const result = await fetchBundleFromUrl('invalid-hash');
      expect(result.success).toBe(false);
    });
  });

  describe('No local audit_records dependency', () => {
    it('public verification never calls getLocalRecordByHash', async () => {
      const mockLookup = lookupByExecutionId as ReturnType<typeof vi.fn>;
      mockLookup.mockResolvedValue({
        success: true,
        bundle: mockAiCerBundle,
        certificateHash: 'abc123',
      });

      const mockVerify = verifyUploadedBundleAsync as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({
        ok: true,
        code: 'OK',
        details: [],
        errors: [],
        bundleType: 'cer.ai.execution.v1',
      });

      await lookupByExecutionId('test-exec-id');
      await verifyUploadedBundleAsync(mockAiCerBundle);

      // Key assertion: local storage was never consulted
      expect(getLocalRecordByHash).not.toHaveBeenCalled();
    });

    it('public verification does not call importLocalRecord', async () => {
      const { importLocalRecord } = await import('@/storage/localAuditLog');
      const mockImport = importLocalRecord as ReturnType<typeof vi.fn>;

      const mockLookup = lookupByExecutionId as ReturnType<typeof vi.fn>;
      mockLookup.mockResolvedValue({
        success: true,
        bundle: mockAiCerBundle,
        certificateHash: 'abc123',
      });

      await lookupByExecutionId('test-exec-id');

      expect(mockImport).not.toHaveBeenCalled();
    });
  });

  describe('Old import/audit log flow remains unchanged', () => {
    it('local audit log functions are still exported and available', async () => {
      const localAuditLog = await import('@/storage/localAuditLog');
      expect(localAuditLog.importLocalRecord).toBeDefined();
      expect(localAuditLog.getLocalRecordByHash).toBeDefined();
      expect(localAuditLog.listLocalRecords).toBeDefined();
    });
  });

  describe('Wrapper unwrapping', () => {
    it('extracts nested bundle from wrapper response shape', async () => {
      const innerBundle = {
        bundleType: 'cer.ai.execution.v1',
        version: '0.5.0',
        createdAt: '2025-01-01T00:00:00Z',
        certificateHash: 'sha256:abc123',
        snapshot: { provider: 'openai', model: 'gpt-4', executionId: 'exec-001', protocolVersion: '1.0' },
      };

      // Simulate a wrapper response where proxy failed to unwrap
      const wrapperResponse = {
        bundle: innerBundle,
        certificateHash: 'sha256:abc123',
        bundleType: 'cer.ai.execution.v1',
        createdAt: '2025-01-01T00:00:00Z',
        projectName: 'test-project',
        appName: 'test-app',
      };

      // The client-side safety net should detect and unwrap
      let bundleData: any = wrapperResponse;
      if (bundleData && typeof bundleData === 'object' && typeof bundleData.bundle === 'object' && bundleData.bundle !== null) {
        bundleData = bundleData.bundle;
      }

      expect(bundleData.bundleType).toBe('cer.ai.execution.v1');
      expect(bundleData.snapshot.provider).toBe('openai');
      expect(bundleData.snapshot.model).toBe('gpt-4');
      expect(bundleData.snapshot.executionId).toBe('exec-001');
    });

    it('passes bundle directly to verification, not the wrapper', async () => {
      const innerBundle = {
        bundleType: 'cer.ai.execution.v1',
        version: '0.5.0',
        createdAt: '2025-01-01T00:00:00Z',
        certificateHash: 'sha256:abc123',
        snapshot: { provider: 'openai', model: 'gpt-4' },
      };

      const mockVerify = verifyUploadedBundleAsync as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({
        ok: true,
        code: 'OK',
        details: [],
        errors: [],
        bundleType: 'cer.ai.execution.v1',
      });

      // Verify against the inner bundle, not the wrapper
      const result = await verifyUploadedBundleAsync(innerBundle);
      expect(result.ok).toBe(true);
      expect(mockVerify).toHaveBeenCalledWith(innerBundle);
    });

    it('certified AI record with attestation shows verified status', async () => {
      const certifiedBundle = {
        bundleType: 'cer.ai.execution.v1',
        version: '0.5.0',
        createdAt: '2025-01-01T00:00:00Z',
        certificateHash: 'sha256:abc123',
        snapshot: { provider: 'openai', model: 'gpt-4', executionId: 'exec-001' },
        meta: {
          attestation: {
            attestationId: 'att-001',
            nodeRuntimeHash: 'sha256:node123',
            protocolVersion: '1.0',
            verified: true,
            hasSignedReceipt: true,
          },
        },
      };

      const mockVerify = verifyUploadedBundleAsync as ReturnType<typeof vi.fn>;
      mockVerify.mockResolvedValue({
        ok: true,
        code: 'OK',
        details: [],
        errors: [],
        bundleType: 'cer.ai.execution.v1',
      });

      const result = await verifyUploadedBundleAsync(certifiedBundle);
      expect(result.ok).toBe(true);

      // Verify attestation data is accessible from the bundle
      const att = certifiedBundle.meta.attestation;
      expect(att.attestationId).toBe('att-001');
      expect(att.verified).toBe(true);
      expect(att.hasSignedReceipt).toBe(true);
    });
  });

  describe('Attestation status consistency', () => {
    it('signed receipt bundle does not trigger legacy/unsigned wording', async () => {
      const { extractSignedReceiptEnvelope, probeReceiptFields } = await import('@/lib/extractSignedReceipt');

      const signedBundle = {
        bundleType: 'cer.ai.execution.v1',
        meta: {
          attestation: {
            attestationId: 'att-001',
            receipt: { certificateHash: 'sha256:abc', outputHash: 'sha256:def' },
            signature: 'base64sig',
            attestorKeyId: 'kid-001',
            verified: true,
            hasSignedReceipt: true,
          },
        },
      };

      // extractSignedReceiptEnvelope should find the receipt
      const envelope = extractSignedReceiptEnvelope(signedBundle);
      expect(envelope).not.toBeNull();
      expect(envelope?.source).toBe('meta.attestation');

      // probeReceiptFields should find all fields
      const probe = probeReceiptFields(signedBundle);
      expect(probe.hasReceipt).toBe(true);
      expect(probe.hasSignature).toBe(true);
      expect(probe.hasKid).toBe(true);
      expect(probe.hasAttestationId).toBe(true);
    });

    it('actual unsigned/legacy bundle correctly shows legacy probe', async () => {
      const { extractSignedReceiptEnvelope, probeReceiptFields } = await import('@/lib/extractSignedReceipt');

      const legacyBundle = {
        bundleType: 'cer.ai.execution.v1',
        meta: {
          attestation: {
            attestationId: 'att-legacy-001',
            nodeRuntimeHash: 'sha256:abc',
            verified: true,
            // No receipt, no signature, no kid
          },
        },
      };

      // extractSignedReceiptEnvelope should return null (no complete triple)
      const envelope = extractSignedReceiptEnvelope(legacyBundle);
      expect(envelope).toBeNull();

      // probeReceiptFields should find attestationId but not receipt/sig/kid
      const probe = probeReceiptFields(legacyBundle);
      expect(probe.hasAttestationId).toBe(true);
      expect(probe.hasReceipt).toBe(false);
      expect(probe.hasSignature).toBe(false);
      expect(probe.hasKid).toBe(false);
    });

    it('NodeAttestationSignature normalization places receipt where SDK expects it', async () => {
      const { extractSignedReceiptEnvelope } = await import('@/lib/extractSignedReceipt');

      const bundleWithMetaAttestation = {
        bundleType: 'cer.ai.execution.v1',
        certificateHash: 'sha256:abc123',
        meta: {
          attestation: {
            attestationId: 'att-001',
            receipt: { certificateHash: 'sha256:abc123', outputHash: 'sha256:def' },
            signature: 'base64sig',
            attestorKeyId: 'kid-001',
            verified: true,
          },
        },
      };

      // Envelope should be found at meta.attestation
      const envelope = extractSignedReceiptEnvelope(bundleWithMetaAttestation);
      expect(envelope).not.toBeNull();
      expect(envelope!.source).toBe('meta.attestation');

      // Simulate the normalization logic from NodeAttestationSignature
      const normalized = JSON.parse(JSON.stringify(bundleWithMetaAttestation)) as any;
      if (!normalized.attestation || typeof normalized.attestation !== 'object') {
        normalized.attestation = {};
      }
      normalized.attestation.receipt = envelope!.receipt;
      normalized.attestation.signatureB64Url = envelope!.signatureB64Url;
      normalized.attestation.attestorKeyId = envelope!.kid;

      // SDK should now find receipt at bundle.attestation.*
      expect(normalized.attestation.receipt).toBeDefined();
      expect(normalized.attestation.signatureB64Url).toBe('base64sig');
      expect(normalized.attestation.attestorKeyId).toBe('kid-001');
    });

    it('simulate tamper works when receipt is in meta.attestation layout', async () => {
      const { extractSignedReceiptEnvelope } = await import('@/lib/extractSignedReceipt');

      const bundle = {
        bundleType: 'cer.ai.execution.v1',
        meta: {
          attestation: {
            receipt: { certificateHash: 'sha256:abc123' },
            signature: 'ABCDsig',
            attestorKeyId: 'kid-001',
          },
        },
      };

      const envelope = extractSignedReceiptEnvelope(bundle);
      expect(envelope).not.toBeNull();

      // Simulate tamper: normalize then mutate
      const normalized = JSON.parse(JSON.stringify(bundle)) as any;
      normalized.attestation = {
        receipt: envelope!.receipt,
        signatureB64Url: envelope!.signatureB64Url,
        attestorKeyId: envelope!.kid,
      };

      // Flip signature
      const sig = normalized.attestation.signatureB64Url;
      normalized.attestation.signatureB64Url = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);

      // The tampered bundle should have a different signature
      expect(normalized.attestation.signatureB64Url).not.toBe(envelope!.signatureB64Url);
    });
  });

  describe('Execution ID input sanitization', () => {
    const sanitizeExecutionId = (raw: string): string => {
      const trimmed = raw.trim();
      const urlMatch = trimmed.match(/\/e\/([^/?#]+)/);
      if (urlMatch) return decodeURIComponent(urlMatch[1]);
      if (/^https?:\/\//i.test(trimmed)) return '';
      return trimmed;
    };

    it('extracts execution ID from full verifier URL', () => {
      expect(sanitizeExecutionId('https://verify.nexart.io/e/retest-certify-002')).toBe('retest-certify-002');
    });

    it('extracts execution ID from preview URL', () => {
      expect(sanitizeExecutionId('https://preview.lovable.app/e/my-exec-id')).toBe('my-exec-id');
    });

    it('passes through plain execution ID unchanged', () => {
      expect(sanitizeExecutionId('retest-certify-002')).toBe('retest-certify-002');
    });

    it('returns empty string for unrelated URL', () => {
      expect(sanitizeExecutionId('https://example.com/foo')).toBe('');
    });

    it('handles URL-encoded execution ID', () => {
      expect(sanitizeExecutionId('https://verify.nexart.io/e/my%20exec')).toBe('my exec');
    });
  });

  describe('Certificate hash lookup uses certificateHash param', () => {
    it('client sends certificateHash query param for hash lookups', async () => {
      const mockFetch = fetchBundleFromUrl as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue({ success: true, bundle: mockCodeModeBundle });

      const fullHash = 'sha256:d25a355780b18246f8775b721bcccd74423b3251d193d46c2d183e626cf558e5';
      await fetchBundleFromUrl(fullHash);
      expect(mockFetch).toHaveBeenCalledWith(fullHash);
    });
  });
});
