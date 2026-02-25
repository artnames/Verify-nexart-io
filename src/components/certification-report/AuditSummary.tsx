/**
 * Audit Summary — professional report header card.
 * Left: status with plain-English explanation.
 * Right: key facts table.
 */

import { useState } from 'react';
import { ShieldCheck, AlertTriangle, Download, Copy, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CertSummary } from './types';

interface Props {
  summary: CertSummary;
  bundleJson: string;
  verifyCode?: string;
  verifyDetails?: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateHash(hash: string, chars = 10): string {
  if (!hash) return '—';
  if (hash.startsWith('sha256:')) return `sha256:${hash.slice(7, 7 + chars)}…`;
  return `${hash.slice(0, chars)}…`;
}

export function AuditSummary({ summary, bundleJson, verifyCode, verifyDetails }: Props) {
  const [showWhy, setShowWhy] = useState(false);

  const handleCopyHash = () => {
    if (summary.certificateHash) {
      navigator.clipboard.writeText(summary.certificateHash);
      toast.success('Certificate ID copied');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([bundleJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cer-bundle.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const passed = summary.status === 'pass';

  return (
    <Card className={cn(
      "border",
      passed ? "border-verified/30" : "border-destructive/30",
    )}>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Left: Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {passed ? (
                <div className="w-10 h-10 rounded-full bg-verified/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-verified" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
              )}
              <div>
                <h2 className={cn(
                  "text-lg font-semibold",
                  passed ? "text-verified" : "text-destructive",
                )}>
                  {passed ? 'Verified' : 'Not verified'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {passed
                    ? 'This record has not been changed since it was created.'
                    : 'Something does not match. This record may have been edited.'}
                </p>
              </div>
            </div>

            {/* Why? link for failures */}
            {!passed && verifyCode && (
              <Collapsible open={showWhy} onOpenChange={setShowWhy} className="mt-3">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showWhy && "rotate-180")} />
                  <span>Why?</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-mono text-destructive mb-1">{verifyCode}</p>
                  <p className="text-xs text-muted-foreground">
                    The verification check found a mismatch. This usually means the record was changed after it was certified.
                  </p>
                  {verifyDetails && verifyDetails.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
                      {verifyDetails.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* Right: Key facts table */}
          <div className="sm:w-72 shrink-0">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Record type</td>
                  <td className="py-1.5 text-right font-medium">{summary.certType}</td>
                </tr>
                {summary.provider && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Provider</td>
                    <td className="py-1.5 text-right font-mono text-[11px]">{summary.provider}</td>
                  </tr>
                )}
                {summary.model && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Model</td>
                    <td className="py-1.5 text-right font-mono text-[11px]">{summary.model}</td>
                  </tr>
                )}
                {summary.executionId && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Execution ID</td>
                    <td className="py-1.5 text-right font-mono text-[11px] truncate max-w-[160px]">{summary.executionId}</td>
                  </tr>
                )}
                {summary.workflowId && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Workflow</td>
                    <td className="py-1.5 text-right font-mono text-[11px] truncate max-w-[160px]">{summary.workflowId}</td>
                  </tr>
                )}
                {summary.conversationId && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Conversation</td>
                    <td className="py-1.5 text-right font-mono text-[11px] truncate max-w-[160px]">{summary.conversationId}</td>
                  </tr>
                )}
                {summary.issuedAt && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Issued</td>
                    <td className="py-1.5 text-right font-mono text-[11px]">
                      {new Date(summary.issuedAt).toLocaleString()}
                    </td>
                  </tr>
                )}
                {summary.application && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Application</td>
                    <td className="py-1.5 text-right font-mono text-[11px] truncate max-w-[160px]">{summary.application}</td>
                  </tr>
                )}
                {summary.protocolVersion && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Protocol</td>
                    <td className="py-1.5 text-right font-mono">{summary.protocolVersion}</td>
                  </tr>
                )}
                {summary.sdkVersion && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">SDK</td>
                    <td className="py-1.5 text-right font-mono">{summary.sdkVersion}</td>
                  </tr>
                )}
                {summary.certificateHash && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Certificate ID</td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={handleCopyHash}
                        className="font-mono text-[11px] text-primary hover:underline cursor-pointer"
                        title="Copy full certificate hash"
                      >
                        {truncateHash(summary.certificateHash)}
                      </button>
                    </td>
                  </tr>
                )}
                {/* Node Attestation status */}
                {summary.attestation && (
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Node attestation</td>
                    <td className="py-1.5 text-right">
                      {summary.attestation.verified ? (
                        <span className="text-verified text-[11px] font-medium">Attested</span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Present</span>
                      )}
                      {summary.attestation.hasSignedReceipt && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(signed receipt)</span>
                      )}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Size</td>
                  <td className="py-1.5 text-right">{formatBytes(summary.bundleSizeBytes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5 text-xs h-8">
            <Download className="w-3.5 h-3.5" />
            Download record
          </Button>
          {summary.certificateHash && (
            <Button variant="outline" size="sm" onClick={handleCopyHash} className="gap-1.5 text-xs h-8">
              <Copy className="w-3.5 h-3.5" />
              Copy certificate ID
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
