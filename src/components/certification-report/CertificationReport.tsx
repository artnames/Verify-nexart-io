/**
 * CertificationReport — Professional audit-style certification report.
 *
 * Layout:
 *  1. Audit Summary (status + key facts)
 *  2. What was recorded (Input / Conditions / Output panels)
 *  3. Children slot (Independent stamp, Attestation actions, etc.)
 *  4. Technical details (accordion: hashes, raw JSON)
 *
 * Does NOT change any verification logic.
 */

import { useMemo } from 'react';
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

  return (
    <div className="space-y-6">
      {/* 1. Audit Summary */}
      <AuditSummary
        summary={summary}
        bundleJson={bundleJson}
        verifyCode={verifyCode}
        verifyDetails={verifyDetails}
      />

      {/* 2. What was recorded */}
      <WhatWasRecorded
        kind={bundleKind}
        inputs={inputs}
        conditions={conditions}
        outputs={outputs}
        metadata={metadata}
      />

      {/* 3. Children (Independent stamp, Attestation actions, etc.) */}
      {children}

      {/* 4. Technical details */}
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
