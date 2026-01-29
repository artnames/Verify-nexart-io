/**
 * Audit Page - Four-layer compliance view for Certified Execution Records
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  Download, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  FileJson,
  Clock,
  Server,
  Shield,
  FileText,
  AlertTriangle,
  Hash,
  Play,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuditRecordByHash } from '@/api/auditRecords';
import { verifyCertificateHash, canonicalize } from '@/lib/canonicalize';
import { 
  resolveExpectedImageHash, 
  resolveExpectedAnimationHash,
  getImageHashSource,
  formatHashForDisplay,
  truncateHash,
  normalizeHash,
  hashesMatch
} from '@/lib/hashResolver';
import { getProxyUrl } from '@/certified/canonicalConfig';
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
    canonicalPreview: string;
  } | null>(null);
  const [isCertVerifying, setIsCertVerifying] = useState(false);
  
  // Render verification state
  const [renderVerification, setRenderVerification] = useState<RenderVerificationResult | null>(null);
  const [isRenderVerifying, setIsRenderVerifying] = useState(false);
  
  // UI state
  const [showCanonicalPreview, setShowCanonicalPreview] = useState(false);

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
        // Auto-verify certificate on load
        await verifyCertificate(data);
      } else {
        setNotFound(true);
      }
      
      setIsLoading(false);
    }
    
    loadRecord();
  }, [hash]);

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
        canonicalPreview: canonicalJson.length > 500 
          ? canonicalJson.slice(0, 500) + '...'
          : canonicalJson,
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
    
    // Resolve expected hash using shared helper
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
      // Call edge proxy /verify endpoint
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
    if (record) {
      navigator.clipboard.writeText(record.canonical_json);
      toast.success('Canonical JSON copied');
    }
  };

  const handleDownloadBundle = () => {
    if (!record) return;
    
    const blob = new Blob([JSON.stringify(record.bundle_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${record.certificate_hash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bundle downloaded');
  };

  const handleCopyHash = (hashValue: string, label = 'Hash') => {
    navigator.clipboard.writeText(hashValue);
    toast.success(`${label} copied`);
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
  const hasSnapshot = !!bundle.snapshot;
  const expectedImageHash = resolveExpectedImageHash(bundle);
  const expectedAnimationHash = resolveExpectedAnimationHash(bundle);
  const imageHashSource = getImageHashSource(bundle);

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 px-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/audit-log')} className="self-start">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Audit Log
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyCanonical}>
              <Copy className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Copy Canonical</span>
              <span className="sm:hidden">Canonical</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadBundle}>
              <Download className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Download Bundle</span>
              <span className="sm:hidden">Download</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleCopyHash(record.certificate_hash, 'Certificate hash')}
            >
              <Hash className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Copy Hash</span>
              <span className="sm:hidden">Hash</span>
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">{record.title || 'Certified Execution Record'}</h1>
          {record.statement && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{record.statement}</p>
          )}
        </div>
      </div>

      {/* Layer 1: Input Snapshot (immutable) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Input Snapshot
            <Badge variant="secondary" className="text-xs">immutable</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-3 md:p-4 max-h-64 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(bundle.claim || bundle.inputSnapshot || bundle.input || {}, null, 2)}
            </pre>
          </div>
          {bundle.sources && bundle.sources.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Sources ({bundle.sources.length})</p>
              <div className="space-y-2">
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

      {/* Layer 2: Execution Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" />
            Execution Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Mode</p>
              <Badge variant="outline" className="mt-1">{record.mode}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bundle Version</p>
              <p className="text-sm font-mono">{record.bundle_version}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Protocol</p>
              <p className="text-sm font-mono">{bundle.canonical?.protocol || bundle.protocol?.protocol || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Protocol Version</p>
              <p className="text-sm font-mono">{bundle.canonical?.protocolVersion || bundle.protocol?.protocolVersion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="text-xs md:text-sm font-mono">
                {record.bundle_created_at 
                  ? new Date(record.bundle_created_at).toISOString().split('T')[0]
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Renderer Version</p>
              <p className="text-sm font-mono">{bundle.canonical?.rendererVersion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Determinism</p>
              <Badge variant={hasSnapshot ? 'default' : 'secondary'}>
                {hasSnapshot ? 'Reproducible' : 'Attestation'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Has Snapshot</p>
              <Badge variant={hasSnapshot ? 'default' : 'outline'}>
                {hasSnapshot ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>
          
          {hasSnapshot && bundle.snapshot && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium mb-2">Execution Snapshot</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Seed</p>
                  <p className="font-mono">{bundle.snapshot.seed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vars</p>
                  <p className="font-mono text-xs truncate">
                    [{bundle.snapshot.vars?.slice(0, 5).join(', ')}...]
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Code Length</p>
                  <p className="font-mono">{bundle.snapshot.code?.length || 0} chars</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layer 3: Certified Output */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="w-4 h-4" />
            Certified Output
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Expected Hashes */}
          {expectedImageHash && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Expected Image Hash</p>
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
          
          {expectedAnimationHash && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Expected Animation Hash</p>
                  <code className="text-xs font-mono break-all block">
                    {formatHashForDisplay(expectedAnimationHash)}
                  </code>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => handleCopyHash(expectedAnimationHash, 'Animation hash')}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
          
          {(bundle.output || bundle.result || bundle.decision) && (
            <div className="bg-muted rounded-lg p-3 md:p-4 max-h-48 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(bundle.output || bundle.result || bundle.decision, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Render Verification */}
          {hasSnapshot && expectedImageHash && (
            <div className="pt-4 border-t border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <p className="text-sm font-medium">Render Verification</p>
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
                  Verify Render
                </Button>
              </div>
              
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
                    {renderVerification.hashSource && (
                      <div className="flex flex-col sm:flex-row sm:gap-2">
                        <span className="text-muted-foreground shrink-0">Hash source:</span>
                        <code className="font-mono">{renderVerification.hashSource}</code>
                      </div>
                    )}
                    {renderVerification.pngByteLength && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">PNG size:</span>
                        <span>{(renderVerification.pngByteLength / 1024).toFixed(1)} KB</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Error details */}
                  {!renderVerification.verified && renderVerification.error && (
                    <div className="mt-3 pt-3 border-t border-destructive/20">
                      <p className="text-xs font-medium text-destructive mb-1">Error Details</p>
                      <p className="text-xs text-destructive">{renderVerification.error}</p>
                      {renderVerification.requestId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Request ID: <code className="font-mono">{renderVerification.requestId}</code>
                        </p>
                      )}
                      {renderVerification.upstreamStatus && (
                        <p className="text-xs text-muted-foreground">
                          Upstream status: <code className="font-mono">{renderVerification.upstreamStatus}</code>
                        </p>
                      )}
                      {renderVerification.upstreamDetails && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                          {renderVerification.upstreamDetails}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layer 4: Execution Certificate */}
      <Card className={
        certVerification?.verified 
          ? 'border-verified/30' 
          : certVerification 
            ? 'border-destructive/30' 
            : ''
      }>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Execution Certificate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Certificate Hash */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">
                  Certificate Hash (SHA-256 of canonical bundle)
                </p>
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
          
          {/* Certificate Verification */}
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
              
              {/* Canonical JSON Preview */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <button
                  onClick={() => setShowCanonicalPreview(!showCanonicalPreview)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Canonical JSON preview</span>
                  {showCanonicalPreview ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {showCanonicalPreview && (
                  <div className="mt-2 bg-muted rounded p-2 max-h-32 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {certVerification.canonicalPreview}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          
          {/* What the certificate covers */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">This certificate covers:</p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>Input snapshot and claim data</li>
              <li>Execution conditions and parameters</li>
              <li>Protocol and renderer versions</li>
              {hasSnapshot && <li>Reproducible execution code and seed</li>}
              {expectedImageHash && <li>Expected output hash baseline</li>}
            </ul>
          </div>
          
          {/* Record Metadata */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Record Metadata</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Imported at:</span>
                <p className="font-mono">{new Date(record.created_at).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Import source:</span>
                <p className="font-mono">{record.import_source || 'unknown'}</p>
              </div>
              {record.render_status && (
                <div>
                  <span className="text-muted-foreground">Render status:</span>
                  <Badge variant={
                    record.render_status === 'VERIFIED' ? 'default' :
                    record.render_status === 'FAILED' ? 'destructive' :
                    'secondary'
                  } className="ml-1 text-xs">
                    {record.render_status}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
