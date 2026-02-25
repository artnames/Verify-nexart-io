/**
 * Audit Page - Certified Execution Record Report
 * 
 * Auditor-friendly layout with:
 * - Executive Summary
 * - Policy Explanation
 * - 4-layer evidence (numbered, with subtitles)
 * - Technical Appendix
 * - AI Execution Record detection and dedicated view
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  ChevronLeft, 
  Download, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  FileJson,
  Server,
  Shield,
  FileText,
  AlertTriangle,
  Hash,
  Play,
  Eye,
  ChevronDown,
  ChevronUp,
  Info,
  Scale,
  Code,
  FileCheck,
  Fingerprint
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuditRecordByHash } from '@/api/auditRecords';
import { recertifyBundle, getLatestRecertificationRun, type RecertifyResponse, type RecertificationRun } from '@/api/recertification';
import { recertifyAICER } from '@/api/aiCerRecertification';
import { sanitizeForNode, redactForDisplay, findUndefinedPaths } from '@/lib/attestationSanitize';
import { verifyCertificateHash, canonicalize } from '@/lib/canonicalize';
import { verifyUploadedBundle, type BundleVerifyResult } from '@/lib/verifyBundle';
import { 
  resolveExpectedImageHash, 
  resolveExpectedAnimationHash,
  getImageHashSource,
  formatHashForDisplay,
  truncateHash,
  normalizeHash,
} from '@/lib/hashResolver';
import { getProxyUrl } from '@/certified/canonicalConfig';
import { RecertificationStatus } from '@/components/RecertificationStatus';
import { AICERVerifyResult } from '@/components/AICERVerifyResult';
import { AICERRecertificationStatus, type AICERRecertifyResponse } from '@/components/AICERRecertificationStatus';
import { isAICERBundle, validateAICERForAttestation, type AICERBundle } from '@/types/aiCerBundle';
import { verifyCer as verifyAICERBundle } from '@nexart/ai-execution'; // kept for type re-export only
import type { AuditRecordRow, CERBundle, AuditSnapshot } from '@/types/auditRecord';

// Render verification result with detailed error info
interface RenderVerificationResult {
  verified: boolean;
  computedHash: string | null;
  expectedHash: string | null;
  hashSource?: string;
  error?: string;
  requestId?: string;
  upstreamStatus?: number;
  upstreamDetails?: string;
  pngByteLength?: number;
}

// Helper to extract decision from bundle output
function extractDecision(bundle: CERBundle): { decision: string; reason: string } | null {
  const output = bundle.output || bundle.result || bundle.decision;
  if (!output || typeof output !== 'object') return null;
  
  const o = output as Record<string, unknown>;
  const decision = o.decision || o.result || o.outcome;
  const reason = o.reason || o.message || o.explanation || o.details;
  
  if (typeof decision === 'string') {
    return {
      decision: decision.toUpperCase(),
      reason: typeof reason === 'string' ? reason : '',
    };
  }
  return null;
}

// Helper to extract policy info from bundle
function extractPolicy(bundle: CERBundle): { name: string; version: string; rule?: string } | null {
  const ec = bundle.executionConditions;
  if (ec) {
    return {
      name: (ec.policy_name || ec.policyName || ec.engine || 'Unknown') as string,
      version: (ec.policy_version || ec.policyVersion || ec.engineVersion || '1.0') as string,
      rule: ec.rule as string | undefined,
    };
  }
  return null;
}

// Helper to extract certification info
function extractCertification(bundle: CERBundle): { protocol: string; protocolVersion: string; certifiedBy?: string } {
  const cert = bundle.certification;
  const canonical = bundle.canonical;
  const ec = bundle.executionConditions;
  
  return {
    protocol: cert?.protocol as string || canonical?.protocol || 'nexart',
    protocolVersion: cert?.protocol_version as string || cert?.protocolVersion as string || canonical?.protocolVersion || '1.2.0',
    certifiedBy: cert?.certified_by as string || cert?.certifiedBy as string || 'NexArt Canonical Renderer',
  };
}

// Helper to format input snapshot as table rows
function formatInputAsTable(bundle: CERBundle): Array<{ label: string; value: string }> {
  const input = bundle.inputSnapshot || bundle.input || bundle.claim;
  if (!input || typeof input !== 'object') return [];
  
  const rows: Array<{ label: string; value: string }> = [];
  const i = input as Record<string, unknown>;
  
  // Map common fields to friendly labels
  const labelMap: Record<string, string> = {
    account_id: 'Account ID',
    accountId: 'Account ID',
    withdrawals_24h: 'Withdrawals (24h)',
    withdrawals24h: 'Withdrawals (24h)',
    amount_24h: 'Amount (24h)',
    amount24h: 'Amount (24h)',
    window: 'Window',
    window_hours: 'Window (hours)',
    title: 'Title',
    statement: 'Statement',
    subject: 'Subject',
    type: 'Type',
    eventDate: 'Event Date',
  };
  
  for (const [key, value] of Object.entries(i)) {
    if (value !== undefined && value !== null) {
      const label = labelMap[key] || key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
      let displayValue = String(value);
      if (typeof value === 'number' && key.toLowerCase().includes('amount')) {
        displayValue = `$${value.toLocaleString()}`;
      }
      rows.push({ label, value: displayValue });
    }
  }
  
  return rows;
}

function extractExistingAICERAttestation(bundle: AICERBundle): {
  attestationHash?: string;
  runtimeHash?: string;
  protocolVersion?: string;
  requestId?: string;
  nodeRequestId?: string;
} | null {
  const b = bundle as Record<string, unknown>;
  // Check meta.attestation first (AI CER standard), then top-level
  const meta = b.meta as Record<string, unknown> | undefined;
  const metaAtt = meta?.attestation as Record<string, unknown> | undefined;
  const topAtt = b.attestation as Record<string, unknown> | undefined;
  const att = (metaAtt && typeof metaAtt === 'object') ? metaAtt : topAtt;

  const attestationHash = (
    (att?.attestationId as string | undefined)
    || (att?.attestationHash as string | undefined)
    || (b.attestationId as string | undefined)
  );

  const runtimeHash = (
    (att?.nodeRuntimeHash as string | undefined)
    || (b.nodeRuntimeHash as string | undefined)
    || (b.runtimeHash as string | undefined)
  );

  const protocolVersion = (
    (att?.protocolVersion as string | undefined)
    || (b.protocolVersion as string | undefined)
  );

  const requestId = (b.requestId as string | undefined) || (att?.requestId as string | undefined);
  const nodeRequestId = (b.nodeRequestId as string | undefined) || (att?.nodeRequestId as string | undefined);

  if (!attestationHash && !runtimeHash && !att) {
    return null;
  }

  return { attestationHash, runtimeHash, protocolVersion, requestId, nodeRequestId };
}

export function AuditPage() {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  
  const [record, setRecord] = useState<AuditRecordRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Certificate verification state
  const [certVerification, setCertVerification] = useState<{
    verified: boolean;
    computedHash: string;
    expectedHash: string;
    bundleByteLength: number;
    canonicalJson: string;
  } | null>(null);
  const [isCertVerifying, setIsCertVerifying] = useState(false);
  
  // Render verification state
  const [renderVerification, setRenderVerification] = useState<RenderVerificationResult | null>(null);
  const [isRenderVerifying, setIsRenderVerifying] = useState(false);
  
  // Recertification state
  const [recertificationRun, setRecertificationRun] = useState<RecertificationRun | null>(null);
  const [recertifyResult, setRecertifyResult] = useState<RecertifyResponse | null>(null);
  const [isRecertifying, setIsRecertifying] = useState(false);
  
  // UI state
  const [showRawInput, setShowRawInput] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showWhyMatters, setShowWhyMatters] = useState(false);
  const [showTransmittedSensitive, setShowTransmittedSensitive] = useState(false);

  // AI CER attestation state
  const [aiCerRecertifyResult, setAiCerRecertifyResult] = useState<AICERRecertifyResponse | null>(null);
  const [isAiCerRecertifying, setIsAiCerRecertifying] = useState(false);

  useEffect(() => {
    async function loadRecord() {
      if (!hash) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      const normalizedHash = normalizeHash(hash);
      const data = await getAuditRecordByHash(normalizedHash || hash);
      
      if (data) {
        setRecord(data);
        await verifyCertificate(data);
        // Load latest recertification run
        const latestRun = await getLatestRecertificationRun(data.id);
        if (latestRun) {
          setRecertificationRun(latestRun);
        }
      } else {
        setNotFound(true);
      }
      
      setIsLoading(false);
    }
    
    loadRecord();
  }, [hash]);

  const handleRecertify = async () => {
    if (!record) return;
    
    setIsRecertifying(true);
    setRecertifyResult(null);
    
    try {
      const bundle = record.bundle_json as CERBundle;
      const expectedHash = resolveExpectedImageHash(bundle);
      
      const result = await recertifyBundle(
        record.id,
        bundle,
        undefined, // sourceUrl not available here
        expectedHash || undefined
      );
      
      setRecertifyResult(result);
      
      // Refresh the run from DB
      const latestRun = await getLatestRecertificationRun(record.id);
      if (latestRun) {
        setRecertificationRun(latestRun);
      }
      
      if (result.status === 'pass') {
        toast.success('Re-certification passed');
      } else if (result.status === 'fail') {
        toast.error('Re-certification failed: hash mismatch');
      } else if (result.status === 'error') {
        toast.error(`Re-certification error: ${result.errorCode || 'Unknown'}`);
      }
    } catch (err) {
      console.error('[AuditPage] Recertify error:', err);
      toast.error('Re-certification failed');
    } finally {
      setIsRecertifying(false);
    }
  };

  const handleAiCerRecertify = async () => {
    if (!record) return;
    const bundle = record.bundle_json as unknown as AICERBundle;

    // If imported bundle already carries node proof, do not re-attest.
    const existingAttestation = extractExistingAICERAttestation(bundle);
    if (existingAttestation) {
      setAiCerRecertifyResult({
        ok: true,
        status: 'pass',
        attestationHash: existingAttestation.attestationHash,
        canonicalRuntimeHash: existingAttestation.runtimeHash,
        canonicalProtocolVersion: existingAttestation.protocolVersion,
        requestId: existingAttestation.requestId,
        nodeRequestId: existingAttestation.nodeRequestId,
      });
      toast.info('Canonical Attestation: Present (from imported bundle)');
      return;
    }

    setIsAiCerRecertifying(true);
    setAiCerRecertifyResult(null);

    try {
      const result = await recertifyAICER(record.id, bundle);
      setAiCerRecertifyResult(result);

      // Refresh the run from DB
      const latestRun = await getLatestRecertificationRun(record.id);
      if (latestRun) {
        setRecertificationRun(latestRun);
      }

      if (result.status === 'pass') {
        toast.success('Canonical node attested this record');
      } else if (result.status === 'fail') {
        toast.error('Attestation rejected — discrepancy detected');
      } else if (result.status === 'error') {
        toast.error('Attestation unavailable — review details');
      } else if (result.status === 'skipped') {
        toast.info(result.errorMessage || 'Attestation skipped');
      }
    } catch (err) {
      console.error('[AuditPage] AI CER recertify error:', err);
      toast.error('Attestation request failed');
    } finally {
      setIsAiCerRecertifying(false);
    }
  };

  const verifyCertificate = async (rec: AuditRecordRow) => {
    setIsCertVerifying(true);
    try {
      const result = await verifyCertificateHash(rec.bundle_json, rec.certificate_hash);
      const canonicalJson = canonicalize(rec.bundle_json);
      
      setCertVerification({
        verified: result.verified,
        computedHash: result.computedHash,
        expectedHash: result.expectedHash,
        bundleByteLength: new TextEncoder().encode(canonicalJson).length,
        canonicalJson,
      });
    } catch (err) {
      console.error('Certificate verification failed:', err);
    } finally {
      setIsCertVerifying(false);
    }
  };

  const verifyRender = async () => {
    if (!record) return;
    
    const bundle = record.bundle_json as CERBundle;
    if (!bundle.snapshot) {
      toast.error('No snapshot in bundle', { description: 'Cannot verify render without execution snapshot' });
      return;
    }
    
    const expectedHash = resolveExpectedImageHash(bundle);
    const hashSource = getImageHashSource(bundle);
    
    if (!expectedHash) {
      toast.error('No expected hash found', { description: 'Bundle missing expectedImageHash or baseline.posterHash' });
      setRenderVerification({
        verified: false,
        computedHash: null,
        expectedHash: null,
        error: 'Missing expected image hash in bundle',
        hashSource,
      });
      return;
    }
    
    setIsRenderVerifying(true);
    
    try {
      const proxyUrl = getProxyUrl();
      const snapshot = bundle.snapshot as AuditSnapshot;
      
      const response = await fetch(`${proxyUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: {
            code: snapshot.code,
            seed: snapshot.seed,
            vars: snapshot.vars,
          },
          expectedImageHash: expectedHash,
        }),
      });
      
      const requestId = response.headers.get('x-request-id') || undefined;
      
      if (!response.ok) {
        const errorBody = await response.text();
        let upstreamDetails = errorBody;
        try {
          const parsed = JSON.parse(errorBody);
          upstreamDetails = parsed.details || parsed.message || errorBody;
        } catch {
          // Keep raw text
        }
        
        setRenderVerification({
          verified: false,
          computedHash: null,
          expectedHash,
          hashSource,
          error: `Render failed (HTTP ${response.status})`,
          requestId,
          upstreamStatus: response.status,
          upstreamDetails: upstreamDetails.slice(0, 300),
        });
        toast.error('Render verification failed');
        return;
      }
      
      const result = await response.json();
      
      const verified = result.verified === true;
      const computedHash = normalizeHash(result.computedHash);
      
      setRenderVerification({
        verified,
        computedHash,
        expectedHash,
        hashSource,
        error: verified ? undefined : 'Hash mismatch',
        pngByteLength: result.pngByteLength,
      });
      
      if (verified) {
        toast.success('Render verified');
      } else {
        toast.error('Render verification failed', { description: 'Hash mismatch' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setRenderVerification({
        verified: false,
        computedHash: null,
        expectedHash,
        hashSource,
        error: `Network error: ${message}`,
      });
      toast.error('Render verification failed', { description: message });
    } finally {
      setIsRenderVerifying(false);
    }
  };

  const handleCopyCanonical = () => {
    if (certVerification) {
      navigator.clipboard.writeText(certVerification.canonicalJson);
      toast.success('Canonical JSON copied');
    }
  };

  const handleDownloadBundle = () => {
    if (!record) return;
    
    const blob = new Blob([JSON.stringify(record.bundle_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cer-${record.certificate_hash.slice(0, 16)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bundle downloaded');
  };

  const handleCopyHash = (hashValue: string, label = 'Hash') => {
    navigator.clipboard.writeText(hashValue);
    toast.success(`${label} copied`);
  };
  
  const handleCopySnapshot = () => {
    if (!record) return;
    const bundle = record.bundle_json as CERBundle;
    if (bundle.snapshot) {
      navigator.clipboard.writeText(JSON.stringify(bundle.snapshot, null, 2));
      toast.success('Snapshot JSON copied');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/audit-log')}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Audit Log
        </Button>
        
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center py-8">
              <AlertTriangle className="w-12 h-12 text-warning" />
              <div>
                <h3 className="text-lg font-semibold">Record Not Found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No audit record found with hash:
                </p>
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded mt-2 inline-block break-all">
                  {hash}
                </code>
              </div>
              <Button onClick={() => navigate('/')}>
                Import a Bundle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record) return null;

  const bundle = record.bundle_json as CERBundle;
  const isAiCer = isAICERBundle(record.bundle_json);
  const hasSnapshot = !!bundle.snapshot;
  const snapshot = bundle.snapshot as AuditSnapshot | undefined;
  const expectedImageHash = resolveExpectedImageHash(bundle);
  const expectedAnimationHash = resolveExpectedAnimationHash(bundle);
  const imageHashSource = getImageHashSource(bundle);
  
  // Extract structured data
  const decisionInfo = extractDecision(bundle);
  const policyInfo = extractPolicy(bundle);
  const certInfo = extractCertification(bundle);
  const inputRows = formatInputAsTable(bundle);
  
  // Check if snapshot is complete (has code/seed/vars)
  const hasRenderableSnapshot = hasSnapshot && 
    typeof snapshot?.code === 'string' &&
    typeof snapshot?.seed === 'number' &&
    Array.isArray(snapshot?.vars);

  // AI CER bundle: render dedicated view
  if (isAiCer) {
    const aiBundle = record.bundle_json as unknown as AICERBundle;
    const existingAttestation = extractExistingAICERAttestation(aiBundle);
    const preflight = validateAICERForAttestation(aiBundle);
    const effectiveAiCerResult: AICERRecertifyResponse | null = aiCerRecertifyResult || (
      existingAttestation
        ? {
            ok: true,
            status: 'pass',
            attestationHash: existingAttestation.attestationHash,
            canonicalRuntimeHash: existingAttestation.runtimeHash,
            canonicalProtocolVersion: existingAttestation.protocolVersion,
            requestId: existingAttestation.requestId,
            nodeRequestId: existingAttestation.nodeRequestId,
          }
        : null
    );

    return (
      <div className="max-w-4xl mx-auto space-y-6 px-4 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/audit-log')} className="self-start">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Audit Log
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadBundle}>
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleCopyHash(record.certificate_hash, 'Certificate hash')}
              >
                <Hash className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Copy Hash</span>
              </Button>
            </div>
          </div>
        </div>

        {/* AI Execution Record — uses CertificationReport layout */}
        {(() => {
          // Single source of truth: SDK verifier on raw bundle
          const vResult = verifyUploadedBundle(aiBundle);
          const sdkVerifyResult = {
            ok: vResult.ok,
            code: vResult.code as any,
            errors: vResult.errors,
            details: vResult.details,
          };
          const att = (aiBundle as any).meta?.attestation || (aiBundle as any).attestation;
          const attPresent = !!(att && typeof att === 'object' && (att.attestationId || att.attestationStatus));
          const attFields = attPresent ? {
            attestationId: att.attestationId,
            nodeRuntimeHash: att.nodeRuntimeHash,
            protocolVersion: att.protocolVersion,
            certificateHash: (aiBundle as any).certificateHash,
          } : undefined;

          return (
            <AICERVerifyResult
              verifyResult={sdkVerifyResult}
              bundle={aiBundle}
              attestationPresent={attPresent}
              attestationFields={attFields}
              onAttest={handleAiCerRecertify}
              isAttesting={isAiCerRecertifying}
              attestResult={null}
              attestError={null}
            />
          );
        })()}

        {/* Canonical Attestation */}
        <AICERRecertificationStatus
          result={effectiveAiCerResult}
          latestRun={recertificationRun}
          isLoading={isAiCerRecertifying}
          onRecertify={handleAiCerRecertify}
          enabled={!existingAttestation}
          attestable={preflight.attestable}
          missingFields={preflight.missingFields}
          existingAttestationPresent={!!existingAttestation}
        />
      </div>
    );
  }

  // Standard CER bundle view
  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/audit-log')} className="self-start">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Audit Log
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadBundle}>
              <Download className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleCopyHash(record.certificate_hash, 'Certificate hash')}
            >
              <Hash className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Copy Hash</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* EXECUTIVE SUMMARY */}
      {/* ============================================ */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Certified Execution Record</CardTitle>
          </div>
          <CardDescription className="text-sm leading-relaxed mt-2">
            This record proves that a specific decision was produced from specific inputs 
            under a specific policy and runtime, and that anyone can reproduce the result 
            by re-executing the snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Decision */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Decision</p>
              {decisionInfo ? (
                <Badge 
                  variant={decisionInfo.decision === 'ALLOW' ? 'default' : 'destructive'}
                  className="text-lg px-3 py-1"
                >
                  {decisionInfo.decision}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Not applicable</span>
              )}
            </div>
            
            {/* Reason */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm font-medium">
                {decisionInfo?.reason || record.statement || 'See output details'}
              </p>
            </div>
            
            {/* Policy */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Policy</p>
              <p className="text-sm font-medium">
                {policyInfo ? `${policyInfo.name} v${policyInfo.version}` : 'Not specified'}
              </p>
            </div>
            
            {/* Certificate Hash */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Certificate Hash</p>
              <code className="text-xs font-mono break-all">
                {truncateHash(record.certificate_hash, 8, 8)}
              </code>
            </div>
          </div>
          
          {/* Why this matters - expandable */}
          <div className="pt-2">
            <button
              onClick={() => setShowWhyMatters(!showWhyMatters)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="w-4 h-4" />
              <span>Why this matters</span>
              {showWhyMatters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showWhyMatters && (
              <ul className="mt-3 text-sm text-muted-foreground space-y-2 pl-6 list-disc">
                <li><strong>Prevents disputes:</strong> Same inputs always produce the same decision</li>
                <li><strong>Prevents drift:</strong> Engine and policy versions are permanently recorded</li>
                <li><strong>Supports audit:</strong> Bundle hash covers inputs + conditions + output + snapshot</li>
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* POLICY EXPLANATION */}
      {/* ============================================ */}
      {policyInfo && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Policy Explanation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {policyInfo.rule ? (
              <>
                <p className="text-sm bg-muted p-3 rounded-lg font-mono">
                  {policyInfo.rule}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(bundle.executionConditions as Record<string, unknown>)?.max_withdrawals !== undefined && (
                    <Badge variant="outline">Max withdrawals: {String((bundle.executionConditions as Record<string, unknown>).max_withdrawals)}</Badge>
                  )}
                  {(bundle.executionConditions as Record<string, unknown>)?.max_amount !== undefined && (
                    <Badge variant="outline">Max amount: ${String((bundle.executionConditions as Record<string, unknown>).max_amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Badge>
                  )}
                  {(bundle.executionConditions as Record<string, unknown>)?.window_hours !== undefined && (
                    <Badge variant="outline">Window: {String((bundle.executionConditions as Record<string, unknown>).window_hours)}h</Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Policy details not provided in this bundle.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* LAYER 1: INPUT SNAPSHOT */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
            <div>
              <CardTitle className="text-base">Input Snapshot</CardTitle>
              <CardDescription className="text-xs">The exact inputs used to produce the decision.</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-xs mt-2">immutable</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {inputRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {inputRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{row.label}</td>
                      <td className="py-2 font-mono">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No structured input data available.</p>
          )}
          
          {/* Toggle raw JSON */}
          <button
            onClick={() => setShowRawInput(!showRawInput)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showRawInput ? 'Hide' : 'Show'} raw JSON</span>
          </button>
          {showRawInput && (
            <div className="bg-muted rounded-lg p-3 max-h-48 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(bundle.claim || bundle.inputSnapshot || bundle.input || {}, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Sources */}
          {bundle.sources && bundle.sources.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-xs font-medium mb-2">Sources ({bundle.sources.length})</p>
              <div className="space-y-1.5">
                {bundle.sources.map((source, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded p-2">
                    <span className="font-medium">{source.label}</span>
                    {source.url && (
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="ml-2 text-primary hover:underline break-all"
                      >
                        {source.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* LAYER 2: EXECUTION CONDITIONS */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
            <div>
              <CardTitle className="text-base">Execution Conditions</CardTitle>
              <CardDescription className="text-xs">How the decision was executed (engine, policy, runtime, determinism).</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-xs mt-2">immutable</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">Engine</td>
                  <td className="py-2 font-mono">{bundle.executionConditions?.engine || 'N/A'}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">Engine Version</td>
                  <td className="py-2 font-mono">{bundle.executionConditions?.engineVersion || 'N/A'}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">Policy</td>
                  <td className="py-2 font-mono">
                    {policyInfo ? `${policyInfo.name} v${policyInfo.version}` : 'N/A'}
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">Runtime</td>
                  <td className="py-2 font-mono">
                    {bundle.executionConditions?.runtime || bundle.canonical?.nodeVersion || 'N/A'}
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">Determinism</td>
                  <td className="py-2">
                    <Badge variant={hasSnapshot || bundle.executionConditions?.deterministic ? 'default' : 'secondary'}>
                      {hasSnapshot || bundle.executionConditions?.deterministic ? 'Reproducible' : 'Attestation'}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Certification block */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-xs font-medium mb-2">Certification</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Certified by</span>
                <span className="font-mono">{certInfo.certifiedBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Protocol</span>
                <span className="font-mono">{certInfo.protocol}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Protocol Version</span>
                <span className="font-mono">{certInfo.protocolVersion}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* LAYER 3: CERTIFIED OUTPUT */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
            <div>
              <CardTitle className="text-base">Certified Output</CardTitle>
              <CardDescription className="text-xs">The exact outcome produced by the run.</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-xs mt-2">immutable</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {decisionInfo ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Decision</p>
                  <Badge 
                    variant={decisionInfo.decision === 'ALLOW' ? 'default' : 'destructive'}
                    className="text-base"
                  >
                    {decisionInfo.decision}
                  </Badge>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm">{decisionInfo.reason || 'Not provided'}</p>
                </div>
              </div>
              
              {/* Outcome interpretation */}
              <div className="p-3 bg-muted/30 rounded-lg text-sm">
                <strong>Outcome interpretation:</strong>{' '}
                {decisionInfo.decision === 'BLOCK' 
                  ? 'Decision blocked by velocity policy thresholds.'
                  : decisionInfo.decision === 'ALLOW'
                    ? 'Decision allowed; inputs remain within limits.'
                    : `Decision: ${decisionInfo.decision}`
                }
              </div>
            </>
          ) : (
            <div className="bg-muted rounded-lg p-3 max-h-48 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(bundle.output || bundle.result || bundle.decision || { note: 'No output data' }, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Expected hashes */}
          {expectedImageHash && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Expected Image Hash (poster)</p>
                  <code className="text-xs font-mono break-all block">
                    {formatHashForDisplay(expectedImageHash)}
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Source: <span className="font-mono">{imageHashSource}</span>
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => handleCopyHash(expectedImageHash, 'Image hash')}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* LAYER 4: CERTIFICATION PROOF */}
      {/* ============================================ */}
      <Card className={
        certVerification?.verified 
          ? 'border-verified/30' 
          : certVerification 
            ? 'border-destructive/30' 
            : ''
      }>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</div>
            <div>
              <CardTitle className="text-base">Certification Proof (Seal)</CardTitle>
              <CardDescription className="text-xs">Hash of the canonical bundle. If any input/condition/output/snapshot changes, the hash changes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Certificate Hash */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Certificate Hash (SHA-256)</p>
                <code className="text-xs font-mono break-all block">
                  {formatHashForDisplay(record.certificate_hash)}
                </code>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => handleCopyHash(record.certificate_hash, 'Certificate hash')}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          
          {/* Verification status */}
          {isCertVerifying ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying certificate...
            </div>
          ) : certVerification ? (
            <div className={`p-3 rounded-lg border ${
              certVerification.verified 
                ? 'border-verified/30 bg-verified/5' 
                : 'border-destructive/30 bg-destructive/5'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {certVerification.verified ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-verified" />
                    <span className="text-sm font-medium text-verified">Certificate Verified</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">Certificate Mismatch</span>
                  </>
                )}
              </div>
              
              <div className="text-xs space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground block">Stored hash:</span>
                    <code className="font-mono break-all">
                      {truncateHash(certVerification.expectedHash, 10, 10)}
                    </code>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Computed hash:</span>
                    <code className="font-mono break-all">
                      {truncateHash(certVerification.computedHash, 10, 10)}
                    </code>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <span className="text-muted-foreground">Bundle size: </span>
                  <span className="font-mono">{certVerification.bundleByteLength.toLocaleString()} bytes</span>
                </div>
              </div>
            </div>
          ) : null}
          
          {/* What is covered */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">What is covered by this hash:</p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>Inputs (claim/inputSnapshot)</li>
              <li>Execution conditions (engine, policy, runtime)</li>
              <li>Output (decision, reason)</li>
              <li>Certification metadata</li>
              {hasRenderableSnapshot && <li>Snapshot code + seed + vars</li>}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* CANONICAL RE-CERTIFICATION */}
      {/* ============================================ */}
      {hasRenderableSnapshot && (
        <RecertificationStatus
          result={recertifyResult}
          latestRun={recertificationRun}
          isLoading={isRecertifying}
          onRecertify={handleRecertify}
          enabled={true}
        />
      )}
      {/* REPRODUCIBLE SNAPSHOT */}
      {/* ============================================ */}
      {hasSnapshot && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Reproducible Snapshot</CardTitle>
            </div>
            <CardDescription className="text-xs">
              This code is executed by the NexArt canonical renderer to deterministically 
              produce the artifact linked to this record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Seed</p>
                <p className="font-mono text-sm">{snapshot?.seed ?? 'N/A'}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Vars</p>
                <p className="font-mono text-xs truncate">
                  {Array.isArray(snapshot?.vars) 
                    ? `[${snapshot.vars.slice(0, 10).join(', ')}${snapshot.vars.length > 10 ? '...' : ''}]`
                    : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Code Length</p>
                <p className="font-mono text-sm">{snapshot?.code?.length || 0} chars</p>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowCode(!showCode)}
              >
                <Eye className="w-4 h-4 mr-1" />
                {showCode ? 'Hide code' : 'View code'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopySnapshot}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy snapshot JSON
              </Button>
              {hasRenderableSnapshot && expectedImageHash && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={verifyRender}
                  disabled={isRenderVerifying}
                >
                  {isRenderVerifying ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-1" />
                  )}
                  Re-run on canonical renderer
                </Button>
              )}
            </div>
            
            {/* Code viewer */}
            {showCode && snapshot?.code && (
              <div className="bg-muted rounded-lg p-3 max-h-64 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {snapshot.code}
                </pre>
              </div>
            )}
            
            {/* Render verification result */}
            {renderVerification && (
              <div className={`p-3 rounded-lg border ${
                renderVerification.verified 
                  ? 'border-verified/30 bg-verified/5' 
                  : 'border-destructive/30 bg-destructive/5'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {renderVerification.verified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-verified" />
                      <span className="text-sm font-medium text-verified">Render Verified</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">Render Failed</span>
                    </>
                  )}
                </div>
                
                <div className="text-xs space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:gap-2">
                    <span className="text-muted-foreground shrink-0">Computed:</span>
                    <code className="font-mono break-all">
                      {renderVerification.computedHash 
                        ? truncateHash(renderVerification.computedHash, 12, 12)
                        : '(none)'}
                    </code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:gap-2">
                    <span className="text-muted-foreground shrink-0">Expected:</span>
                    <code className="font-mono break-all">
                      {truncateHash(renderVerification.expectedHash, 12, 12)}
                    </code>
                  </div>
                </div>
                
                {!renderVerification.verified && renderVerification.error && (
                  <div className="mt-3 pt-3 border-t border-destructive/20 text-xs">
                    <p className="text-destructive">{renderVerification.error}</p>
                    {renderVerification.requestId && (
                      <p className="text-muted-foreground mt-1">
                        Request ID: <code className="font-mono">{renderVerification.requestId}</code>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* TECHNICAL APPENDIX */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base text-muted-foreground">Technical Appendix</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="canonical">
              <AccordionTrigger className="text-sm">
                Canonical JSON (used for hashing)
              </AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 z-10"
                    onClick={handleCopyCanonical}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </Button>
                  <div className="bg-muted rounded-lg p-3 max-h-64 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {certVerification?.canonicalJson || record.canonical_json}
                    </pre>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="full-bundle">
              <AccordionTrigger className="text-sm">
                Full Bundle JSON
              </AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 z-10"
                    onClick={handleDownloadBundle}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download
                  </Button>
                  <div className="bg-muted rounded-lg p-3 max-h-64 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(record.bundle_json, null, 2)}
                    </pre>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="metadata">
              <AccordionTrigger className="text-sm">
                Fetch Source & Metadata
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="text-muted-foreground">Import source:</div>
                    <div className="font-mono">{record.import_source || 'unknown'}</div>
                    
                    <div className="text-muted-foreground">Imported at:</div>
                    <div className="font-mono">{new Date(record.created_at).toISOString()}</div>
                    
                    <div className="text-muted-foreground">Bundle created at:</div>
                    <div className="font-mono">
                      {record.bundle_created_at 
                        ? new Date(record.bundle_created_at).toISOString()
                        : 'Not provided by source'}
                    </div>
                    
                    <div className="text-muted-foreground">Bundle version:</div>
                    <div className="font-mono">{record.bundle_version}</div>
                    
                    <div className="text-muted-foreground">Mode:</div>
                    <div className="font-mono">{record.mode}</div>
                    
                    {record.render_status && (
                      <>
                        <div className="text-muted-foreground">Render status:</div>
                        <div>
                          <Badge variant={
                            record.render_status === 'VERIFIED' ? 'default' :
                            record.render_status === 'FAILED' ? 'destructive' :
                            'secondary'
                          } className="text-xs">
                            {record.render_status}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
