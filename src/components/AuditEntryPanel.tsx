/**
 * Audit Entry Panel — Clean verifier input for NexArt Verification Portal.
 * Four focused actions: Verify by Execution ID, Verify by Certificate Hash, Verify by Project Hash, Upload artifact.
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
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  parseBundleJson,
  importAuditRecord,
  looksLikeHash,
  getAuditRecordByHash,
} from '@/api/auditRecords';
import { computeCertificateHash } from '@/lib/canonicalize';
import { isAICERBundle } from '@/types/aiCerBundle';
import { isProjectBundle } from '@/types/projectBundle';
import { normalizeHash } from '@/lib/hashResolver';
import type { CERBundle } from '@/types/auditRecord';
import type { PackageEnvelopeData } from '@/types/cerPackage';

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

  // Project Hash state
  const [projectHashInput, setProjectHashInput] = useState('');

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

  /** Strip full verifier URLs down to just the execution ID */
  const sanitizeExecutionId = (raw: string): string => {
    const trimmed = raw.trim();
    // Match patterns like https://verify.nexart.io/e/<id> or .../e/<id>
    const urlMatch = trimmed.match(/\/e\/([^/?#]+)/);
    if (urlMatch) return decodeURIComponent(urlMatch[1]);
    // If it looks like a full URL but doesn't match /e/, reject
    if (/^https?:\/\//i.test(trimmed)) return '';
    return trimmed;
  };

  const handleExecutionIdLookup = async () => {
    const sanitized = sanitizeExecutionId(executionIdInput);
    if (!sanitized) {
      setError('Enter an execution ID only (e.g. retest-certify-002), not a full URL.');
      return;
    }

    setError(null);
    navigate(`/e/${encodeURIComponent(sanitized)}`);
  };

  const handleHashLookup = async () => {
    const trimmed = hashInput.trim();
    if (!trimmed) return;

    setError(null);

    if (looksLikeHash(trimmed)) {
      navigate(`/c/${encodeURIComponent(trimmed)}`);
      return;
    }

    setError('Enter a valid certificate hash (e.g. sha256:d25a3557...).');
  };

  const handleProjectHashLookup = () => {
    const trimmed = projectHashInput.trim();
    if (!trimmed) return;
    setError(null);

    if (looksLikeHash(trimmed)) {
      navigate(`/p/${encodeURIComponent(trimmed)}`);
      return;
    }

    setError('Enter a valid project hash (e.g. sha256:abc123...).');
  };
  };

  const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reject oversized files before reading into memory
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum upload size is 10 MB.`);
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const text = await file.text();
      
      // Try to detect project bundle before standard parsing
      try {
        const rawJson = JSON.parse(text);
        if (isProjectBundle(rawJson)) {
          // Route to project bundle verification page
          navigate('/project', { state: { projectBundle: rawJson } });
          setIsUploading(false);
          return;
        }
      } catch {
        // Not valid JSON — fall through to standard parsing
      }

      const result = parseBundleJson(text);

      if (!result.success || !result.bundle) {
        setError(result.error || 'Invalid bundle file');
        setIsUploading(false);
        return;
      }

      // For AI CER bundles, use the bundle's own certificateHash (correct protected set)
      // rather than recomputing from the full bundle which would include meta/declaration
      const bundleRec = result.bundle as Record<string, unknown>;
      const certificateHash = (isAICERBundle(result.bundle) && typeof bundleRec.certificateHash === 'string')
        ? (bundleRec.certificateHash as string).replace(/^sha256:/i, '').toLowerCase()
        : await computeCertificateHash(result.bundle);

      // Always import (handles dedup internally)
      const importResult = await importAuditRecord(result.bundle, 'upload');

      if (!importResult.success && !importResult.error?.includes('already exists')) {
        setError(importResult.error || 'Import failed');
        return;
      }

      toast.success(importResult.error?.includes('already exists') ? 'Bundle already in registry' : 'Bundle imported successfully');

      // Navigate with the uploaded bundle as source of truth via router state.
      // If this was a package upload, also pass the package envelope data.
      const navHash = importResult.certificateHash || certificateHash;
      const normalizedNav = normalizeHash(navHash);
      if (normalizedNav) {
        const routerState: Record<string, unknown> = {
          uploadedBundle: result.bundle,
        };
        if (result.isPackageFormat && result.packageEnvelopeData) {
          routerState.packageEnvelopeData = result.packageEnvelopeData;
        }
        navigate(`/audit/${normalizedNav}`, { state: routerState });
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
            Enter the execution ID only, not the full verify.nexart.io link.
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
                placeholder="sha256:d25a3557..."
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
            The SHA-256 certificate hash from the certified execution record.
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

        {/* Verify by Project Hash */}
        <div className="space-y-2">
          <Label htmlFor="project-hash-input" className="text-sm font-medium">
            Verify by Project Hash
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="project-hash-input"
                placeholder="sha256:abc123..."
                value={projectHashInput}
                onChange={(e) => { setProjectHashInput(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleProjectHashLookup()}
                className="pl-9 font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleProjectHashLookup}
              disabled={!projectHashInput.trim()}
            >
              Verify
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The SHA-256 project hash identifying a full Project Bundle with multiple certified steps.
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
            Upload Project Bundle, CER Bundle, or AI CER Package
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
            Upload a .json Project Bundle, CER bundle, or AI CER package from your device.
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
