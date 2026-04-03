/**
 * ExecutionSummary — human-readable top-level summary for reviewers.
 * Shows record type, source, provider/model, timestamp, and trust status
 * in a scannable format. Only displays fields actually present in the record.
 */

import { FileText, Building2, Cpu, Calendar, ShieldCheck, Stamp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CertSummary } from './types';

interface Props {
  summary: CertSummary;
  passed: boolean;
}

function SummaryItem({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("text-sm text-foreground truncate", mono && "font-mono text-xs")}>{value}</p>
      </div>
    </div>
  );
}

export function ExecutionSummary({ summary, passed }: Props) {
  const isAI = summary.certType === 'AI Execution Record';

  // Build model display string
  const modelDisplay = [summary.provider, summary.model].filter(Boolean).join(' / ') || null;

  // Timestamp
  const timestamp = summary.issuedAt
    ? new Date(summary.issuedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  // Stamp label
  const stampLabel = summary.attestation
    ? summary.attestation.hasSignedReceipt
      ? 'Signed receipt verified'
      : summary.attestation.verified
        ? 'Legacy timestamp'
        : 'Metadata present'
    : 'No attestation';

  const stampOk = summary.attestation?.hasSignedReceipt || summary.attestation?.verified;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/5 px-5 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Execution Summary
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
        <SummaryItem icon={FileText} label="Record type" value={summary.certType} />
        {summary.application && (
          <SummaryItem icon={Building2} label="Application" value={summary.application} />
        )}
        {isAI && modelDisplay && (
          <SummaryItem icon={Cpu} label="Provider / Model" value={modelDisplay} />
        )}
        {timestamp && (
          <SummaryItem icon={Calendar} label="Recorded" value={timestamp} />
        )}
        <div className="flex items-start gap-2.5 min-w-0">
          {passed ? (
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-verified" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Integrity</p>
            <p className={cn("text-sm font-medium", passed ? "text-verified" : "text-destructive")}>
              {passed ? 'Passed' : 'Failed'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 min-w-0">
          <Stamp className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Node stamp</p>
            <p className={cn("text-sm", stampOk ? "text-verified font-medium" : "text-muted-foreground")}>
              {stampLabel}
            </p>
          </div>
        </div>
        {isAI && summary.executionId && (
          <SummaryItem icon={FileText} label="Execution ID" value={summary.executionId} mono />
        )}
        {summary.source && (
          <SummaryItem icon={Building2} label="Source" value={summary.source} />
        )}
      </div>
    </div>
  );
}
