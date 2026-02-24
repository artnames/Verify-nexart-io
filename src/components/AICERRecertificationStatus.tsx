/**
 * AI CER Recertification Status - Badge display for AI execution attestation
 * 
 * Status taxonomy (auditor-grade):
 * - Attested (green): 200 + ok:true from canonical node
 * - Attestation rejected (amber): 200 + ok:false (genuine hash mismatch)
 * - Attestation unavailable (red): non-200 / network error / timeout
 * - Not attestable (muted): missing required fields
 * - Not attested (neutral): no attempt made
 * 
 * Attestation is gated behind a user-supplied API key (sessionStorage).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ShieldOff,
  Loader2,
  ChevronDown,
  RefreshCw,
  Clock,
  Hash,
  Server,
  AlertCircle,
  Fingerprint,
  FileText,
  Info,
  Lock,
  KeyRound,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasNodeApiKey, getNodeApiKey, setNodeApiKey } from '@/storage/nodeApiKey';
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
  /** Paths where undefined was found (client preflight) */
  undefinedPaths?: string[];
  /** Sanitized payload sent (or that would be sent) to the node */
  sanitizedPayload?: unknown;
}

interface AICERRecertificationStatusProps {
  result?: AICERRecertifyResponse | null;
  latestRun?: RecertificationRun | null;
  isLoading?: boolean;
  onRecertify?: () => void;
  enabled?: boolean;
  /** If false, the bundle is missing required fields for attestation */
  attestable?: boolean;
  /** List of missing fields if not attestable */
  missingFields?: string[];
  /** Imported bundle already contains canonical proof */
  existingAttestationPresent?: boolean;
}

