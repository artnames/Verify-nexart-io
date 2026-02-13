/**
 * AI CER Recertification Status - Badge display for AI execution attestation
 * 
 * Status taxonomy:
 * - Attested (green): 200 + ok:true from canonical node
 * - Attestation Mismatch (amber): 200 + ok:false (genuine hash mismatch)
 * - Attestation Failed (red): non-200 / network error / timeout
 * - Not Attested (neutral): no attempt made
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Fingerprint,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecertificationRun } from '@/api/recertification';

interface AICERRecertifyResponse {
  ok: boolean;
  status: 'pass' | 'fail' | 'error' | 'skipped';
  attestationHash?: string;
  canonicalRuntimeHash?: string;
  canonicalProtocolVersion?: string;
  requestId?: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  httpStatus?: number;
  upstreamBody?: string;
  nodeRequestId?: string;
}

interface AICERRecertificationStatusProps {
  result?: AICERRecertifyResponse | null;
  latestRun?: RecertificationRun | null;
  isLoading?: boolean;
  onRecertify?: () => void;
  enabled?: boolean;
}

/** Map error codes to short reason chips */
function getReasonChip(errorCode?: string | null, httpStatus?: number | null): string | null {
  if (errorCode === 'INVALID_BUNDLE' || httpStatus === 400) return 'Invalid bundle';
  if (errorCode === 'UNAUTHORIZED' || httpStatus === 401 || httpStatus === 403) return 'Unauthorized';
  if (errorCode === 'QUOTA_EXCEEDED' || httpStatus === 429) return 'Quota exceeded';
  if (errorCode === 'NODE_ERROR' || (httpStatus && httpStatus >= 500)) return 'Node error';
  if (errorCode === 'TIMEOUT') return 'Network/timeout';
  if (errorCode === 'NETWORK_ERROR') return 'Network/timeout';
  if (errorCode === 'INVALID_RESPONSE') return 'Invalid response';
  return null;
}

/** Try to parse upstream body as structured error */
function parseUpstreamError(body?: string | null): { error?: string; details?: string[] } | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      return {
        error: parsed.error || parsed.message || undefined,
        details: Array.isArray(parsed.details) ? parsed.details.map(String) : undefined,
      };
    }
  } catch {
    // Not JSON
  }
  return null;
}

