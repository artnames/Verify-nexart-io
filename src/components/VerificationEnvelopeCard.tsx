/**
 * VerificationEnvelopeCard — Highest-trust verification layer.
 *
 * Shows the status of the signed verification envelope that covers
 * the full authoritative display surface of an AI CER bundle.
 *
 * Supports v1 (legacy summary) and v2 (full-bundle) envelope types.
 */

import { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, Loader2, Info, ChevronDown, FileCheck2,
  AlertTriangle, Ban,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';
import {
  verifyVerificationEnvelope,
  getEnvelopeCoveredFields,
  type VerificationEnvelopeResult,
  type EnvelopeType,
} from '@/lib/verifyEnvelope';

interface VerificationEnvelopeCardProps {
  bundle: unknown;
  nodeUrl?: string;
  className?: string;
}

const ENVELOPE_TYPE_LABELS: Record<EnvelopeType, string> = {
  v1: 'Legacy Summary',
  v2: 'Full Bundle',
};

const STATUS_ICON_MAP = {
  valid: ShieldCheck,
  invalid: ShieldAlert,
  error: AlertTriangle,
  unsupported: Ban,
  absent: Info,
} as const;

export function VerificationEnvelopeCard({
  bundle,
  nodeUrl,
  className,
}: VerificationEnvelopeCardProps) {
  const [result, setResult] = useState<VerificationEnvelopeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCovered, setShowCovered] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    verifyVerificationEnvelope(bundle, nodeUrl).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [bundle, nodeUrl]);

  if (loading) {
    return (
      <Card className={cn('border', className)}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying envelope…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result || result.status === 'absent') return null;

  const isValid = result.status === 'valid';
  const isFail = result.status === 'invalid' || result.status === 'error' || result.status === 'unsupported';
  const envelopeType = result.envelopeType || 'v1';
  const isV2 = envelopeType === 'v2';

  const coveredFields = result.envelope
    ? getEnvelopeCoveredFields(result.envelope, envelopeType)
    : [];

  const StatusIcon = STATUS_ICON_MAP[result.status] || Info;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Verification Envelope</h3>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] h-5 px-1.5',
            isV2 ? 'border-primary/40 text-primary' : 'border-muted-foreground/30 text-muted-foreground',
          )}
        >
          {ENVELOPE_TYPE_LABELS[envelopeType]}
        </Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[320px] text-xs">
              {isV2
                ? 'The full-bundle verification envelope signs the exact canonical CER bundle payload (excluding only self-referential/runtime fields). PASS means the live uploaded bundle reconstructs to the exact payload signed by the node.'
                : 'This legacy envelope covers only a limited signed summary, not the full bundle. It provides partial tamper detection for selected metadata fields.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card className={cn(
        'border',
        isValid && 'border-verified/30',
        isFail && 'border-destructive/30',
      )}>
        <CardContent className="pt-4 pb-4 space-y-3">
          {/* Status row */}
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              isValid && 'bg-verified/10',
              isFail && 'bg-destructive/10',
            )}>
              <StatusIcon className={cn(
                'w-4 h-4',
                isValid ? 'text-verified' : 'text-destructive',
              )} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-sm font-medium',
                  isValid ? 'text-verified' : 'text-destructive',
                )}>
                  {statusTitle(result)}
                </p>
                <Badge
                  variant={isValid ? 'default' : 'destructive'}
                  className={cn(
                    'text-[10px] h-5 px-1.5',
                    isValid && 'bg-verified text-verified-foreground',
                  )}
                >
                  {isValid ? 'PASS' : result.status === 'error' ? 'ERROR' : 'FAIL'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.detail}
              </p>
            </div>
          </div>

          {/* Metadata table */}
          <div className="text-xs space-y-1">
            <MetaRow label="Envelope type" value={isV2 ? 'v2 · Full Bundle' : 'v1 · Legacy Summary'} />
            <MetaRow label="Scope" value={isV2 ? 'Full canonical CER bundle payload' : 'Signed summary subset'} />
            {result.algorithm && <MetaRow label="Algorithm" value={result.algorithm} />}
            <MetaRow label="Canonicalization" value={isV2 ? 'JCS / RFC 8785' : 'JSON sorted-keys'} />
            {result.kid && <MetaRow label="Key ID" value={result.kid} mono />}
            {result.errorKind && <MetaRow label="Error type" value={result.errorKind} />}
          </div>

          {/* Excluded fields (v2) */}
          {isV2 && result.excludedFields && result.excludedFields.length > 0 && (
            <Collapsible open={showExcluded} onOpenChange={setShowExcluded}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Ban className="w-3 h-3" />
                <span>Excluded fields ({result.excludedFields.length})</span>
                <ChevronDown className={cn(
                  'w-3 h-3 transition-transform ml-1',
                  showExcluded && 'rotate-180',
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 text-xs font-mono bg-muted/20 p-3 rounded-md border border-border space-y-0.5">
                {result.excludedFields.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="text-muted-foreground">–</span>
                    <span className="text-muted-foreground">{field}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Covered fields */}
          {coveredFields.length > 0 && (
            <Collapsible open={showCovered} onOpenChange={setShowCovered}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <FileCheck2 className="w-3 h-3" />
                <span>Covered fields ({coveredFields.length})</span>
                <ChevronDown className={cn(
                  'w-3 h-3 transition-transform ml-1',
                  showCovered && 'rotate-180',
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 text-xs font-mono bg-muted/20 p-3 rounded-md border border-border space-y-0.5">
                {coveredFields.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="text-verified">✓</span>
                    <span className="text-muted-foreground">{field}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="shrink-0">{label}:</span>
      <span className={cn('break-all', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  );
}

function statusTitle(result: VerificationEnvelopeResult): string {
  const isV2 = result.envelopeType === 'v2';
  switch (result.status) {
    case 'valid':
      return isV2 ? 'Full bundle envelope verified' : 'Legacy envelope verified';
    case 'invalid':
      return isV2 ? 'Full bundle envelope invalid' : 'Legacy envelope invalid';
    case 'error':
      return 'Envelope check failed';
    case 'unsupported':
      return 'Unsupported envelope type';
    default:
      return 'Envelope status unknown';
  }
}
