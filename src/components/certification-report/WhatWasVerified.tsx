/**
 * WhatWasVerified — plain-language trust result explanation for non-technical reviewers.
 * Handles three states: full pass, degraded (context not protected), and fail (hidden).
 * Does not change any verification semantics.
 */

import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CertSummary } from './types';

interface Props {
  summary: CertSummary;
  passed: boolean;
  degraded?: boolean;
  verifyDetails?: string[];
  /**
   * When true, renders the legitimate-public-reseal variant: green/verified
   * styling with an informational note that supplemental context signals
   * are present but outside the artifact's certificate hash scope.
   * Only set by the parent for the exact narrow condition (reseal + degraded
   * + CONTEXT_NOT_PROTECTED). Underlying verification semantics unchanged.
   */
  coreVerifiedReseal?: boolean;
}

export function WhatWasVerified({ summary, passed, degraded, verifyDetails, coreVerifiedReseal }: Props) {
  if (!passed && !degraded) return null;

  const hasStamp = summary.attestation?.hasSignedReceipt || summary.attestation?.verified;

  // Degraded state: core integrity passed but context is NOT protected
  if (degraded) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 px-5 py-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-warning">
          Partially verified — context not protected
        </h2>
        <ul className="space-y-2">
          <VerifiedLine
            icon="check"
            text="Core record integrity passed. The snapshot, bundle type, version, and timestamp match the certificate hash."
          />
          <VerifiedLine
            icon="warning"
            text="Context or signals data is present in this record but is NOT covered by the certificate hash."
          />
          <VerifiedLine
            icon="warning"
            text="Context data may have been added, modified, or replaced after certification. It cannot be independently verified."
          />
          {hasStamp && (
            <VerifiedLine
              icon="check"
              text="A node attestation receipt or signature was checked and confirmed valid."
            />
          )}
        </ul>
        {verifyDetails && verifyDetails.length > 0 && (
          <div className="border-t border-warning/20 pt-2 mt-2 space-y-1">
            {verifyDetails.map((d, i) => (
              <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{d}</p>
            ))}
          </div>
        )}
        <div className="flex items-start gap-2 pt-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            This does not necessarily indicate tampering. Some resealed or redacted artifacts intentionally exclude context from the hash scope. However, reviewers should not treat context data in this record as integrity-protected.
          </p>
        </div>
      </div>
    );
  }

  // Full pass
  return (
    <div className="rounded-lg border border-verified/15 bg-verified/5 px-5 py-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-verified">
        What was verified
      </h2>
      <ul className="space-y-2">
        <VerifiedLine icon="check" text="The record has not been altered since certification. The certificate hash matches the canonical bundle content." />
        {hasStamp && (
          <VerifiedLine icon="check" text="A node attestation receipt or signature was checked and confirmed valid." />
        )}
        <VerifiedLine icon="check" text="All recorded fields, including input hashes, output hashes, and execution parameters, are consistent with the certified snapshot." />
      </ul>
      <div className="flex items-start gap-2 pt-1">
        <Info className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Verification confirms record integrity and consistency. It does not confirm the correctness of the model's output or the truthfulness of the recorded content.
        </p>
      </div>
    </div>
  );
}

function VerifiedLine({ text, icon = 'check' }: { text: string; icon?: 'check' | 'warning' }) {
  return (
    <li className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
      {icon === 'check' ? (
        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-verified" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-warning" />
      )}
      <span>{text}</span>
    </li>
  );
}
