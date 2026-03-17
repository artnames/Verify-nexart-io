/**
 * VerificationEnvelopeCard — Highest-trust verification layer.
 *
 * Shows the status of the signed verification envelope that covers
 * the full authoritative display surface of an AI CER bundle.
 */

import { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, Loader2, Info, ChevronDown, FileCheck2,
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
} from '@/lib/verifyEnvelope';

interface VerificationEnvelopeCardProps {
  bundle: unknown;
  nodeUrl?: string;
  className?: string;
}

export function VerificationEnvelopeCard({
  bundle,
  nodeUrl,
  className,
}: VerificationEnvelopeCardProps) {
  const [result, setResult] = useState<VerificationEnvelopeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCovered, setShowCovered] = useState(false);

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
  const isInvalid = result.status === 'invalid';
  const isError = result.status === 'error';

  const coveredFields = result.envelope
    ? getEnvelopeCoveredFields(result.envelope)
    : [];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Verification Envelope</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-xs">
              The verification envelope signs the full authoritative display surface — snapshot,
              context, attestation summary, and certificate hash — providing the highest level
              of tamper detection across all displayed fields.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card className={cn(
        'border',
        isValid && 'border-verified/30',
        (isInvalid || isError) && 'border-destructive/30',
      )}>
        <CardContent className="pt-4 pb-4 space-y-3">
          {/* Status row */}
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              isValid && 'bg-verified/10',
              (isInvalid || isError) && 'bg-destructive/10',
            )}>
              {isValid ? (
                <ShieldCheck className="w-4 h-4 text-verified" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-destructive" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-sm font-medium',
                  isValid ? 'text-verified' : 'text-destructive',
                )}>
                  {isValid
                    ? 'Envelope verified'
                    : isInvalid
                      ? 'Envelope invalid'
                      : 'Envelope check failed'}
                </p>
                <Badge
                  variant={isValid ? 'default' : 'destructive'}
                  className={cn(
                    'text-[10px] h-5 px-1.5',
                    isValid && 'bg-verified text-verified-foreground',
                  )}
                >
                  {isValid ? 'PASS' : 'FAIL'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isValid
                  ? 'The node signature covers the full display surface. All authoritative fields are tamper-protected.'
                  : result.detail}
              </p>
            </div>
          </div>

          {/* Key ID */}
          {result.kid && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileCheck2 className="w-3 h-3 shrink-0" />
              <span>kid: </span>
              <code className="font-mono text-[11px] break-all">{result.kid}</code>
            </div>
          )}

          {/* Covered fields accordion */}
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
