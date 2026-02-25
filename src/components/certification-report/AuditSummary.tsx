/**
 * Audit Summary — professional report header card.
 * Left: status with plain-English explanation.
 * Right: key facts table — ALL fields always shown, "Not provided" for missing.
 * Includes Evidence Pack download.
 */

import { useState, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, Download, Copy, ChevronDown, Package } from 'lucide-react';
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

/** Render a key-value row, always showing even if value is missing */
function FactRow({ label, value, mono = true, truncate = false, copyable = false }: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  truncate?: boolean;
  copyable?: boolean;
}) {
  const display = value !== undefined && value !== null && value !== ''
    ? String(value)
    : null;

  const handleCopy = () => {
    if (display) {
      navigator.clipboard.writeText(display);
      toast.success(`${label} copied`);
    }
  };

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap text-xs">{label}</td>
      <td className="py-1.5 text-right">
        {display ? (
          copyable ? (
            <button
              onClick={handleCopy}
              className={cn(
                "text-[11px] text-primary hover:underline cursor-pointer",
                mono && "font-mono",
                truncate && "truncate max-w-[180px] inline-block align-bottom",
              )}
              title={`Copy ${label}`}
            >
              {truncate && display.length > 24 ? truncateHash(display) : display}
            </button>
          ) : (
            <span className={cn(
              "text-[11px]",
              mono && "font-mono",
              truncate && "truncate max-w-[180px] inline-block align-bottom",
            )}>
              {display}
            </span>
          )
        ) : (
          <span className="text-[11px] text-muted-foreground/50 italic">Not provided</span>
        )}
      </td>
    </tr>
  );
}

const NODE_URL = 'https://node.nexart.io';

