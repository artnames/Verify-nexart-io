/**
 * AI CER Verification Result Display
 *
 * Three clearly separated trust layers:
 *  1. Bundle Integrity   — certificate hash verification (PASS/FAIL)
 *  2. Signed Attestation — cryptographic receipt + signature verification
 *  3. Legacy Attestation — informational metadata without signature
 *
 * Does NOT change CER protocol semantics.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Fingerprint, Hash, Info, Lock, KeyRound, ExternalLink, Loader2,
  CheckCircle2, Clock, FileText, AlertTriangle, ShieldAlert,
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
import { hasVerificationEnvelope, hasVerificationEnvelopeWithPackage, verifyVerificationEnvelope, type VerificationEnvelopeResult } from '@/lib/verifyEnvelope';
import type { PackageEnvelopeData } from '@/types/cerPackage';
import { VerificationEnvelopeCard } from './VerificationEnvelopeCard';

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
  contextIntegrityProtected?: boolean;
  /** Package-level envelope data for official CER package uploads */
  packageEnvelopeData?: PackageEnvelopeData;
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
  contextIntegrityProtected,
}: AICERVerifyResultProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(hasNodeApiKey());
  const [envelopeResult, setEnvelopeResult] = useState<VerificationEnvelopeResult | null>(null);

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      setNodeApiKey(apiKeyInput.trim());
      setHasKey(true);
      setApiKeyInput('');
    }
  };

  const passed = verifyResult.ok;

  // Determine attestation layer state
  const metaAtt = bundle?.meta?.attestation && typeof bundle.meta.attestation === 'object' ? bundle.meta.attestation : null;
  const topAtt = bundle?.attestation && typeof bundle.attestation === 'object' ? bundle.attestation : null;
  const att = metaAtt || topAtt;

  const envelope = extractSignedReceiptEnvelope(bundle);
  const hasSignedReceipt = !!(envelope || att?.receipt || att?.signature || att?.signatureB64Url);
  const hasLegacyAttestation = !!(att && !hasSignedReceipt && (att.attestationId || att.attestationStatus));
  const hasEnvelope = hasVerificationEnvelope(bundle);

  // Run envelope verification eagerly so we can compute trust warnings
  useEffect(() => {
    if (!hasEnvelope) {
      setEnvelopeResult(null);
      return;
    }
    let cancelled = false;
    verifyVerificationEnvelope(bundle).then((r) => {
      if (!cancelled) setEnvelopeResult(r);
    });
    return () => { cancelled = true; };
  }, [bundle, hasEnvelope]);

  // Compute trust warnings for the top-level summary
  const trustWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (envelopeResult && envelopeResult.status !== 'valid' && envelopeResult.status !== 'absent') {
      const typeLabel = envelopeResult.envelopeType === 'v2' ? 'Full bundle' : 'Legacy';
      warnings.push(`${typeLabel} verification envelope: ${envelopeResult.status === 'invalid' ? 'signature invalid' : envelopeResult.status}`);
    }
    return warnings;
  }, [envelopeResult]);

  // Prepare normalized bundle for NodeAttestationSignature
  let normalizedBundle = bundle;
  if (envelope && !getAICERAttestationReceipt(bundle)) {
    const cloned = JSON.parse(JSON.stringify(bundle)) as any;
    if (!cloned.attestation || typeof cloned.attestation !== 'object') {
      cloned.attestation = {};
    }
    cloned.attestation.receipt = envelope.receipt;
    cloned.attestation.signatureB64Url = envelope.signatureB64Url;
    cloned.attestation.attestorKeyId = envelope.kid;
    if (envelope.nodeId) cloned.attestation.nodeId = envelope.nodeId;
    cloned.receipt = envelope.receipt;
    cloned.signatureB64Url = envelope.signatureB64Url;
    cloned.signature = envelope.signatureB64Url;
    cloned.attestorKeyId = envelope.kid;
    cloned.kid = envelope.kid;
    if (envelope.nodeId) cloned.nodeId = envelope.nodeId;
    normalizedBundle = cloned;
  }

  return (
    <CertificationReport
      bundle={bundle}
      bundleKind="ai-execution"
      verifyStatus={passed ? 'pass' : 'fail'}
      verifyCode={!passed ? verifyResult.code : undefined}
      verifyDetails={!passed ? verifyResult.errors : undefined}
      contextIntegrityProtected={contextIntegrityProtected}
      trustWarnings={trustWarnings.length > 0 ? trustWarnings : undefined}
    >
      {/* ─── Layer 2a: Verification Envelope (highest trust) ─── */}
      {hasEnvelope && (
        <VerificationEnvelopeCard bundle={bundle} precomputedResult={envelopeResult} />
      )}

      {/* ─── Layer 2b: Signed Attestation Verification ─── */}
      {hasSignedReceipt && (
        <NodeAttestationSignature
          bundle={normalizedBundle}
          verifiers={{
            hasAttestation: hasAICERAttestation,
            getAttestationReceipt: getAICERAttestationReceipt,
            verifyBundleAttestation: verifyAICERBundleAttestation,
          }}
        />
      )}

      {/* ─── Layer 3: Legacy / Unsigned Attestation ─── */}
      {hasLegacyAttestation && !hasSignedReceipt && (
        <LegacyAttestationCard
          att={att}
          hasKey={hasKey}
          onAttest={onAttest}
          isAttesting={isAttesting}
          attestResult={attestResult}
          attestError={attestError}
          passed={passed}
        />
      )}

      {/* ─── No attestation at all — show request controls ─── */}
      {!att && !hasSignedReceipt && !attestResult && (
        <NoAttestationCard
          passed={passed}
          hasKey={hasKey}
          apiKeyInput={apiKeyInput}
          setApiKeyInput={setApiKeyInput}
          handleSaveKey={handleSaveKey}
          onAttest={onAttest}
          isAttesting={isAttesting}
          attestResult={attestResult}
          attestError={attestError}
        />
      )}

      {/* Fresh attestation result (when attesting from no-attestation state) */}
      {!att && !hasSignedReceipt && attestResult && (
        <FreshAttestationResultCard attestResult={attestResult} />
      )}
    </CertificationReport>
  );
}

