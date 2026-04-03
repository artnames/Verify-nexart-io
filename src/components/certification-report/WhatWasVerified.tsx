/**
 * WhatWasVerified — plain-language trust result explanation for non-technical reviewers.
 * Only shown for records that passed integrity. Does not change any verification semantics.
 */

import { CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CertSummary } from './types';

interface Props {
  summary: CertSummary;
  passed: boolean;
}

export function WhatWasVerified({ summary, passed }: Props) {
  if (!passed) return null;

  const hasStamp = summary.attestation?.hasSignedReceipt || summary.attestation?.verified;

  return (
    <div className="rounded-lg border border-verified/15 bg-verified/5 px-5 py-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-verified">
        What was verified
      </h2>
      <ul className="space-y-2">
        <VerifiedLine text="The record has not been altered since certification. The certificate hash matches the canonical bundle content." />
        {hasStamp && (
          <VerifiedLine text="A node attestation receipt or signature was checked and confirmed valid." />
        )}
        <VerifiedLine text="All recorded fields, including input hashes, output hashes, and execution parameters, are consistent with the certified snapshot." />
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

function VerifiedLine({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-verified" />
      <span>{text}</span>
    </li>
  );
}
