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
  importAuditRecord 
} from '@/api/auditRecords';
import { computeCertificateHash } from '@/lib/canonicalize';
import { normalizeHash } from '@/api/auditRecords';

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
  
  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

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
    
    try {
      // Validate URL
      let url: URL;
      try {
        url = new URL(urlInput.trim());
      } catch {
        setError('Invalid URL format');
        setIsFetching(false);
        return;
      }
      
      // Fetch and parse bundle
      const result = await fetchBundleFromUrl(url.toString());
      
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

        {/* URL Fetch */}
        <div className="space-y-2">
          <Label htmlFor="url-input" className="text-sm font-medium">
            Verify by URL
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="url-input"
                placeholder="https://example.com/bundle.json"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
                className="pl-9 text-sm"
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
          <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