/* ================================================================== */
/*  Legacy Attestation Card                                           */
/* ================================================================== */

function LegacyAttestationCard({
  att,
  hasKey,
  onAttest,
  isAttesting,
  attestResult,
  attestError,
  passed,
}: {
  att: any;
  hasKey: boolean;
  onAttest?: () => Promise<void>;
  isAttesting?: boolean;
  attestResult?: AttestationResult | null;
  attestError?: string | null;
  passed: boolean;
}) {
  return (
    <Card className="border border-muted-foreground/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>Attestation Metadata</span>
          </div>
          <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-[10px]">
            Legacy · Unsigned
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Trust messaging */}
        <div className="p-2.5 rounded-md bg-muted/20 border border-border/50 space-y-1.5">
          <div className="flex items-start gap-2 text-xs">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">This record has attestation metadata but no signed receipt.</span>
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Bundle integrity (snapshot, context) is verified independently via certificate hash</li>
                <li>Attestation fields below are <span className="font-medium text-foreground">informational only</span> — not independently signature-verified</li>
                <li>Re-attest to generate a signed receipt for offline cryptographic verification</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Attestation metadata table */}
        <table className="w-full text-xs">
          <tbody>
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
            {att.verified !== undefined && (
              <tr className="border-b border-border/40">
                <td className="py-1.5 text-muted-foreground pr-3 whitespace-nowrap">Node verified</td>
                <td className="py-1.5 text-right font-mono">
                  {att.verified ? (
                    <span className="text-verified flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3" /> true</span>
                  ) : 'false'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Checks array */}
        {Array.isArray(att.checks) && att.checks.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Node checks</p>
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

        {/* Attestation error */}
        {attestError && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm font-medium text-destructive">Attestation request failed</p>
            <p className="text-xs text-muted-foreground mt-1">{attestError}</p>
          </div>
        )}

        {/* Fresh attestation result */}
        {attestResult && (
          <div className="p-3 rounded-md bg-verified/10 border border-verified/20">
            <p className="text-sm font-medium text-verified">Re-attestation complete</p>
            {attestResult.attestationId && (
              <p className="text-xs font-mono text-muted-foreground mt-1">
                New attestation ID: {attestResult.attestationId}
              </p>
            )}
          </div>
        )}

        {/* Upgrade CTA */}
        {!attestResult && !attestError && passed && hasKey && onAttest && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAttest}
            disabled={isAttesting}
            className="gap-2"
          >
            {isAttesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Requesting signed receipt…
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                Request signed receipt
              </>
            )}
          </Button>
        )}

        {!passed && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Signed receipt requires passing bundle integrity verification first.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/*  No Attestation Card (request controls)                            */
/* ================================================================== */

function NoAttestationCard({
  passed,
  hasKey,
  apiKeyInput,
  setApiKeyInput,
  handleSaveKey,
  onAttest,
  isAttesting,
  attestResult,
  attestError,
}: {
  passed: boolean;
  hasKey: boolean;
  apiKeyInput: string;
  setApiKeyInput: (v: string) => void;
  handleSaveKey: () => void;
  onAttest?: () => Promise<void>;
  isAttesting?: boolean;
  attestResult?: AttestationResult | null;
  attestError?: string | null;
}) {
  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-muted-foreground" />
            <span>Canonical Attestation</span>
          </div>
          <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-[10px]">
            Not attested
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Canonical attestation confirms this record's hashes and certificate are internally consistent
          when checked by the NexArt canonical node. A signed receipt enables offline verification.
        </p>

        {/* Attestation error */}
        {attestError && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm font-medium text-destructive">Attestation failed</p>
            <p className="text-xs text-muted-foreground mt-1">{attestError}</p>
          </div>
        )}

        {/* Controls */}
        {!attestResult && !attestError && passed && (
          <>
            {!hasKey ? (
              <div className="space-y-3 p-3 rounded-md border border-border bg-muted/30">
                <div className="flex items-start gap-2 text-sm">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-muted-foreground">Attestation requires an API key</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Bundle integrity passed locally. Attestation is optional and consumes canonical node quota.
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

        {!passed && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Attestation requires passing bundle integrity verification first.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/*  Fresh Attestation Result Card                                     */
/* ================================================================== */

function FreshAttestationResultCard({ attestResult }: { attestResult: AttestationResult }) {
  return (
    <Card className="border border-verified/30 bg-verified/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-verified" />
            <span>Canonical Attestation</span>
          </div>
          <Badge className="bg-verified text-verified-foreground">Attested</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
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
      </CardContent>
    </Card>
  );
}
