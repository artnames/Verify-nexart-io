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
import { ExecutionSummary } from './ExecutionSummary';
import { WhatWasVerified } from './WhatWasVerified';
import { WhatWasRecorded } from './WhatWasRecorded';
import { TechnicalDetails } from './TechnicalDetails';
import {
  extractSummary,
  extractInputs,
  extractConditions,
  extractOutputs,
  extractMetadata,
  extractEvidence,
  extractContextSignals,
} from './extractors';
import { ContextSignalsPanel, type ContextSignal } from './ContextSignalsPanel';
import type { CertificationReportProps } from './types';

export function CertificationReport({
  bundle,
  bundleKind,
  verifyStatus,
  verifyCode,
  verifyDetails,
  contextIntegrityProtected,
  trustWarnings,
  children,
}: CertificationReportProps) {
  const bundleJson = useMemo(() => JSON.stringify(bundle), [bundle]);

  const summary = useMemo(() => extractSummary(bundle, bundleKind, verifyStatus), [bundle, bundleKind, verifyStatus]);
  const inputs = useMemo(() => extractInputs(bundle, bundleKind), [bundle, bundleKind]);
  const conditions = useMemo(() => extractConditions(bundle, bundleKind), [bundle, bundleKind]);
  const outputs = useMemo(() => extractOutputs(bundle, bundleKind), [bundle, bundleKind]);
  const metadata = useMemo(() => extractMetadata(bundle, bundleKind), [bundle, bundleKind]);
  const evidence = useMemo(() => extractEvidence(bundle, bundleKind), [bundle, bundleKind]);
  const contextSignals = useMemo(() => extractContextSignals(bundle) as ContextSignal[], [bundle]);

  // Provenance detection
  const provenance = useMemo(() => {
    const meta = bundle.meta as Record<string, unknown> | undefined;
    const isReseal = bundle.redacted_reseal === true || meta?.redacted_reseal === true;
    const originalHash = (bundle.originalCertificateHash as string)
      || (meta?.originalCertificateHash as string)
      || undefined;
    if (!isReseal && !originalHash) return null;
    return { isReseal, originalHash };
  }, [bundle]);

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
        trustWarnings={trustWarnings}
      />

      {/* 2. Execution Summary — human-readable overview */}
      <ExecutionSummary summary={summary} passed={passed} />

      {/* 2b. What was verified — plain-language trust explanation (pass only) */}
      <WhatWasVerified summary={summary} passed={passed} />

      {/* 3. Sticky mini status bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-xs">
          <div className="flex items-center gap-1.5">
            {passed ? (
              <ShieldCheck className="w-3.5 h-3.5 text-verified" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            )}
            <span className="text-muted-foreground">Integrity:</span>
            <Badge variant={passed ? 'default' : 'destructive'} className={cn(
              "text-[10px] h-5 px-1.5",
              passed && "bg-verified text-verified-foreground"
            )}>
              {passed ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Stamp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Stamp:</span>
            <span className={cn("font-medium", nodeStampColor)}>{nodeStampLabel}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopyLink} className="gap-1.5 text-xs h-7 shrink-0">
          <Link2 className="w-3 h-3" />
          Copy link
        </Button>
      </div>

      {/* 4. Attestation & trust layers (children slot) */}
      {children}

      {/* 5. Recorded evidence */}
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recorded Evidence
        </h2>
      </div>
      <WhatWasRecorded
        kind={bundleKind}
        inputs={inputs}
        conditions={conditions}
        outputs={outputs}
        metadata={metadata}
      />

      {/* Context Signals */}
      <ContextSignalsPanel signals={contextSignals} integrityProtected={contextIntegrityProtected} />

      {/* 6. Technical details — bottom, visually lighter */}
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