export function AICERRecertificationStatus({
  result,
  latestRun,
  isLoading,
  onRecertify,
  enabled = true,
}: AICERRecertificationStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUpstreamBody, setShowUpstreamBody] = useState(false);

  const status = result?.status || latestRun?.status;
  const attestationHash = result?.attestationHash;
  const runtimeHash = result?.canonicalRuntimeHash || latestRun?.runtime_hash;
  const protocolVersion = result?.canonicalProtocolVersion || latestRun?.protocol_version;
  const requestId = result?.requestId || latestRun?.request_fingerprint;
  const errorCode = result?.errorCode || latestRun?.error_code;
  const errorMessage = result?.errorMessage || latestRun?.error_message;
  const durationMs = result?.durationMs || latestRun?.duration_ms;
  const httpStatus = result?.httpStatus || latestRun?.http_status;
  const createdAt = latestRun?.created_at;
  const upstreamBody = result?.upstreamBody || latestRun?.upstream_body;
  const nodeRequestId = result?.nodeRequestId || latestRun?.node_request_id;

  const reasonChip = status === 'error' ? getReasonChip(errorCode, httpStatus) : null;
  const parsedError = parseUpstreamError(upstreamBody);

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (!status) return <Shield className="w-4 h-4 text-muted-foreground" />;
    switch (status) {
      case 'pass': return <ShieldCheck className="w-4 h-4 text-verified" />;
      case 'fail': return <ShieldX className="w-4 h-4 text-warning" />;
      case 'error': return <ShieldAlert className="w-4 h-4 text-destructive" />;
      case 'skipped': return <Shield className="w-4 h-4 text-muted-foreground" />;
      default: return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    if (isLoading) return <Badge variant="outline">Requesting attestation...</Badge>;
    if (!status) return <Badge variant="outline">Not Attested</Badge>;
    switch (status) {
      case 'pass':
        return <Badge className="bg-verified text-verified-foreground">Attested</Badge>;
      case 'fail':
        return <Badge className="bg-warning text-warning-foreground">Attestation Mismatch</Badge>;
      case 'error':
        return (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Badge variant="destructive">Attestation Failed</Badge>
            {reasonChip && (
              <Badge variant="outline" className="text-destructive border-destructive/40 text-xs">
                {reasonChip}
              </Badge>
            )}
          </div>
        );
      case 'skipped':
        return <Badge variant="secondary">Not Attested</Badge>;
    }
  };

  return (
    <Card className={cn(
      "border",
      status === 'pass' && "border-verified/30 bg-verified/5",
      status === 'fail' && "border-warning/30 bg-warning/5",
      status === 'error' && "border-destructive/30 bg-destructive/5",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span>Canonical Attestation</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'pass' && (
          <p className="text-sm text-verified">
            Canonical node attested to the integrity of this record.
            The certificate hash and snapshot integrity have been confirmed.
          </p>
        )}
        {status === 'fail' && (
          <p className="text-sm text-warning">
            Canonical node evaluated the record and detected a discrepancy.
            The resulting output does not match the original certified result. This requires review.
          </p>
        )}
        {status === 'error' && (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Canonical attestation could not be completed</p>
              <p className="text-muted-foreground mt-1">
                {errorMessage || 'Review details below for more information.'}
              </p>

              {/* Structured upstream error */}
              {parsedError?.error && (
                <div className="mt-2 p-2 bg-destructive/5 rounded border border-destructive/20 text-xs">
                  <p className="font-medium text-destructive">{parsedError.error}</p>
                  {parsedError.details && parsedError.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-muted-foreground list-disc list-inside">
                      {parsedError.details.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {status === 'skipped' && (
          <p className="text-sm text-muted-foreground">
            This record was reviewed as provided and has not been submitted for canonical attestation.
            {errorMessage && ` (${errorMessage})`}
          </p>
        )}

        {/* Attestation Details — always available when there's data */}
        {(attestationHash || requestId || protocolVersion || httpStatus || upstreamBody) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8">
                <span className="text-xs">Attestation Details</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {attestationHash && (
                <div className="flex items-start gap-2 text-xs">
                  <Fingerprint className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Attestation Hash: </span>
                    <code className="font-mono text-verified break-all">
                      {attestationHash.length > 24 ? `${attestationHash.slice(0, 12)}...${attestationHash.slice(-12)}` : attestationHash}
                    </code>
                  </div>
                </div>
              )}
              {requestId && (
                <div className="flex items-start gap-2 text-xs">
                  <Server className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Request ID: </span>
                    <code className="font-mono text-foreground break-all">{requestId}</code>
                  </div>
                </div>
              )}
              {nodeRequestId && nodeRequestId !== requestId && (
                <div className="flex items-start gap-2 text-xs">
                  <Server className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Node Request ID: </span>
                    <code className="font-mono text-foreground break-all">{nodeRequestId}</code>
                  </div>
                </div>
              )}
              {protocolVersion && (
                <div className="flex items-center gap-2 text-xs">
                  <Server className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Protocol: </span>
                  <span className="font-mono">{protocolVersion}</span>
                </div>
              )}
              {runtimeHash && (
                <div className="flex items-start gap-2 text-xs">
                  <Hash className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">Runtime: </span>
                    <code className="font-mono text-foreground break-all">
                      {runtimeHash.length > 20 ? `${runtimeHash.slice(0, 10)}...${runtimeHash.slice(-10)}` : runtimeHash}
                    </code>
                  </div>
                </div>
              )}
              {durationMs != null && (
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
              {httpStatus != null && httpStatus > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <AlertCircle className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Upstream Status: </span>
                  <span className="font-mono">{httpStatus}</span>
                </div>
              )}

              {/* Upstream response body — collapsible */}
              {upstreamBody && (
                <Collapsible open={showUpstreamBody} onOpenChange={setShowUpstreamBody}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3" />
                        View node response
                      </span>
                      <ChevronDown className={cn("w-3 h-3 transition-transform", showUpstreamBody && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="bg-muted rounded-lg p-3 max-h-48 overflow-auto mt-1">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                        {upstreamBody}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action button */}
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
                Requesting attestation...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {status ? 'Request Attestation Again' : 'Request Canonical Attestation'}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export type { AICERRecertifyResponse };
