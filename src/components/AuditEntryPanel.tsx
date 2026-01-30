/**
 * Audit Entry Panel - Hash/URL/Upload inputs for importing CER bundles
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Link2, 
  Upload, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  FileJson,
  Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getAuditRecordByHash, 
  fetchBundleFromUrl, 
  parseBundleJson,
  importAuditRecord,
  looksLikeHash,
  buildPublicCertificateUrl,
  getDecisionCertifierBaseUrl,
} from '@/api/auditRecords';
import { computeCertificateHash } from '@/lib/canonicalize';
import { normalizeHash } from '@/lib/hashResolver';

interface AuditEntryPanelProps {
  onRecordFound?: (hash: string) => void;
  compact?: boolean;
}

export function AuditEntryPanel({ onRecordFound, compact = false }: AuditEntryPanelProps) {
  const navigate = useNavigate();
  
  // Hash lookup state
  const [hashInput, setHashInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  
  // URL fetch state
  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchDetails, setFetchDetails] = useState<{
    requestId?: string;
    upstreamStatus?: number;
    fetchedFrom?: string;
    bodyPreview?: string;
    errorCode?: string;
    suggestion?: string;
    constructedUrl?: string;
  } | null>(null);
  
  // Preview URL for hash input
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  
  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Detect hash input and show URL preview
  const handleUrlInputChange = (value: string) => {
    setUrlInput(value);
    setError(null);
    setFetchDetails(null);
    
    if (looksLikeHash(value.trim())) {
      try {
        const constructedUrl = buildPublicCertificateUrl(value.trim());
        setUrlPreview(constructedUrl);
      } catch {
        setUrlPreview(null);
      }
    } else {
      setUrlPreview(null);
    }
  };

  const navigateToAudit = (hash: string) => {
    const normalizedHash = normalizeHash(hash);
    if (normalizedHash) {
      if (onRecordFound) {
        onRecordFound(normalizedHash);
      } else {
        navigate(`/audit/${normalizedHash}`);
      }
    }
  };

  const handleHashLookup = async () => {
    if (!hashInput.trim()) return;
    
    setIsLookingUp(true);
    setError(null);
    
    const normalizedHash = normalizeHash(hashInput.trim());
    if (!normalizedHash || !/^[a-f0-9]{64}$/.test(normalizedHash)) {
      setError('Invalid hash format. Expected 64 hexadecimal characters.');
      setIsLookingUp(false);
      return;
    }
    
    try {
      // Check if record exists
      const record = await getAuditRecordByHash(normalizedHash);
      
      if (record) {
        toast.success('Record found');
        navigateToAudit(normalizedHash);
      } else {
        setError('No record found with this hash. Import a bundle first.');
      }
    } catch (err) {
      setError('Lookup failed');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return;
    
    setIsFetching(true);
    setError(null);
    setFetchDetails(null);
    
    try {
      const input = urlInput.trim();
      const isHash = looksLikeHash(input);
      
      // For hash input, we pass it directly - the API will construct the URL
      // For URL input, validate it first
      if (!isHash) {
        try {
          new URL(input);
        } catch {
          setError('Invalid URL format');
          setIsFetching(false);
          return;
        }
      }
      
      // Fetch and parse bundle via server-side proxy (handles both URLs and hashes)
      const result = await fetchBundleFromUrl(input);
      
      // Store fetch details for error display
      if (result.requestId || result.upstreamStatus || result.fetchedFrom || result.bodyPreview || result.suggestion || result.errorCode || result.constructedUrl) {
        setFetchDetails({
          requestId: result.requestId,
          upstreamStatus: result.upstreamStatus,
          fetchedFrom: result.fetchedFrom,
          bodyPreview: result.bodyPreview,
          errorCode: result.errorCode,
          suggestion: result.suggestion,
          constructedUrl: result.constructedUrl,
        });
      }
      
      if (!result.success || !result.bundle) {
        setError(result.error || 'Failed to fetch bundle');
        setIsFetching(false);
        return;
      }
      
      // Compute hash and import
      const certificateHash = await computeCertificateHash(result.bundle);
      
      // Check if already exists
      const existing = await getAuditRecordByHash(certificateHash);
      if (existing) {
        toast.success('Bundle already in registry');
        navigateToAudit(certificateHash);
        return;
      }
      
      // Import new record
      const importResult = await importAuditRecord(result.bundle, 'url');
      
      if (importResult.authRequired) {
        setError('Sign in required to import new bundles');
        toast.error('Authentication required', { description: 'Sign in to import bundles' });
        return;
      }
      
      if (!importResult.success) {
        setError(importResult.error || 'Import failed');
        return;
      }
      
      toast.success('Bundle imported successfully');
      if (importResult.certificateHash) {
        navigateToAudit(importResult.certificateHash);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setIsFetching(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const text = await file.text();
      const result = parseBundleJson(text);
      
      if (!result.success || !result.bundle) {
        setError(result.error || 'Invalid bundle file');
        setIsUploading(false);
        return;
      }
      
      // Compute hash and check existence
      const certificateHash = await computeCertificateHash(result.bundle);
      
      const existing = await getAuditRecordByHash(certificateHash);
      if (existing) {
        toast.success('Bundle already in registry');
        navigateToAudit(certificateHash);
        return;
      }
      
      // Import new record
      const importResult = await importAuditRecord(result.bundle, 'upload');
      
      if (importResult.authRequired) {
        setError('Sign in required to import new bundles');
        toast.error('Authentication required', { description: 'Sign in to import bundles' });
        return;
      }
      
      if (!importResult.success) {
        setError(importResult.error || 'Import failed');
        return;
      }
      
      toast.success('Bundle imported successfully');
      if (importResult.certificateHash) {
        navigateToAudit(importResult.certificateHash);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  if (compact) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Hash Input */}
            <div className="flex-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Open by hash (sha256:... or hex)"
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleHashLookup()}
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleHashLookup}
                  disabled={isLookingUp || !hashInput.trim()}
                >
                  {isLookingUp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Upload Button */}
            <div>
              <Label htmlFor="bundle-upload-compact" className="sr-only">Upload bundle</Label>
              <Button
                variant="outline"
                disabled={isUploading}
                className="relative"
                asChild
              >
                <label htmlFor="bundle-upload-compact" className="cursor-pointer">
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload .json
                  <input
                    id="bundle-upload-compact"
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </Button>
            </div>
          </div>
          
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileJson className="w-5 h-5 text-primary" />
          Open Execution Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hash Lookup */}
        <div className="space-y-2">
          <Label htmlFor="hash-input" className="text-sm font-medium">
            Open by Hash
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="hash-input"
                placeholder="sha256:... or 64-char hex"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHashLookup()}
                className="pl-9 font-mono text-sm"
              />
            </div>
            <Button 
              onClick={handleHashLookup}
              disabled={isLookingUp || !hashInput.trim()}
            >
              {isLookingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Lookup</>
              )}
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* URL or Hash Fetch */}
        <div className="space-y-2">
          <Label htmlFor="url-input" className="text-sm font-medium">
            Verify by URL or Hash
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="url-input"
                placeholder="https://... or sha256:..."
                value={urlInput}
                onChange={(e) => handleUrlInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
                className="pl-9 text-sm font-mono"
              />
            </div>
            <Button 
              onClick={handleUrlFetch}
              disabled={isFetching || !urlInput.trim()}
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Fetch</>
              )}
            </Button>
          </div>
          
          {/* URL Preview for hash input */}
          {urlPreview && (
            <div className="p-2 rounded-md bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Will fetch from:</p>
              <p className="text-xs font-mono text-foreground break-all">{urlPreview}</p>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="bundle-upload" className="text-sm font-medium">
            Upload Bundle (.json)
          </Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isUploading}
              className="flex-1 relative"
              asChild
            >
              <label htmlFor="bundle-upload" className="cursor-pointer justify-center">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Select JSON file
                <input
                  id="bundle-upload"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            {fetchDetails && (
              <div className="text-xs text-muted-foreground font-mono space-y-1 pl-6">
                {fetchDetails.requestId && (
                  <p>Request ID: {fetchDetails.requestId}</p>
                )}
                {fetchDetails.upstreamStatus && (
                  <p>Upstream Status: {fetchDetails.upstreamStatus}</p>
                )}
                {fetchDetails.fetchedFrom && (
                  <p className="break-all">Fetched From: {fetchDetails.fetchedFrom}</p>
                )}
                {fetchDetails.suggestion && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                    <p className="font-medium text-foreground mb-1">💡 Suggestion:</p>
                    <p>{fetchDetails.suggestion}</p>
                    {fetchDetails.errorCode === 'AUTH_REDIRECT' && (
                      <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Use a public endpoint like <code className="bg-background px-1 rounded">/api/public/certificates/:hash</code></li>
                        <li>Or fetch from Supabase REST: <code className="bg-background px-1 rounded">*.supabase.co/rest/v1/...</code></li>
                      </ul>
                    )}
                  </div>
                )}
                {fetchDetails.bodyPreview && !fetchDetails.suggestion && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Response preview
                    </summary>
                    <pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {fetchDetails.bodyPreview}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