/** Map error codes to short reason chips */
function getReasonChip(errorCode?: string | null, httpStatus?: number | null, errorMsg?: string | null): string | null {
  if (errorCode === 'INVALID_PAYLOAD') return 'Invalid payload (undefined fields)';
  if ((errorCode === 'INVALID_BUNDLE' || httpStatus === 400) && errorMsg?.toLowerCase().includes('undefined')) return 'Invalid payload (undefined fields)';
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
function parseUpstreamError(body?: string | null): { code?: string; message?: string; details?: string[] } | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      return {
        code: typeof parsed.error === 'string' ? parsed.error : undefined,
        message: typeof parsed.message === 'string' ? parsed.message : undefined,
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
  attestable = true,
  missingFields = [],
  existingAttestationPresent = false,
}: AICERRecertificationStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUpstreamBody, setShowUpstreamBody] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(hasNodeApiKey());

  const status = result?.status || latestRun?.status || (existingAttestationPresent ? 'pass' : undefined);
  const attestationHash = result?.attestationHash || latestRun?.output_hash;
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
  const undefinedPaths = result?.undefinedPaths;
  const sanitizedPayload = result?.sanitizedPayload;

  const reasonChip = status === 'error' ? getReasonChip(errorCode, httpStatus, errorMessage) : null;
  const parsedError = parseUpstreamError(upstreamBody);

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      setNodeApiKey(apiKeyInput.trim());
      setHasKey(true);
      setApiKeyInput('');
    }
  };

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (!attestable) return <ShieldOff className="w-4 h-4 text-muted-foreground" />;
    if (!hasKey && !status) return <Lock className="w-4 h-4 text-muted-foreground" />;
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
    if (isLoading) return <Badge variant="outline">Requesting…</Badge>;
    if (!attestable) return <Badge variant="secondary">Not attestable</Badge>;
    if (!status) return <Badge variant="outline">Not attested</Badge>;
    switch (status) {
      case 'pass':
        return (
          <Badge className="bg-verified text-verified-foreground">
            {existingAttestationPresent ? 'Node Attested' : 'Attested'}
          </Badge>
        );
      case 'fail':
        return <Badge className="bg-warning text-warning-foreground">Attestation rejected</Badge>;
      case 'error':
        return (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Badge variant="destructive">Attestation unavailable</Badge>
            {reasonChip && (
              <Badge variant="outline" className="text-destructive border-destructive/40 text-xs">
                {reasonChip}
              </Badge>
            )}
          </div>
        );
      case 'skipped':
        return <Badge variant="secondary">Not attested</Badge>;
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
        {/* Explainer paragraph — always visible */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Canonical attestation confirms this record's hashes and certificate are internally consistent
          when checked by the NexArt canonical node. It does not re-run the model or claim the output is correct.
        </p>
        <p className="text-xs text-muted-foreground/70 leading-relaxed italic">
          Sensitive fields may be sent to the canonical node for verification; they are not stored by Recânon.
        </p>

        {/* Not attestable — missing fields */}
        {!attestable && missingFields.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-muted-foreground">Missing required fields for attestation</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
                {missingFields.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* API Key gating for anonymous users */}
        {!hasKey && attestable && !status && (
          <div className="space-y-3 p-3 rounded-md border border-border bg-muted/30">
            <div className="flex items-start gap-2 text-sm">
              <Lock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-muted-foreground">
                  Attestation requires an API key
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can still verify integrity locally. Attestation is optional and requires a key because it consumes canonical node quota.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Paste NexArt Node API key"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                  className="pl-9 text-sm font-mono"
                  type="password"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveKey}
                disabled={!apiKeyInput.trim()}
              >
                Unlock
              </Button>
            </div>
            <a
              href="https://nexart.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get an API key on nexart.io
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {status === 'pass' && (
          <p className="text-sm text-verified">
            {existingAttestationPresent
              ? 'Canonical Attestation: Present (Node Attested).'
              : "Canonical node attested to the integrity of this record."}
          </p>
        )}
        {status === 'fail' && (
          <p className="text-sm text-warning">
            Canonical node evaluated the record and detected a discrepancy. This requires review.
          </p>
        )}
        {status === 'error' && (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Canonical node could not attest this record.</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {httpStatus != null && httpStatus > 0 && <p>Upstream status: <span className="font-mono">{httpStatus}</span></p>}
                {(parsedError?.code || errorCode) && <p>Node error code: <span className="font-mono">{parsedError?.code || errorCode}</span></p>}
                {(parsedError?.message || errorMessage) && <p>Node message: {parsedError?.message || errorMessage}</p>}
                {requestId && <p>Request ID: <span className="font-mono">{requestId}</span></p>}
                {nodeRequestId && <p>Node Request ID: <span className="font-mono">{nodeRequestId}</span></p>}
              </div>

              {(() => {
                const joined = `${errorMessage || ''} ${parsedError?.message || ''} ${parsedError?.code || ''} ${upstreamBody || ''}`.toLowerCase();
                return joined.includes('undefined');
              })() && (
                <p className="text-xs text-muted-foreground mt-2">
                  Recânon attempted to send a non-JSON value (undefined) to the canonical node. This is a client serialization issue.
                </p>
              )}

              {(parsedError?.code || parsedError?.message) && (
                <div className="mt-2 p-2 bg-destructive/5 rounded border border-destructive/20 text-xs">
                  <p className="font-medium text-destructive">{parsedError?.code || 'Node error'}</p>
                  {parsedError?.message && <p className="text-muted-foreground mt-1">{parsedError.message}</p>}
                  {parsedError?.details && parsedError.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-muted-foreground list-disc list-inside">
                      {parsedError.details.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {status === 'skipped' && !result?.errorCode?.startsWith('PREFLIGHT') && (
          <p className="text-sm text-muted-foreground">
            This record has not been submitted for canonical attestation.
          </p>
        )}

        {/* Undefined paths diagnostic block */}
        {undefinedPaths && undefinedPaths.length > 0 && (
          <div className="space-y-2 p-3 rounded-md border border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-destructive">
                  Cannot attest: payload contains unsupported values (undefined).
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {undefinedPaths.length} path{undefinedPaths.length > 1 ? 's' : ''} found. The canonical node rejects payloads with undefined values.
                </p>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-2 max-h-32 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {undefinedPaths.join('\n')}
              </pre>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Undefined paths in attestation payload:\n${undefinedPaths.join('\n')}`
                );
                toast.success('Diagnostics copied');
              }}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy diagnostics
            </Button>
          </div>
        )}

        {/* Attestation Details — always available when there's data */}
        {(attestationHash || requestId || protocolVersion || httpStatus || upstreamBody) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8">
                <span className="text-xs">Attestation details</span>
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
                  <span className="text-muted-foreground">Upstream status: </span>
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
        {onRecertify && enabled && !existingAttestationPresent && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRecertify}
            disabled={isLoading || !attestable || !hasKey}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Requesting…
              </>
            ) : !attestable ? (
              <>
                <ShieldOff className="w-4 h-4 mr-2" />
                Missing required fields for attestation
              </>
            ) : !hasKey ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Provide API key to unlock attestation
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Request canonical attestation
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export type { AICERRecertifyResponse };
