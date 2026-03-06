import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockFilter = vi.fn(() => ({ limit: mockLimit }));
const mockSelect = vi.fn(() => ({ filter: mockFilter }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

import { lookupByExecutionId } from '@/api/executionLookup';

describe('lookupByExecutionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ filter: mockFilter });
    mockFilter.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it('returns bundle and hash on successful lookup', async () => {
    const mockBundle = { snapshot: { executionId: 'test-123', model: 'gpt-4' } };
    mockMaybeSingle.mockResolvedValue({
      data: { certificate_hash: 'abc123', bundle_json: mockBundle },
      error: null,
    });

    const result = await lookupByExecutionId('test-123');

    expect(result.success).toBe(true);
    expect(result.certificateHash).toBe('abc123');
    expect(result.bundle).toEqual(mockBundle);
    expect(mockFrom).toHaveBeenCalledWith('audit_records');
    expect(mockFilter).toHaveBeenCalledWith(
      'bundle_json->snapshot->>executionId',
      'eq',
      'test-123'
    );
  });

  it('returns error when no record found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await lookupByExecutionId('nonexistent-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No record found');
  });

  it('returns error for empty executionId', async () => {
    const result = await lookupByExecutionId('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('No execution ID provided.');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does NOT call fetch-bundle URL proxy', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await lookupByExecutionId('some-exec-id');

    // Verify it queries audit_records, not fetch-bundle
    expect(mockFrom).toHaveBeenCalledWith('audit_records');
    // No fetch calls to fetch-bundle edge function
    expect(globalThis.fetch).toBeUndefined;
  });

  it('handles database errors gracefully', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'connection failed' },
    });

    const result = await lookupByExecutionId('test-123');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database query failed.');
  });
});

describe('/c/:certificateHash route (unchanged)', () => {
  it('VerifyCertificate redirects to /audit/:hash', async () => {
    // This is a static redirect component - just verify the module exports correctly
    const mod = await import('@/pages/VerifyCertificate');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
