/**
 * Audit Summary — professional report header card.
 * 2-column layout: status (left) + key facts table (right).
 * Single consolidated action bar.
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

/** Key-value row for the facts table */
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
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-2 text-muted-foreground pr-4 whitespace-nowrap text-xs uppercase tracking-wider">{label}</td>
      <td className="py-2 text-right">
        {display ? (
          copyable ? (
            <button
              onClick={handleCopy}
              className={cn(
                "text-xs text-primary hover:underline cursor-pointer",
                mono && "font-mono",
                truncate && "truncate max-w-[220px] inline-block align-bottom",
              )}
              title={`Copy ${label}`}
            >
              {truncate && display.length > 24 ? truncateHash(display) : display}
            </button>
          ) : (
            <span className={cn(
              "text-xs text-foreground",
              mono && "font-mono",
              truncate && "truncate max-w-[220px] inline-block align-bottom",
            )}>
              {display}
            </span>
          )
        ) : (
          <span className="text-xs text-muted-foreground/40 italic">Not provided</span>
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
      let nodeKeys: unknown = null;
      try {
        const res = await fetch(`${NODE_URL}/.well-known/nexart-node.json`);
        if (res.ok) nodeKeys = await res.json();
      } catch { /* node keys unavailable */ }

      const att = bundle.attestation && typeof bundle.attestation === 'object' ? bundle.attestation : null;
      let receipt: unknown = null;
      let signature: string | null = null;
      let attestorKeyId: string | null = null;

      if (att) {
        receipt = att.receipt || null;
        signature = att.signature || att.signatureB64Url || null;
        attestorKeyId = att.attestorKeyId || att.kid || null;
      }
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
        '  nodeKeys  — Public keys from the NexArt node',
        receipt ? '  receipt   — The attestation receipt object' : '  receipt   — Not present',
        signature ? '  signature — The Ed25519 signature (base64url)' : '  signature — Not present',
        '',
        'Verification:',
        '  1. SHA-256 of canonicalized bundle → compare to certificateHash',
        '  2. If receipt + signature: verify Ed25519 with node public key',
        '',
        'Tools: recanon.xyz, @nexart/ai-execution SDK',
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
    } catch {
      toast.error('Failed to generate evidence pack');
    } finally {
      setDownloadingPack(false);
    }
  }, [bundleJson, summary.certificateHash, summary.bundleType]);

  const passed = summary.status === 'pass';
  const isAI = summary.certType === 'AI Execution Record';

  return (
    <Card className={cn(
      "border-2",
      passed ? "border-verified/20" : "border-destructive/20",
    )}>
      <CardContent className="pt-6 pb-5 px-6">
        {/* 2-column grid: Status + Facts */}
        <div className="space-y-6">
          {/* Left: Status + explanation */}
          <div className="min-w-0 space-y-4">
            <div className="flex items-start gap-4">
              {passed ? (
                <div className="w-12 h-12 rounded-full bg-verified/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-verified" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
              )}
              <div>
                <h1 className={cn(
                  "text-2xl font-semibold tracking-tight",
                  passed ? "text-verified" : "text-destructive",
                )}>
                  {passed ? 'Verified' : 'Not verified'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {passed
                    ? 'This record has not been altered since certification.'
                    : 'This record may have been modified after certification.'}
                </p>
              </div>
            </div>

            {/* Why? (failure only) */}
            {!passed && verifyCode && (
              <Collapsible open={showWhy} onOpenChange={setShowWhy}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showWhy && "rotate-180")} />
                  <span>Why?</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-mono text-destructive mb-1">{verifyCode}</p>
                  <p className="text-xs text-muted-foreground">
                    The record's certificate hash does not match the computed hash.
                  </p>
                  {verifyDetails && verifyDetails.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
                      {verifyDetails.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Actions — single consolidated row */}
            <div className="flex gap-2 flex-wrap pt-2">
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
          </div>

          {/* Right: Key facts table */}
          <div className="border-t border-border/30 pt-6">
            <table className="w-full text-xs">
              <tbody>
                <FactRow label="Record type" value={summary.certType} mono={false} />
                <FactRow label="Bundle type" value={summary.bundleType} />
                <FactRow label="Version" value={summary.bundleVersion} />
                <FactRow label="Created" value={summary.issuedAt ? new Date(summary.issuedAt).toLocaleString() : null} />
                {isAI && summary.snapshotTimestamp && summary.snapshotTimestamp !== summary.issuedAt && (
                  <FactRow label="Snapshot" value={new Date(summary.snapshotTimestamp).toLocaleString()} />
                )}
                <FactRow label="Application" value={summary.application} truncate />
                {isAI && (
                  <>
                    <FactRow label="Provider" value={summary.provider} />
                    <FactRow label="Model" value={summary.model} />
                    {summary.modelVersion && <FactRow label="Model ver." value={summary.modelVersion} />}
                    <FactRow label="Execution ID" value={summary.executionId} truncate />
                    {summary.workflowId && <FactRow label="Workflow" value={summary.workflowId} truncate />}
                    {summary.conversationId && <FactRow label="Conversation" value={summary.conversationId} truncate />}
                    {summary.executionSurface && <FactRow label="Surface" value={summary.executionSurface} />}
                  </>
                )}
                <FactRow label="Protocol" value={summary.protocolVersion} />
                <FactRow label="SDK" value={summary.sdkVersion} />
                {isAI && summary.stepIndex !== undefined && (
                  <FactRow label="Step" value={summary.stepIndex} />
                )}
                {summary.source && <FactRow label="Source" value={summary.source} />}
                {summary.tags && summary.tags.length > 0 && (
                  <FactRow label="Tags" value={summary.tags.join(', ')} mono={false} />
                )}
                <FactRow label="Certificate ID" value={summary.certificateHash} truncate copyable />
                {/* Node Attestation status */}
                <tr className="border-b border-border/30">
                  <td className="py-2 text-muted-foreground pr-4 whitespace-nowrap text-xs uppercase tracking-wider">Attestation</td>
                  <td className="py-2 text-right text-xs">
                    {summary.attestation ? (
                      <>
                        {summary.attestation.verified ? (
                          <span className="text-verified font-medium">Attested</span>
                        ) : (
                          <span className="text-muted-foreground">Present</span>
                        )}
                        {summary.attestation.hasSignedReceipt && (
                          <span className="ml-1 text-[10px] text-muted-foreground">(signed)</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground/40 italic">None</span>
                    )}
                  </td>
                </tr>
                <FactRow label="Size" value={formatBytes(summary.bundleSizeBytes)} mono={false} />
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