export function AuditSummary({ summary, bundleJson, verifyCode, verifyDetails }: Props) {
  const [showWhy, setShowWhy] = useState(false);
  const [downloadingPack, setDownloadingPack] = useState(false);

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

  const handleDownloadEvidencePack = useCallback(async () => {
    setDownloadingPack(true);
    try {
      const bundle = JSON.parse(bundleJson);

      // Fetch node keys
      let nodeKeys: unknown = null;
      try {
        const res = await fetch(`${NODE_URL}/.well-known/nexart-node.json`);
        if (res.ok) nodeKeys = await res.json();
      } catch { /* node keys unavailable */ }

      // Extract receipt + signature if present
      const att = bundle.attestation && typeof bundle.attestation === 'object' ? bundle.attestation : null;
      let receipt: unknown = null;
      let signature: string | null = null;
      let attestorKeyId: string | null = null;

      if (att) {
        receipt = att.receipt || null;
        signature = att.signature || att.signatureB64Url || null;
        attestorKeyId = att.attestorKeyId || att.kid || null;
      }
      // Also check top-level
      if (!receipt && bundle.receipt) receipt = bundle.receipt;
      if (!signature && bundle.signature) signature = bundle.signature;
      if (!attestorKeyId && (bundle.attestorKeyId || bundle.kid)) attestorKeyId = bundle.attestorKeyId || bundle.kid;

      const readmeText = [
        'EVIDENCE PACK — Recânon CER Verification',
        '==========================================',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Certificate Hash: ${summary.certificateHash || 'N/A'}`,
        `Bundle Type: ${summary.bundleType || 'N/A'}`,
        '',
        'Contents:',
        '  bundle    — The complete CER bundle as uploaded',
        '  nodeKeys  — Public keys from the NexArt node (for offline signature verification)',
        receipt ? '  receipt   — The attestation receipt object' : '  receipt   — Not present in this bundle',
        signature ? '  signature — The Ed25519 signature (base64url)' : '  signature — Not present in this bundle',
        '',
        'Verification steps:',
        '  1. Compute SHA-256 of the canonicalized bundle (JCS) and compare to certificateHash',
        '  2. If receipt + signature are present, verify the Ed25519 signature using the node public key',
        '  3. Cross-check receipt.certificateHash matches the bundle certificateHash',
        '',
        'Tools: recanon.xyz, @nexart/ai-execution SDK, @nexart/codemode-sdk',
      ].join('\n');

      const evidencePack = {
        _format: 'recanon.evidence-pack.v1',
        generatedAt: new Date().toISOString(),
        certificateHash: summary.certificateHash,
        bundle,
        nodeKeys,
        receipt,
        signature,
        attestorKeyId,
        readme: readmeText,
      };

      const blob = new Blob([JSON.stringify(evidencePack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidence-pack-${(summary.certificateHash || 'bundle').slice(0, 16)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Evidence pack downloaded');
    } catch (err) {
      toast.error('Failed to generate evidence pack');
    } finally {
      setDownloadingPack(false);
    }
  }, [bundleJson, summary.certificateHash, summary.bundleType]);

  const passed = summary.status === 'pass';
  const isAI = summary.certType === 'AI Execution Record';

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

          {/* Right: Key facts table — ALL fields always shown */}
          <div className="sm:w-80 shrink-0">
            <table className="w-full text-xs">
              <tbody>
                <FactRow label="Record type" value={summary.certType} mono={false} />
                <FactRow label="Bundle type" value={summary.bundleType} />
                <FactRow label="Bundle version" value={summary.bundleVersion} />
                <FactRow label="Created at" value={summary.issuedAt ? new Date(summary.issuedAt).toLocaleString() : null} />
                {isAI && (
                  <FactRow label="Snapshot timestamp" value={
                    summary.snapshotTimestamp && summary.snapshotTimestamp !== summary.issuedAt
                      ? new Date(summary.snapshotTimestamp).toLocaleString()
                      : summary.snapshotTimestamp
                        ? '(same as created)'
                        : null
                  } />
                )}
                <FactRow label="Application" value={summary.application} truncate />
                {isAI && (
                  <>
                    <FactRow label="Provider" value={summary.provider} />
                    <FactRow label="Model" value={summary.model} />
                    <FactRow label="Model version" value={summary.modelVersion} />
                    <FactRow label="Execution ID" value={summary.executionId} truncate />
                    <FactRow label="Workflow ID" value={summary.workflowId} truncate />
                    <FactRow label="Conversation ID" value={summary.conversationId} truncate />
                    <FactRow label="Execution surface" value={summary.executionSurface} />
                  </>
                )}
                <FactRow label="Protocol version" value={summary.protocolVersion} />
                <FactRow label="SDK version" value={summary.sdkVersion} />
                {isAI && summary.stepIndex !== undefined && (
                  <FactRow label="Step index" value={summary.stepIndex} />
                )}
                {isAI && (
                  <FactRow label="Previous step hash" value={summary.prevStepHash} truncate />
                )}
                {summary.source && <FactRow label="Source" value={summary.source} />}
                {summary.tags && summary.tags.length > 0 && (
                  <FactRow label="Tags" value={summary.tags.join(', ')} mono={false} />
                )}
                <FactRow label="Certificate ID" value={summary.certificateHash} truncate copyable />
                {/* Node Attestation status */}
                <tr className="border-b border-border/50">
                  <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap text-xs">Node attestation</td>
                  <td className="py-1.5 text-right text-[11px]">
                    {summary.attestation ? (
                      <>
                        {summary.attestation.verified ? (
                          <span className="text-verified font-medium">Attested</span>
                        ) : (
                          <span className="text-muted-foreground">Present</span>
                        )}
                        {summary.attestation.hasSignedReceipt && (
                          <span className="ml-1 text-[10px] text-muted-foreground">(signed receipt)</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground/50 italic">None</span>
                    )}
                  </td>
                </tr>
                <FactRow label="Size" value={formatBytes(summary.bundleSizeBytes)} mono={false} />
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadEvidencePack}
            disabled={downloadingPack}
            className="gap-1.5 text-xs h-8"
          >
            <Package className="w-3.5 h-3.5" />
            {downloadingPack ? 'Preparing…' : 'Evidence pack'}
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
