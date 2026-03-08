/**
 * CertificationReport — Professional audit-style certification report.
 *
 * Layout (revised for enterprise-grade readability):
 *  1. Audit Summary (status + key facts, 2-col)
 *  2. Sticky mini status bar (integrity + node stamp + copy link)
 *  3. What was recorded (Input / Conditions / Output panels)
 *  4. Children slot (Independent stamp, Attestation actions, etc.)
 *  5. Technical details (accordion, visually lighter — for power users)
 *  6. Dev-only debug block
 *
 * Does NOT change any verification logic.
 */

import { useMemo } from 'react';
import { VerifyDebugBlock } from '@/components/VerifyDebugBlock';
import { ShieldCheck, AlertTriangle, Stamp, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AuditSummary } from './AuditSummary';
import { WhatWasRecorded } from './WhatWasRecorded';
import { TechnicalDetails } from './TechnicalDetails';
import {
  extractSummary,
  extractInputs,
  extractConditions,
  extractOutputs,
  extractMetadata,
  extractEvidence,
} from './extractors';
import type { CertificationReportProps } from './types';

export function CertificationReport({
  bundle,
  bundleKind,
  verifyStatus,
  verifyCode,
  verifyDetails,
  children,
}: CertificationReportProps) {
  const bundleJson = useMemo(() => JSON.stringify(bundle), [bundle]);

  const summary = useMemo(() => extractSummary(bundle, bundleKind, verifyStatus), [bundle, bundleKind, verifyStatus]);
  const inputs = useMemo(() => extractInputs(bundle, bundleKind), [bundle, bundleKind]);
  const conditions = useMemo(() => extractConditions(bundle, bundleKind), [bundle, bundleKind]);
  const outputs = useMemo(() => extractOutputs(bundle, bundleKind), [bundle, bundleKind]);
  const metadata = useMemo(() => extractMetadata(bundle, bundleKind), [bundle, bundleKind]);
  const evidence = useMemo(() => extractEvidence(bundle, bundleKind), [bundle, bundleKind]);

  const passed = verifyStatus === 'pass';

  const nodeStampLabel = summary.attestation
    ? summary.attestation.hasSignedReceipt
      ? 'Stamp verified'
      : summary.attestation.verified
        ? 'Legacy timestamp'
        : 'Present'
    : 'No stamp';

  const nodeStampColor = summary.attestation?.verified
    ? 'text-verified'
    : summary.attestation
      ? 'text-muted-foreground'
      : 'text-muted-foreground/50';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  };

  return (
    <div className="space-y-6">
      {/* 1. Audit Summary */}
      <AuditSummary
        summary={summary}
        bundleJson={bundleJson}
        verifyCode={verifyCode}
        verifyDetails={verifyDetails}
      />

      {/* 2. Sticky mini status bar — same width, compact */}
      <div className="sticky top-0 z-10 -mt-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-xs">
          {/* Integrity */}
          <div className="flex items-center gap-1.5">
            {passed ? (
              <ShieldCheck className="w-3.5 h-3.5 text-verified" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            )}
            <span className="text-muted-foreground">Record integrity:</span>
            <Badge variant={passed ? 'default' : 'destructive'} className={cn(
              "text-[10px] h-5 px-1.5",
              passed && "bg-verified text-verified-foreground"
            )}>
              {passed ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
          {/* Node stamp */}
          <div className="flex items-center gap-1.5">
            <Stamp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Node stamp:</span>
            <span className={cn("font-medium", nodeStampColor)}>{nodeStampLabel}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopyLink} className="gap-1.5 text-xs h-7 shrink-0">
          <Link2 className="w-3 h-3" />
          Copy link
        </Button>
      </div>

      {/* 3. What was recorded */}
      <WhatWasRecorded
        kind={bundleKind}
        inputs={inputs}
        conditions={conditions}
        outputs={outputs}
        metadata={metadata}
      />

      {/* 4. Children (Independent stamp, Attestation actions, etc.) */}
      {children}

      {/* 5. Technical details — bottom, visually lighter */}
      <TechnicalDetails
        evidence={evidence}
        bundleJson={bundleJson}
        verifyCode={verifyCode}
        verifyDetails={verifyDetails}
      />

    </div>
  );
}

export { type CertificationReportProps } from './types';
