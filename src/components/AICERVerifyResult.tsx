/**
 * AI CER Verification Result Display
 * 
 * Wraps CertificationReport for AI Execution CER bundles.
 * Shows attestation controls and Node Attestation Signature.
 */

import { useState } from 'react';
import { 
  ShieldCheck, Fingerprint, Hash, Info, Lock, KeyRound, ExternalLink, Loader2
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

      {/* Node Attestation Signature (offline verification) */}
      <NodeAttestationSignature
        bundle={bundle}
        verifiers={{
          hasAttestation: hasAICERAttestation,
          getAttestationReceipt: getAICERAttestationReceipt,
          verifyBundleAttestation: verifyAICERBundleAttestation,
        }}
      />
    </CertificationReport>
  );
}
