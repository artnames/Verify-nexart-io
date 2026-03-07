/**
 * AI CER Verification Result Display
 * 
 * Wraps CertificationReport for AI Execution CER bundles.
 * Shows attestation controls, attestation block details, and Node Attestation Signature.
 */

import { useState } from 'react';
import { 
  ShieldCheck, Fingerprint, Hash, Info, Lock, KeyRound, ExternalLink, Loader2,
  CheckCircle2, Clock, FileText,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '@/lib/utils';
import { hasNodeApiKey, getNodeApiKey, setNodeApiKey } from '@/storage/nodeApiKey';
import { NodeAttestationSignature } from './NodeAttestationSignature';
import { CertificationReport } from './certification-report/CertificationReport';
import type { VerificationResult, AttestationResult } from '@nexart/ai-execution';
import {
  verifyBundleAttestation as verifyAICERBundleAttestation,
  getAttestationReceipt as getAICERAttestationReceipt,
  hasAttestation as hasAICERAttestation,
} from '@nexart/ai-execution';
import { extractSignedReceiptEnvelope } from '@/lib/extractSignedReceipt';

interface AICERVerifyResultProps {
  verifyResult: VerificationResult;
  bundle: any;
  attestationPresent: boolean;
  attestationFields?: {
    attestationId?: string;
    nodeRuntimeHash?: string;
    protocolVersion?: string;
    certificateHash?: string;
  };
  onAttest?: () => Promise<void>;
  isAttesting?: boolean;
  attestResult?: AttestationResult | null;
  attestError?: string | null;
}

export function AICERVerifyResult({
  verifyResult,
  bundle,
  attestationPresent,
  attestationFields,
  onAttest,
  isAttesting,
  attestResult,
  attestError,
}: AICERVerifyResultProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(hasNodeApiKey());

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      setNodeApiKey(apiKeyInput.trim());
      setHasKey(true);
      setApiKeyInput('');
    }
  };

  const passed = verifyResult.ok;

  return (
    <CertificationReport
      bundle={bundle}
      bundleKind="ai-execution"
      verifyStatus={passed ? 'pass' : 'fail'}
      verifyCode={!passed ? verifyResult.code : undefined}
      verifyDetails={!passed ? verifyResult.errors : undefined}
    >
      {/* Canonical Attestation Section */}
      <Card className={cn(
        "border",
        attestationPresent && "border-verified/30 bg-verified/5",
        attestResult && "border-verified/30 bg-verified/5",
        attestError && "border-destructive/30 bg-destructive/5",
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {attestationPresent || attestResult
                ? <ShieldCheck className="w-4 h-4 text-verified" />
                : <Fingerprint className="w-4 h-4 text-muted-foreground" />
              }
              <span>Canonical Attestation</span>
            </div>
            {attestationPresent && (
              <Badge className="bg-verified text-verified-foreground">Present</Badge>
            )}
            {!attestationPresent && attestResult && (
              <Badge className="bg-verified text-verified-foreground">Attested</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Canonical attestation confirms this record's hashes and certificate are internally consistent
            when checked by the NexArt canonical node. It does not re-run the model.
          </p>

          {/* Already attested */}
          {attestationPresent && attestationFields && (
            <div className="space-y-2 text-xs">
              <p className="text-sm text-verified">Canonical Attestation: Present (Node Attested)</p>
              {attestationFields.attestationId && (
                <div className="flex items-start gap-2">
                  <Fingerprint className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">attestationId: </span>
                    <code className="font-mono break-all">{attestationFields.attestationId}</code>
                  </div>
                </div>
              )}
              {attestationFields.nodeRuntimeHash && (
                <div className="flex items-start gap-2">
                  <Hash className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">nodeRuntimeHash: </span>
                    <code className="font-mono break-all">{attestationFields.nodeRuntimeHash}</code>
                  </div>
                </div>
              )}
              {attestationFields.protocolVersion && (
                <div className="flex items-start gap-2">
                  <Info className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">protocolVersion: </span>
                    <code className="font-mono">{attestationFields.protocolVersion}</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attestation result from a fresh request */}
          {!attestationPresent && attestResult && (
            <div className="space-y-2 text-xs">
              <p className="text-sm text-verified">Canonical node attested this record.</p>
              {attestResult.attestationId && (
                <div className="flex items-start gap-2">
                  <Fingerprint className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">attestationId: </span>
                    <code className="font-mono break-all">{attestResult.attestationId}</code>
                  </div>
                </div>
              )}
              {attestResult.nodeRuntimeHash && (
                <div className="flex items-start gap-2">
                  <Hash className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="text-muted-foreground">nodeRuntimeHash: </span>
                    <code className="font-mono break-all">{attestResult.nodeRuntimeHash}</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attestation error */}
          {attestError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-medium text-destructive">Attestation failed</p>
              <p className="text-xs text-muted-foreground mt-1">{attestError}</p>
            </div>
          )}

          {/* No attestation yet — show controls */}
          {!attestationPresent && !attestResult && !attestError && passed && (
            <>
              {!hasKey ? (
                <div className="space-y-3 p-3 rounded-md border border-border bg-muted/30">
                  <div className="flex items-start gap-2 text-sm">
                    <Lock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-muted-foreground">Attestation requires an API key</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Verification passed locally. Attestation is optional and consumes canonical node quota.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Paste NexArt Node API key"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                        className="pl-9 text-sm font-mono"
                        type="password"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSaveKey} disabled={!apiKeyInput.trim()}>
                      Unlock
                    </Button>
                  </div>
                  <a
                    href="https://nexart.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Get an API key on nexart.io
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAttest}
                  disabled={isAttesting || !passed}
                >
                  {isAttesting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Requesting attestation…
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4 mr-2" />
                      Request canonical attestation
                    </>
                  )}
                </Button>
              )}
            </>
          )}

          {/* If verification failed, block attestation */}
          {!passed && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Attestation requires passing local verification first.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attestation Block Details (from bundle.attestation or bundle.meta.attestation) */}
      {(() => {
        const metaAtt = bundle?.meta?.attestation && typeof bundle.meta.attestation === 'object' ? bundle.meta.attestation : null;
        const topAtt = bundle?.attestation && typeof bundle.attestation === 'object' ? bundle.attestation : null;
        const att = metaAtt || topAtt;
        if (!att) return null;
        // Use canonical multi-layout probe for signed receipt detection
        const envelope = extractSignedReceiptEnvelope(bundle);
        const hasReceiptFields = !!(envelope || att.receipt || att.signature || att.signatureB64Url);
        return (
          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Node Attestation Details</span>
                {att.verified && (
                  <Badge className="bg-verified text-verified-foreground ml-auto">Attested</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <table className="w-full text-xs">
                <tbody>
                  {att.verified !== undefined && (
                    <tr className="border-b border-border/40">
                      <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Verified</td>
                      <td className="py-1.5 text-right font-mono">
                        {att.verified ? (
                          <span className="text-verified flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3" /> true</span>
                        ) : 'false'}
                      </td>
                    </tr>
                  )}
                  {att.attestationId && (
                    <tr className="border-b border-border/40">
                      <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Attestation ID</td>
                      <td className="py-1.5 text-right font-mono text-[11px] break-all">{att.attestationId}</td>
                    </tr>
                  )}
                  {att.requestId && (
                    <tr className="border-b border-border/40">
                      <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Request ID</td>
                      <td className="py-1.5 text-right font-mono text-[11px] break-all">{att.requestId}</td>
                    </tr>
                  )}
                  {att.attestedAt && (
                    <tr className="border-b border-border/40">
                      <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Attested at</td>
                      <td className="py-1.5 text-right font-mono text-[11px]">
                        {new Date(att.attestedAt).toLocaleString()}
                      </td>
                    </tr>
                  )}
                  {att.nodeRuntimeHash && (
                    <tr className="border-b border-border/40">
                      <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Node runtime hash</td>
                      <td className="py-1.5 text-right font-mono text-[11px] break-all">{att.nodeRuntimeHash}</td>
                    </tr>
                  )}
                  {att.protocolVersion && (
                    <tr className="border-b border-border/40">
                      <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Protocol version</td>
                      <td className="py-1.5 text-right font-mono">{att.protocolVersion}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Checks array */}
              {Array.isArray(att.checks) && att.checks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Checks</p>
                  <div className="space-y-1">
                    {att.checks.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono p-1.5 rounded bg-muted/30 border border-border/50">
                        {c.result === 'pass' ? (
                          <CheckCircle2 className="w-3 h-3 text-verified shrink-0" />
                        ) : (
                          <Info className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-muted-foreground">{c.check}:</span>
                        <span className={c.result === 'pass' ? 'text-verified' : ''}>{c.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No signed receipt message */}
              {!hasReceiptFields && (
                <div className="space-y-2.5 p-2.5 rounded-md bg-muted/20 border border-border/50">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <span className="font-medium text-foreground">Unsigned attestation (legacy)</span>
                      <p>
                        This record includes an attestation ID, but not the signed receipt fields needed for offline verification. Re-attest to generate a signed receipt.
                      </p>
                    </div>
                  </div>
                  {hasKey && onAttest && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAttest}
                      disabled={isAttesting}
                      className="ml-5"
                    >
                      {isAttesting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Requesting…
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4 mr-2" />
                          Request signed receipt
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Node Attestation Signature (offline verification) */}
      {(() => {
        // Pre-normalize the bundle so the SDK can find receipt fields
        // Public-safe bundles often store receipt at meta.attestation.* 
        // but SDK expects bundle.attestation.*
        const envelope = extractSignedReceiptEnvelope(bundle);
        let normalizedBundle = bundle;
        if (envelope && !getAICERAttestationReceipt(bundle)) {
          const cloned = JSON.parse(JSON.stringify(bundle)) as any;
          // Place receipt fields at BOTH bundle.attestation.* AND top-level
          // The SDK may look for bundle.receipt + bundle.signatureB64Url (top-level)
          if (!cloned.attestation || typeof cloned.attestation !== 'object') {
            cloned.attestation = {};
          }
          cloned.attestation.receipt = envelope.receipt;
          cloned.attestation.signatureB64Url = envelope.signatureB64Url;
          cloned.attestation.attestorKeyId = envelope.kid;
          if (envelope.nodeId) cloned.attestation.nodeId = envelope.nodeId;
          // Also set top-level for SDKs that expect bundle.receipt / bundle.signature
          cloned.receipt = envelope.receipt;
          cloned.signatureB64Url = envelope.signatureB64Url;
          cloned.signature = envelope.signatureB64Url;
          cloned.attestorKeyId = envelope.kid;
          cloned.kid = envelope.kid;
          if (envelope.nodeId) cloned.nodeId = envelope.nodeId;
          normalizedBundle = cloned;
        }
        return (
          <NodeAttestationSignature
            bundle={normalizedBundle}
            verifiers={{
              hasAttestation: hasAICERAttestation,
              getAttestationReceipt: getAICERAttestationReceipt,
              verifyBundleAttestation: verifyAICERBundleAttestation,
            }}
          />
        );
      })()}
    </CertificationReport>
  );
}
