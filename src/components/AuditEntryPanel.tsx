/**
 * Audit Entry Panel — Clean verifier input for NexArt Verification Portal.
 * Three focused actions: Verify by Execution ID, Verify by Certificate Hash, Upload CER Bundle.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Upload,
  Loader2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Hash,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAuditRecordByHash,
  fetchBundleFromUrl,
  parseBundleJson,
  importAuditRecord,
  looksLikeHash,
} from '@/api/auditRecords';
import { computeCertificateHash } from '@/lib/canonicalize';
import { normalizeHash } from '@/lib/hashResolver';
import type { CERBundle } from '@/types/auditRecord';

interface AuditEntryPanelProps {
  onRecordFound?: (hash: string) => void;
  compact?: boolean;
}

export function AuditEntryPanel({ onRecordFound, compact = false }: AuditEntryPanelProps) {
  const navigate = useNavigate();

  // Execution ID state
  const [executionIdInput, setExecutionIdInput] = useState('');
  const [isLookingUpExecution, setIsLookingUpExecution] = useState(false);

  // Certificate Hash state
  const [hashInput, setHashInput] = useState('');
  const [isLookingUpHash, setIsLookingUpHash] = useState(false);

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

  const handleExecutionIdLookup = async () => {
    const trimmed = executionIdInput.trim();
    if (!trimmed) return;

    setError(null);
    // Navigate to /e/:executionId for stateless public verification
    navigate(`/e/${encodeURIComponent(trimmed)}`);
  };

  const handleHashLookup = async () => {
    const trimmed = hashInput.trim();
    if (!trimmed) return;

    setIsLookingUpHash(true);
    setError(null);

    // If it looks like a hash, navigate to /c/ for stateless public verification
    if (looksLikeHash(trimmed)) {
      navigate(`/c/${encodeURIComponent(trimmed)}`);
      setIsLookingUpHash(false);
      return;
    }

    // Otherwise try as a URL
    try {
      new URL(trimmed);
      // It's a URL — fetch via proxy and import
      const result = await fetchBundleFromUrl(trimmed);

      if (!result.success || !result.bundle) {
        setError(result.error || 'Failed to fetch bundle');
        setIsLookingUpHash(false);
        return;
      }

      const certificateHash = await computeCertificateHash(result.bundle);
      const existing = await getAuditRecordByHash(certificateHash);
      if (existing) {
        toast.success('Record found');
        navigateToAudit(certificateHash);
        setIsLookingUpHash(false);
        return;
      }

      const importResult = await importAuditRecord(result.bundle, 'url', result.wrapperMetadata);
      if (!importResult.success) {
        setError(importResult.error || 'Import failed');
        setIsLookingUpHash(false);
        return;
      }

      toast.success('Bundle imported');
      if (importResult.certificateHash) {
        navigateToAudit(importResult.certificateHash);
      }
    } catch {
      setError('Invalid input. Enter a certificate hash (sha256:...) or a URL.');
    } finally {
      setIsLookingUpHash(false);
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

      const certificateHash = await computeCertificateHash(result.bundle);

      const existing = await getAuditRecordByHash(certificateHash);
      if (existing) {
        toast.success('Bundle already in registry');
        navigateToAudit(certificateHash);
        return;
      }

      const importResult = await importAuditRecord(result.bundle, 'upload');

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
      event.target.value = '';
    }
  };

  if (compact) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Execution ID or certificate hash"
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
                  disabled={isLookingUpHash || !hashInput.trim()}
                >
                  {isLookingUpHash ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="bundle-upload-compact" className="sr-only">Upload bundle</Label>
              <Button variant="outline" disabled={isUploading} className="relative" asChild>
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
          <ShieldCheck className="w-5 h-5 text-primary" />
          Verify a Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Verify by Execution ID */}
        <div className="space-y-2">
          <Label htmlFor="execution-id-input" className="text-sm font-medium">
            Verify by Execution ID
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="execution-id-input"
                placeholder="e.g. retest-certify-002"
                value={executionIdInput}
                onChange={(e) => { setExecutionIdInput(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleExecutionIdLookup()}
                className="pl-9 font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleExecutionIdLookup}
              disabled={isLookingUpExecution || !executionIdInput.trim()}
            >
              {isLookingUpExecution ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Verify</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The unique execution identifier from the certified decision record.
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Verify by Certificate Hash */}
        <div className="space-y-2">
          <Label htmlFor="hash-input" className="text-sm font-medium">
            Verify by Certificate Hash
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="hash-input"
                placeholder="sha256:d25a3557... or URL"
                value={hashInput}
                onChange={(e) => { setHashInput(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleHashLookup()}
                className="pl-9 font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleHashLookup}
              disabled={isLookingUpHash || !hashInput.trim()}
            >
              {isLookingUpHash ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Verify</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The SHA-256 certificate hash from the execution record, or a direct bundle URL.
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Upload CER Bundle */}
        <div className="space-y-2">
          <Label htmlFor="bundle-upload" className="text-sm font-medium">
            Upload CER Bundle
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
          <p className="text-xs text-muted-foreground">
            Upload a .json CER bundle file directly from your device.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
