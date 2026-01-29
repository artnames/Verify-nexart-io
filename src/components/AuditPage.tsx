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
  RefreshCw,
  AlertTriangle,
  Hash,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuditRecordByHash } from '@/api/auditRecords';
import { verifyCertificateHash, canonicalize } from '@/lib/canonicalize';
import { verifyCertified } from '@/certified/canonicalClient';
import type { AuditRecordRow, CERBundle } from '@/types/auditRecord';

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
  } | null>(null);
  const [isCertVerifying, setIsCertVerifying] = useState(false);
  
  // Render verification state
  const [renderVerification, setRenderVerification] = useState<{
    verified: boolean;
    computedHash: string | null;
    expectedHash: string | null;
    error?: string;
  } | null>(null);
  const [isRenderVerifying, setIsRenderVerifying] = useState(false);

  useEffect(() => {
    async function loadRecord() {
      if (!hash) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      const data = await getAuditRecordByHash(hash);
      
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
      setCertVerification({
        verified: result.verified,
        computedHash: result.computedHash,
        expectedHash: result.expectedHash,
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
    
    setIsRenderVerifying(true);
    try {
      const response = await verifyCertified(
        bundle.snapshot,
        record.expected_image_hash || undefined,
        record.expected_animation_hash || undefined
      );
      
      const computedHash = response.computedHash || response.computedPosterHash || null;
      const verified = response.verified || false;
      
      setRenderVerification({
        verified,
        computedHash,
        expectedHash: record.expected_image_hash,
        error: verified ? undefined : 'Hash mismatch',
      });
      
      if (verified) {
        toast.success('Render verified');
      } else {
        toast.error('Render verification failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setRenderVerification({
        verified: false,
        computedHash: null,
        expectedHash: record.expected_image_hash,
        error: message,
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

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success('Hash copied');
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
      <div className="max-w-4xl mx-auto space-y-6">
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
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded mt-2 inline-block">
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/audit-log')} className="mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Audit Log
          </Button>
          <h1 className="text-xl font-semibold">{record.title || 'Certified Execution Record'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{record.statement}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyCanonical}>
            <Copy className="w-4 h-4 mr-1" />
            Copy Canonical
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadBundle}>
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Layer 1: Input Snapshot */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Input Snapshot (immutable)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 max-h-64 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(bundle.claim || bundle.inputSnapshot || bundle.input || {}, null, 2)}
            </pre>
          </div>
          {bundle.sources && bundle.sources.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Sources ({bundle.sources.length})</p>
              <div className="space-y-2">
                {bundle.sources.map((source, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded p-2">
                    <span className="font-medium">{source.label}</span>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <p className="text-sm font-mono">{bundle.canonical?.protocol || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Protocol Version</p>
              <p className="text-sm font-mono">{bundle.canonical?.protocolVersion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="text-sm font-mono">{record.bundle_created_at ? new Date(record.bundle_created_at).toISOString() : 'N/A'}</p>
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
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Seed</p>
                  <p className="font-mono">{bundle.snapshot.seed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vars</p>
                  <p className="font-mono text-xs">[{bundle.snapshot.vars?.slice(0, 5).join(', ')}...]</p>
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

      {/* Layer 3: Output Record */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="w-4 h-4" />
            Certified Output
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Expected Hashes */}
          <div className="space-y-3">
            {record.expected_image_hash && (
              <div className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Expected Image Hash</p>
                  <code className="text-xs font-mono break-all">{record.expected_image_hash}</code>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleCopyHash(record.expected_image_hash!)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            
            {record.expected_animation_hash && (
              <div className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Expected Animation Hash</p>
                  <code className="text-xs font-mono break-all">{record.expected_animation_hash}</code>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleCopyHash(record.expected_animation_hash!)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            
            {bundle.output || bundle.result || bundle.decision ? (
              <div className="bg-muted rounded-lg p-4 max-h-48 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(bundle.output || bundle.result || bundle.decision, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
          
          {/* Render Verification */}
          {hasSnapshot && record.expected_image_hash && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
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
                <div className={`p-3 rounded-lg border ${renderVerification.verified ? 'border-verified/30 bg-verified/5' : 'border-destructive/30 bg-destructive/5'}`}>
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
                  
                  {renderVerification.computedHash && (
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="text-muted-foreground">Computed: </span>
                        <code className="font-mono">{renderVerification.computedHash.slice(0, 24)}...</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected: </span>
                        <code className="font-mono">{renderVerification.expectedHash?.slice(0, 24)}...</code>
                      </div>
                    </div>
                  )}
                  
                  {renderVerification.error && !renderVerification.verified && (
                    <p className="text-xs text-destructive mt-2">{renderVerification.error}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layer 4: Certification Proof */}
      <Card className={certVerification?.verified ? 'border-verified/30' : certVerification ? 'border-destructive/30' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Execution Certificate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Certificate Hash */}
          <div className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-lg mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Certificate Hash (SHA-256 of canonical bundle)</p>
              <code className="text-xs font-mono break-all">{record.certificate_hash}</code>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleCopyHash(record.certificate_hash)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          
          {/* Verification Status */}
          <div className={`p-4 rounded-lg border ${certVerification?.verified ? 'border-verified/30 bg-verified/5' : certVerification ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
            {isCertVerifying ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verifying certificate...</span>
              </div>
            ) : certVerification ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {certVerification.verified ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-verified" />
                      <span className="font-medium text-verified">Certificate Verified</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-destructive" />
                      <span className="font-medium text-destructive">Certificate Invalid</span>
                    </>
                  )}
                </div>
                
                <div className="text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Expected:</span>
                    <code className="font-mono break-all">{certVerification.expectedHash}</code>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Computed:</span>
                    <code className="font-mono break-all">{certVerification.computedHash}</code>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  The certificate hash covers all bundle fields including claim, sources, snapshot, and baseline hashes.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Certificate not yet verified</span>
              </div>
            )}
          </div>
          
          {/* Metadata */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Imported</p>
              <p>{new Date(record.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Import Source</p>
              <Badge variant="outline">{record.import_source || 'unknown'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
