/**
 * CertificationReport — Human-readable certification report.
 *
 * Composed of:
 *  1. CertificationSummary (status, type, metadata, actions)
 *  2. WhatWasCertified (tabbed: Inputs, Conditions, Outputs, Metadata)
 *  3. EvidenceSection (hashes, failure codes)
 *  4. Children slot (Node Attestation, Attestation actions, etc.)
 *  5. RawJsonViewer (collapsed)
 *
 * Does NOT change any verification logic.
 */

import { useMemo } from 'react';
import { CertificationSummary } from './CertificationSummary';
import { WhatWasCertified } from './WhatWasCertified';
import { EvidenceSection } from './EvidenceSection';
import { RawJsonViewer } from './RawJsonViewer';
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
    <div className="space-y-5">
      {/* 1. Summary */}
      <CertificationSummary summary={summary} bundleJson={bundleJson} />

      {/* 2. What was certified */}
      <WhatWasCertified
        kind={bundleKind}
        inputs={inputs}
        conditions={conditions}
        outputs={outputs}
        metadata={metadata}
      />

      {/* 3. Evidence */}
      <EvidenceSection
        evidence={evidence}
        verifyCode={verifyCode}
        verifyDetails={verifyDetails}
        verifyStatus={verifyStatus}
      />

      {/* 4. Children (Node Attestation, Attestation actions, etc.) */}
      {children}

      {/* 5. Raw JSON */}
      <RawJsonViewer bundleJson={bundleJson} />
    </div>
  );
}

export { type CertificationReportProps } from './types';
