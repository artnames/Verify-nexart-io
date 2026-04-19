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
import { ShieldCheck, AlertTriangle, ShieldAlert, Stamp, Link2 } from 'lucide-react';
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
import { ProvenanceSection, type ProvenanceInfo } from './ProvenanceSection';
import type { CertificationReportProps } from './types';

export function CertificationReport({
  bundle,
  bundleKind,
  verifyStatus,
  verifyCode,
  verifyDetails,
  contextIntegrityProtected,
  trustWarnings,
  requestedHash,
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

  // Provenance / artifact-identity detection.
  // Recognizes both legacy flag shape and the standard meta.provenance.kind === 'redacted_reseal'.
  const provenance = useMemo<ProvenanceInfo | null>(() => {
    const meta = bundle.meta as Record<string, unknown> | undefined;
    const provBlock = (meta?.provenance as Record<string, unknown> | undefined)
      || (bundle.provenance as Record<string, unknown> | undefined);
    const metaAtt = meta?.attestation as Record<string, unknown> | undefined;

    const provKind = provBlock?.kind as string | undefined;
    const attMode = metaAtt?.mode as string | undefined;
    const isReseal =
      bundle.redacted_reseal === true ||
      meta?.redacted_reseal === true ||
      provKind === 'redacted_reseal' ||
      attMode === 'redacted_reseal';

    const originalHash =
      (provBlock?.originalCertificateHash as string) ||
      (bundle.originalCertificateHash as string) ||
      (meta?.originalCertificateHash as string) ||
      undefined;

    const redactionReason =
      (provBlock?.redactionReason as string) ||
      (meta?.redactionReason as string) ||
      undefined;

    const redactionPolicy =
      (provBlock?.redactionPolicy as string) ||
      (meta?.redactionPolicy as string) ||
      undefined;

    const publicHash = (bundle.certificateHash as string) || undefined;

    // Surface section if reseal OR if requested hash differs from artifact hash.
    const requestedDiffers = !!(requestedHash && publicHash && normalizeForCompare(requestedHash) !== normalizeForCompare(publicHash));
    if (!isReseal && !requestedDiffers) return null;

    return {
      isReseal,
      publicHash,
      originalHash,
      requestedHash,
      redactionReason,
      redactionPolicy,
    };
  }, [bundle, requestedHash]);

  const passed = verifyStatus === 'pass';
  const degraded = verifyStatus === 'degraded';

  /*
   * Narrow re-framing condition: a legitimate public redacted reseal where
   *   - the artifact is a redacted reseal (provenance.kind === 'redacted_reseal'
   *     or meta.attestation.mode === 'redacted_reseal' or legacy flag),
   *   - core integrity passed (status === 'degraded', not 'fail'/'error'),
   *   - the only reason for degradation is supplemental context.signals
   *     sitting outside the certificate hash scope (CONTEXT_NOT_PROTECTED).
   *
   * In this exact case we present the result as VERIFIED with a supplemental
   * note, instead of "Partially Verified", because the public artifact's
   * envelope hash and any node stamp have both verified successfully.
   * The underlying verifyStatus / verifyCode are NOT mutated — only the UI
   * framing changes. True failures (envelope mismatch, stamp failure,
   * malformed artifact) still render the standard degraded/failure UI.
   */
  const resealCoreVerified =
    !!provenance?.isReseal &&
    degraded &&
    verifyCode === 'CONTEXT_NOT_PROTECTED';

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

  // Integrity badge logic
  const integrityLabel = passed ? 'PASS' : degraded ? 'PARTIAL' : 'FAIL';
  const integrityVariant = passed ? 'default' : degraded ? 'outline' : 'destructive';
  const IntegrityIcon = passed ? ShieldCheck : degraded ? ShieldAlert : AlertTriangle;
  const integrityIconColor = passed ? 'text-verified' : degraded ? 'text-warning' : 'text-destructive';

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
      <ExecutionSummary summary={summary} passed={passed || degraded} />

      {/* Provenance / Artifact Identity (redacted reseal, requested-vs-returned) */}
      {provenance && <ProvenanceSection info={provenance} />}

      {/* 2b. What was verified — plain-language trust explanation */}
      <WhatWasVerified summary={summary} passed={passed} degraded={degraded} verifyDetails={verifyDetails} />

      {/* 3. Sticky mini status bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-xs">
          <div className="flex items-center gap-1.5">
            <IntegrityIcon className={cn("w-3.5 h-3.5", integrityIconColor)} />
            <span className="text-muted-foreground">Integrity:</span>
            <Badge variant={integrityVariant as any} className={cn(
              "text-[10px] h-5 px-1.5",
              passed && "bg-verified text-verified-foreground",
              degraded && "border-warning text-warning bg-warning/10",
            )}>
              {integrityLabel}
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

/** Normalize a certificate hash for equality comparison only. */
function normalizeForCompare(h: string): string {
  const t = h.trim().toLowerCase();
  if (t.startsWith('sha256:')) return t;
  if (/^[a-f0-9]{64}$/.test(t)) return `sha256:${t}`;
  return t;
}

export { type CertificationReportProps } from './types';
