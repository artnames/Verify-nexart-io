/**
 * AI CER Recertification Status - Badge display for AI execution attestation
 * 
 * Uses auditor-grade language matching the existing RecertificationStatus patterns.
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
}

interface AICERRecertificationStatusProps {
  result?: AICERRecertifyResponse | null;
  latestRun?: RecertificationRun | null;
  isLoading?: boolean;
  onRecertify?: () => void;
  enabled?: boolean;
}

export function AICERRecertificationStatus({
  result,
  latestRun,
  isLoading,
  onRecertify,
  enabled = true,
}: AICERRecertificationStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (!status) return <Shield className="w-4 h-4 text-muted-foreground" />;
    switch (status) {
      case 'pass': return <ShieldCheck className="w-4 h-4 text-verified" />;
      case 'fail': return <ShieldX className="w-4 h-4 text-destructive" />;
      case 'error': return <ShieldAlert className="w-4 h-4 text-warning" />;
      case 'skipped': return <Shield className="w-4 h-4 text-muted-foreground" />;
      default: return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    if (isLoading) return <Badge variant="outline">Requesting attestation...</Badge>;
    if (!status) return <Badge variant="outline">Not Attested</Badge>;
    switch (status) {
      case 'pass': return <Badge className="bg-verified text-verified-foreground">Attested</Badge>;
      case 'fail': return <Badge variant="destructive">Attestation Mismatch</Badge>;
      case 'error': return <Badge className="bg-warning text-warning-foreground">Attestation Failed</Badge>;
      case 'skipped': return <Badge variant="secondary">Not Attested</Badge>;
    }
  };

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
            <span>Canonical Attestation</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'pass' && (
          <p className="text-sm text-verified">
            The AI execution record was independently validated by the canonical attestation node. 
            The certificate hash and snapshot integrity have been confirmed.
          </p>
        )}
        {status === 'fail' && (
          <p className="text-sm text-destructive">
            The attestation node could not confirm the integrity of this record. 
            A discrepancy was detected between the submitted certificate and the canonical validation. This requires review.
          </p>
        )}
        {status === 'error' && (
          <div className="flex items-start gap-2 text-sm text-warning">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Attestation Failed</p>
              <p className="text-muted-foreground">
                The record could not be attested due to a verification error. No confirmation could be established.
              </p>
              {errorCode && <p className="text-xs text-muted-foreground mt-1">Reference: {errorCode}</p>}
            </div>
          </div>
        )}
        {status === 'skipped' && (
          <p className="text-sm text-muted-foreground">
            This record was reviewed as provided and has not been submitted for canonical attestation.
            {errorMessage && ` (${errorMessage})`}
          </p>
        )}

        {/* Details */}
        {(attestationHash || requestId || protocolVersion) && (
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
              {httpStatus && status !== 'pass' && (
                <div className="flex items-center gap-2 text-xs">
                  <AlertCircle className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Upstream Status: </span>
                  <span className="font-mono">{httpStatus}</span>
                </div>
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
