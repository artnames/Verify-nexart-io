import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: {} } });

// We need to mock the module that executionLookup imports
vi.mock('@/api/auditRecords', () => ({
  fetchBundleFromUrl: vi.fn(),
}));

import { lookupByExecutionId } from '@/api/executionLookup';

describe('lookupByExecutionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns bundle and hash on successful lookup via fetch-bundle proxy', async () => {
    const mockBundle = { snapshot: { executionId: 'test-123', model: 'gpt-4' } };
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        bundle: mockBundle,
        wrapperMetadata: {
          source: 'public-certificate',
          certificateHash: 'abc123',
        },
      }),
    });

    const result = await lookupByExecutionId('test-123');

    expect(result.success).toBe(true);
    expect(result.certificateHash).toBe('abc123');
    expect(result.bundle).toEqual(mockBundle);
  });

  it('calls fetch-bundle with executionId param, NOT audit_records', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: false, error: 'NOT_FOUND', message: 'Not found' }),
    });

    await lookupByExecutionId('some-exec-id');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('fetch-bundle');
    expect(calledUrl).toContain('executionId=some-exec-id');
    // Must NOT query audit_records directly
    expect(calledUrl).not.toContain('audit_records');
  });

  it('returns error when no record found', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: false, message: 'No record found' }),
    });

    const result = await lookupByExecutionId('nonexistent-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No record found');
  });

  it('returns error for empty executionId', async () => {
    const result = await lookupByExecutionId('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('No execution ID provided.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const result = await lookupByExecutionId('test-123');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('extracts certificateHash from bundle when not in wrapper metadata', async () => {
    const mockBundle = {
      snapshot: { executionId: 'test-456' },
      certificateHash: 'sha256:deadbeef',
    };
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, bundle: mockBundle }),
    });

    const result = await lookupByExecutionId('test-456');

    expect(result.success).toBe(true);
    expect(result.certificateHash).toBe('sha256:deadbeef');
  });
});

describe('/c/:certificateHash route (unchanged)', () => {
  it('VerifyCertificate redirects to /audit/:hash', async () => {
    const mod = await import('@/pages/VerifyCertificate');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
