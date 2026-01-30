/**
 * RecertificationStatus - Display component for canonical re-certification results
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  ShieldAlert,
  Loader2,
  ChevronDown,
  RefreshCw,
  Clock,
  Hash,
  Server,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecertifyResponse, RecertificationRun } from '@/api/recertification';

interface RecertificationStatusProps {
  /** Current recertification result (from API call) */
  result?: RecertifyResponse | null;
  /** Latest stored run (from database) */
  latestRun?: RecertificationRun | null;
  /** Whether recertification is in progress */
  isLoading?: boolean;
  /** Callback to trigger recertification */
  onRecertify?: () => void;
  /** Whether recertification is enabled */
  enabled?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function RecertificationStatus({
  result,
  latestRun,
  isLoading,
  onRecertify,
  enabled = true,
  compact = false,
}: RecertificationStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use result if available, otherwise fall back to latestRun
  const status = result?.status || latestRun?.status;
  const outputHash = result?.outputHash || latestRun?.output_hash;
  const expectedHash = result?.expectedHash || latestRun?.expected_hash;
  const protocolVersion = result?.protocolVersion || latestRun?.protocol_version;
  const protocolDefaulted = result?.protocolDefaulted || latestRun?.protocol_defaulted;
  const runtimeHash = result?.runtimeHash || latestRun?.runtime_hash;
  const errorCode = result?.errorCode || latestRun?.error_code;
  const errorMessage = result?.errorMessage || result?.message || latestRun?.error_message;
  const durationMs = result?.durationMs || latestRun?.duration_ms;
  const httpStatus = result?.httpStatus || latestRun?.http_status;
  const requestFingerprint = result?.requestFingerprint || latestRun?.request_fingerprint;
  const createdAt = latestRun?.created_at;

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (!status) return <Shield className="w-4 h-4 text-muted-foreground" />;
    
    switch (status) {
      case 'pass':
        return <ShieldCheck className="w-4 h-4 text-verified" />;
      case 'fail':
        return <ShieldX className="w-4 h-4 text-destructive" />;
      case 'error':
        return <ShieldAlert className="w-4 h-4 text-warning" />;
      case 'skipped':
        return <Shield className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="outline">Verifying...</Badge>;
    }
    if (!status) {
      return <Badge variant="outline">Not Re-Certified</Badge>;
    }

    switch (status) {
      case 'pass':
        return <Badge className="bg-verified text-verified-foreground">Re-Certified</Badge>;
      case 'fail':
        return <Badge variant="destructive">Mismatch Detected</Badge>;
      case 'error':
        return <Badge className="bg-warning text-warning-foreground">Re-Certification Failed</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Not Re-Certified</Badge>;
    }
  };

  const getCompactStatusLabel = () => {
    if (isLoading) return 'Verifying...';
    if (!status) return 'Not Re-Certified';
    switch (status) {
      case 'pass': return 'Re-Certified';
      case 'fail': return 'Mismatch Detected';
      case 'error': return 'Re-Certification Failed';
      case 'skipped': return 'Not Re-Certified';
      default: return 'Not Re-Certified';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm">
          {getCompactStatusLabel()}
        </span>
        {onRecertify && enabled && !isLoading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRecertify}
            className="h-6 px-2"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn(
      "border",
      status === 'pass' && "border-verified/30 bg-verified/5",
      status === 'fail' && "border-destructive/30 bg-destructive/5",
      status === 'error' && "border-warning/30 bg-warning/5",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span>Canonical Re-Certification</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status explanation - auditor-friendly language */}
        {status === 'pass' && (
          <p className="text-sm text-verified">
            The execution was independently reproduced by the NexArt Canonical Renderer. The computed output matches the original certified result.
          </p>
        )}
        {status === 'fail' && (
          <p className="text-sm text-destructive">
            The execution was reproduced, but the resulting output does not match the original certified result. This indicates a discrepancy that requires review.
          </p>
        )}
        {status === 'error' && (
          <div className="flex items-start gap-2 text-sm text-warning">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Re-Certification Failed</p>
              <p className="text-muted-foreground">
                The record could not be re-certified due to a verification error. No confirmation could be established.
              </p>
              {errorCode && <p className="text-xs text-muted-foreground mt-1">Reference: {errorCode}</p>}
            </div>
          </div>
        )}
        {status === 'skipped' && (
          <p className="text-sm text-muted-foreground">
            This record was reviewed as provided and was not independently re-certified against the Canonical Renderer.
            {errorMessage && ` (${errorMessage})`}
          </p>
        )}

        {/* Hash comparison */}
        {(outputHash || expectedHash) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8">
                <span className="text-xs">Hash Details</span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {expectedHash && (
                <div className="flex items-start gap-2 text-xs">
                  <Hash className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Expected: </span>
                    <code className="font-mono text-foreground break-all">
                      {expectedHash.length > 24 
                        ? `${expectedHash.slice(0, 12)}...${expectedHash.slice(-12)}` 
                        : expectedHash}
                    </code>
                  </div>
                </div>
              )}
              {outputHash && (
                <div className="flex items-start gap-2 text-xs">
                  <Hash className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Computed: </span>
                    <code className={cn(
                      "font-mono break-all",
                      status === 'pass' ? "text-verified" : "text-destructive"
                    )}>
                      {outputHash.length > 24 
                        ? `${outputHash.slice(0, 12)}...${outputHash.slice(-12)}` 
                        : outputHash}
                    </code>
                  </div>
                </div>
              )}
              {protocolVersion && (
                <div className="flex items-center gap-2 text-xs">
                  <Server className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Protocol: </span>
                  <span className="font-mono">
                    {protocolVersion}
                    {protocolDefaulted && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 text-warning">(defaulted)</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Protocol version was not specified; renderer used default.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                </div>
              )}
              {runtimeHash && (
                <div className="flex items-start gap-2 text-xs">
                  <Server className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Runtime: </span>
                    <code className="font-mono text-foreground break-all">
                      {runtimeHash.length > 20 
                        ? `${runtimeHash.slice(0, 10)}...${runtimeHash.slice(-10)}` 
                        : runtimeHash}
                    </code>
                  </div>
                </div>
              )}
              {durationMs && (
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Duration: </span>
                  <span>{durationMs}ms</span>
                </div>
              )}
              {createdAt && (
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Run at: </span>
                  <span>{new Date(createdAt).toLocaleString()}</span>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Re-run button */}
        {onRecertify && enabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRecertify}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {status ? 'Re-Certify Again' : 'Perform Re-Certification'}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
