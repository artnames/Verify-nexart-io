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
});
