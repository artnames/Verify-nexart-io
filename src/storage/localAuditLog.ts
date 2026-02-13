/**
 * Local Audit Log Storage — anonymous-first, localStorage-backed
 * 
 * Key: recanon.auditlog.v1
 * Records imported bundles for anonymous users.
 */

import type { CERBundle, AuditRecordRow, ImportSource, RenderStatus } from '@/types/auditRecord';
import { 
  validateCERBundle, 
  extractTitle, 
  extractStatement, 
  extractClaimType,
  extractSubject 
} from '@/types/auditRecord';
import { isAICERBundle, extractAICERTitle, extractAICERSubject } from '@/types/aiCerBundle';
import { canonicalize, computeCertificateHash } from '@/lib/canonicalize';
import { resolveExpectedImageHash, resolveExpectedAnimationHash } from '@/lib/hashResolver';
import type { WrapperMetadata } from '@/api/auditRecords';

const STORAGE_KEY = 'recanon.auditlog.v1';

export interface LocalAuditRecord {
  id: string;
  importedAt: string;
  sourceType: ImportSource;
  source?: string;
  bundle: CERBundle;
  certificateHash: string;
  canonicalJson: string;
  title: string | null;
  statement: string | null;
  subject: string | null;
  claimType: string | null;
  mode: string;
  bundleVersion: string;
  bundleCreatedAt: string | null;
  certificateVerified: boolean;
  renderStatus: RenderStatus | null;
  expectedImageHash: string | null;
  expectedAnimationHash: string | null;
}

function generateId(): string {
  return crypto.randomUUID();
}

function readStore(): LocalAuditRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalAuditRecord[];
  } catch {
    return [];
  }
}

function writeStore(records: LocalAuditRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * List all locally stored audit records, newest first.
 */
export function listLocalRecords(limit = 100): LocalAuditRecord[] {
  const records = readStore();
  records.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  return records.slice(0, limit);
}

/**
 * Get a local record by its certificate hash.
 */
export function getLocalRecordByHash(hash: string): LocalAuditRecord | null {
  const normalized = hash.replace(/^sha256:/, '').toLowerCase();
  return readStore().find(r => r.certificateHash === normalized) || null;
}

/**
 * Import a bundle into local storage.
 */
export async function importLocalRecord(
  bundle: CERBundle,
  source: ImportSource,
  wrapperMetadata?: WrapperMetadata,
): Promise<{ success: boolean; certificateHash?: string; error?: string }> {
  const validation = validateCERBundle(bundle);
  if (!validation.valid) {
    return { success: false, error: `Invalid bundle: ${validation.errors.join(', ')}` };
  }

  const canonicalJson = canonicalize(bundle);
  const certificateHash = await computeCertificateHash(bundle);

  // Check duplicate
  if (getLocalRecordByHash(certificateHash)) {
    return { success: true, certificateHash, error: 'Record already exists' };
  }

  const isAiCer = isAICERBundle(bundle);
  const expectedImageHash = wrapperMetadata?.expectedImageHash || resolveExpectedImageHash(bundle);
  const expectedAnimationHash = resolveExpectedAnimationHash(bundle);

  const record: LocalAuditRecord = {
    id: generateId(),
    importedAt: new Date().toISOString(),
    sourceType: source,
    bundle,
    certificateHash,
    canonicalJson,
    title: (isAiCer ? extractAICERTitle(bundle as any) : extractTitle(bundle))?.slice(0, 500) || null,
    statement: (isAiCer ? null : extractStatement(bundle))?.slice(0, 2000) || null,
    subject: (isAiCer ? extractAICERSubject(bundle as any) : extractSubject(bundle))?.slice(0, 200) || null,
    claimType: isAiCer ? 'ai.execution' : extractClaimType(bundle),
    mode: isAiCer ? 'attestation' : (validation.mode || 'static'),
    bundleVersion: isAiCer ? (bundle as Record<string, unknown>).bundleType as string : bundle.bundleVersion || 'unknown',
    bundleCreatedAt: bundle.createdAt || null,
    certificateVerified: true,
    renderStatus: isAiCer ? 'SKIPPED' : (validation.hasSnapshot && expectedImageHash ? 'PENDING' : 'SKIPPED'),
    expectedImageHash: expectedImageHash || null,
    expectedAnimationHash: expectedAnimationHash || null,
  };

  const records = readStore();
  records.push(record);
  writeStore(records);

  return { success: true, certificateHash };
}

/**
 * Convert a local record to the AuditRecordRow shape expected by UI components.
 */
export function toAuditRecordRow(local: LocalAuditRecord): AuditRecordRow {
  return {
    id: local.id,
    certificate_hash: local.certificateHash,
    bundle_version: local.bundleVersion,
    mode: local.mode,
    bundle_created_at: local.bundleCreatedAt,
    claim_type: local.claimType,
    title: local.title,
    statement: local.statement,
    subject: local.subject,
    expected_image_hash: local.expectedImageHash,
    expected_animation_hash: local.expectedAnimationHash,
    certificate_verified: local.certificateVerified,
    render_status: local.renderStatus,
    render_verified: null,
    last_verified_at: null,
    bundle_json: local.bundle as unknown,
    canonical_json: local.canonicalJson,
    import_source: local.sourceType,
    imported_by: null,
    created_at: local.importedAt,
  } as AuditRecordRow;
}
