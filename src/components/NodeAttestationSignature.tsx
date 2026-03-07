/**
 * Independent Stamp — Node Attestation Signature with professional audit language.
 *
 * Uses plain English: "stamp" instead of "attestation signature".
 * Includes "Integrity simulation" (tamper demo) with professional labeling.
 *
 * Accepts injected verifier functions so callers can provide the correct SDK.
 */

import { useState, useCallback } from 'react';
import {
  ShieldCheck, ShieldAlert, Info, ChevronDown, Key, Globe,
  Loader2, AlertTriangle, Search, FlaskConical,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { probeReceiptFields, extractSignedReceiptEnvelope, type ReceiptFieldProbe } from '@/lib/extractSignedReceipt';

// ── Default node URL ──
const DEFAULT_NODE_URL = 'https://node.nexart.io';

/** Shared result shape — both SDKs use the same interface */
export interface NodeReceiptVerifyResultCompat {
  ok: boolean;
  code: string;
  details?: string[];
}

/** Shared receipt shape — common fields across both SDKs */
export interface AttestationReceiptCompat {
  attestationId?: string;
  nodeId?: string;
  attestorKeyId?: string;
  certificateHash?: string;
  nodeRuntimeHash?: string;
  protocolVersion?: string;
  attestedAt?: string;
}

/** Injected verifier functions — caller provides the correct SDK impl */
export interface AttestationVerifiers {
  hasAttestation: (bundle: unknown) => boolean;
  getAttestationReceipt: (bundle: unknown) => AttestationReceiptCompat | null;
  verifyBundleAttestation: (bundle: unknown, options: { nodeUrl: string; kid?: string }) => Promise<NodeReceiptVerifyResultCompat>;
}

interface NodeAttestationSignatureProps {
  bundle: unknown;
  verifiers: AttestationVerifiers;
  nodeUrl?: string;
  className?: string;
}

type VerifyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'no-receipt' }
  | { status: 'missing-fields'; probe: ReceiptFieldProbe }
  | { status: 'verified'; result: NodeReceiptVerifyResultCompat; receipt: AttestationReceiptCompat }
  | { status: 'failed'; result: NodeReceiptVerifyResultCompat; receipt: AttestationReceiptCompat }
  | { status: 'error'; message: string };

export function NodeAttestationSignature({ bundle, verifiers, nodeUrl, className }: NodeAttestationSignatureProps) {
  const resolvedNodeUrl = nodeUrl || DEFAULT_NODE_URL;
  const [state, setState] = useState<VerifyState>({ status: 'idle' });
  const [tamperActive, setTamperActive] = useState(false);
  const [tamperState, setTamperState] = useState<VerifyState | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const receipt = verifiers.getAttestationReceipt(bundle);
  // Fallback: use multi-layout probe if SDK doesn't find receipt
  const envelopeFallback = !receipt ? extractSignedReceiptEnvelope(bundle) : null;
  const hasReceipt = (verifiers.hasAttestation(bundle) && receipt !== null) || envelopeFallback !== null;

  // Build a normalized receipt from envelope fallback for display purposes
  const effectiveReceipt: AttestationReceiptCompat | null = receipt ?? (envelopeFallback ? {
    attestorKeyId: envelopeFallback.kid,
    nodeId: envelopeFallback.nodeId,
  } : null);

  /**
   * Normalize bundle so the SDK can find receipt fields at bundle.attestation.*
   * when they actually live at bundle.meta.attestation.* or other layouts.
   */
  const normalizeBundleForSdk = useCallback((b: unknown): unknown => {
    if (!b || typeof b !== 'object') return b;
    const envelope = extractSignedReceiptEnvelope(b);
    if (!envelope) return b;

    // If SDK already finds it, no normalization needed
    const sdkReceipt = verifiers.getAttestationReceipt(b);
    if (sdkReceipt) return b;

    // Deep clone and place receipt fields where SDK expects: bundle.attestation.*
    const normalized = JSON.parse(JSON.stringify(b)) as any;
    if (!normalized.attestation || typeof normalized.attestation !== 'object') {
      normalized.attestation = {};
    }
    normalized.attestation.receipt = envelope.receipt;
    normalized.attestation.signatureB64Url = envelope.signatureB64Url;
    normalized.attestation.attestorKeyId = envelope.kid;
    if (envelope.nodeId) normalized.attestation.nodeId = envelope.nodeId;
    return normalized;
  }, [verifiers]);

  // ── Run verification (original) ──
  const runVerify = useCallback(async () => {
    if (!hasReceipt) {
      const probe = probeReceiptFields(bundle);
      if (probe.hasAttestationId || probe.hasReceipt || probe.hasSignature || probe.hasKid) {
        setState({ status: 'missing-fields', probe });
      } else {
        setState({ status: 'no-receipt' });
      }
      return;
    }

    setState({ status: 'loading' });

    try {
      const normalizedBundle = normalizeBundleForSdk(bundle);
      const result = await verifiers.verifyBundleAttestation(normalizedBundle, { nodeUrl: resolvedNodeUrl });
      if (result.ok) {
        setState({ status: 'verified', result, receipt: effectiveReceipt! });
      } else {
        if (result.code === 'NODE_RECEIPT_MISSING') {
          // SDK still can't find receipt even after normalization
          const probe = probeReceiptFields(bundle);
          setState({ status: 'missing-fields', probe });
        } else {
          setState({ status: 'failed', result, receipt: effectiveReceipt! });
        }
      }
    } catch (err: any) {
      setState({ status: 'error', message: err?.message || 'Verification failed' });
    }
  }, [bundle, hasReceipt, effectiveReceipt, resolvedNodeUrl, verifiers, normalizeBundleForSdk]);

  // ── Integrity simulation (tamper demo) ──
  const runTamper = useCallback(async () => {
    if (!hasReceipt) return;

    // Normalize first, then tamper the normalized copy
    const normalized = normalizeBundleForSdk(bundle);
    const tampered = JSON.parse(JSON.stringify(normalized)) as any;

    // Flip signature to guarantee failure
    if (tampered.attestation?.signatureB64Url) {
      const sig = tampered.attestation.signatureB64Url;
      tampered.attestation.signatureB64Url = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    }
    // Also flip a receipt field if present
    const rct = tampered.attestation?.receipt;
    if (rct && typeof rct === 'object' && rct.certificateHash && typeof rct.certificateHash === 'string') {
      const ch = rct.certificateHash;
      rct.certificateHash = (ch[0] === 'a' ? 'b' : 'a') + ch.slice(1);
    }

    try {
      const result = await verifiers.verifyBundleAttestation(tampered, { nodeUrl: resolvedNodeUrl });
      if (result.ok) {
        setTamperState({ status: 'verified', result, receipt: effectiveReceipt! });
      } else {
        setTamperState({ status: 'failed', result, receipt: effectiveReceipt! });
      }
    } catch (err: any) {
      setTamperState({ status: 'error', message: err?.message || 'Tamper verification failed' });
    }
  }, [bundle, hasReceipt, effectiveReceipt, resolvedNodeUrl, verifiers, normalizeBundleForSdk]);

  const handleTamperToggle = async () => {
    if (!tamperActive) {
      setTamperActive(true);
      await runTamper();
    } else {
      setTamperActive(false);
      setTamperState(null);
    }
  };

  // Auto-verify
  if (state.status === 'idle' && hasReceipt) {
    runVerify();
  } else if (state.status === 'idle' && !hasReceipt) {
    setTimeout(() => {
      const probe = probeReceiptFields(bundle);
      if (probe.hasAttestationId || probe.hasReceipt || probe.hasSignature || probe.hasKid) {
        setState({ status: 'missing-fields', probe });
      } else {
        setState({ status: 'no-receipt' });
      }
    }, 0);
  }

  const displayState = tamperActive && tamperState ? tamperState : state;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Independent stamp (Node)</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              A stamp is a signed receipt from an independent node. If the record changes after stamping, the stamp will no longer match.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card className={cn(
        "border",
        displayState.status === 'verified' && "border-verified/30",
        displayState.status === 'failed' && "border-destructive/30",
      )}>
        <CardContent className="pt-4 pb-4 space-y-3">
          {/* Loading */}
          {displayState.status === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking stamp…</span>
            </div>
          )}

          {/* No receipt */}
          {displayState.status === 'no-receipt' && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stamp missing</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This record can still be checked locally, but it has no node stamp.
                </p>
              </div>
            </div>
          )}

          {/* Missing fields */}
          {displayState.status === 'missing-fields' && 'probe' in displayState && (
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unsigned attestation (legacy)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This record includes an attestation ID, but not the signed receipt fields needed for offline verification. Re-attest to generate a signed receipt.
                  </p>
                </div>
              </div>
              <Collapsible open={showDebug} onOpenChange={setShowDebug}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Search className="w-3 h-3" />
                  <span>Field check</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform ml-1", showDebug && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 text-xs font-mono bg-muted/20 p-3 rounded-md border border-border space-y-1">
                  {displayState.probe.foundIn && (
                    <div className="text-muted-foreground mb-1.5">
                      Searched: <code className="text-foreground">{displayState.probe.foundIn}</code>
                    </div>
                  )}
                  <FieldCheck label="attestationId" found={displayState.probe.hasAttestationId} />
                  <FieldCheck label="receipt" found={displayState.probe.hasReceipt} />
                  <FieldCheck label="signature" found={displayState.probe.hasSignature} />
                  <FieldCheck label="kid" found={displayState.probe.hasKid} />
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Verified */}
          {displayState.status === 'verified' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-verified/10 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-verified" />
                </div>
                <div>
                  <p className="text-sm font-medium text-verified">Stamp verified</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The node signed a receipt for this record. The signature matches the public key.
                  </p>
                </div>
              </div>
              <StampDetails receipt={receipt} nodeUrl={resolvedNodeUrl} />
            </div>
          )}

          {/* Failed */}
          {displayState.status === 'failed' && 'result' in displayState && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-destructive">Stamp invalid</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The receipt signature does not match.
                  </p>
                  <p className="text-xs font-mono text-destructive mt-1">{displayState.result.code}</p>
                  {displayState.result.details && displayState.result.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
                      {displayState.result.details.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {displayState.status === 'error' && 'message' in displayState && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Stamp check failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{displayState.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrity simulation */}
      {hasReceipt && (state.status === 'verified' || state.status === 'failed') && (
        <div className="border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Integrity simulation</p>
              <p className="text-[11px] text-muted-foreground">
                Show what happens if a record is edited.
              </p>
            </div>
            <Button
              variant={tamperActive ? "destructive" : "outline"}
              size="sm"
              onClick={handleTamperToggle}
              className="gap-1.5 text-xs h-7"
            >
              <FlaskConical className="w-3 h-3" />
              {tamperActive ? 'Reset' : 'Simulate'}
            </Button>
          </div>
          {tamperActive && tamperState?.status === 'failed' && 'result' in tamperState && (
            <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
              <p className="text-xs text-destructive">
                We changed one character. Verification failed.
              </p>
              <p className="text-[11px] font-mono text-muted-foreground mt-1">
                {tamperState.result.code}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Retry */}
      {state.status === 'error' && (
        <Button variant="outline" size="sm" onClick={runVerify} className="text-xs h-7">
          Retry
        </Button>
      )}
    </div>
  );
}

// ── Sub-components ──

function FieldCheck({ label, found }: { label: string; found: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={found ? 'text-verified' : 'text-destructive'}>{found ? '✓' : '✗'}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function StampDetails({ receipt, nodeUrl }: { receipt: AttestationReceiptCompat | null; nodeUrl: string }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {receipt?.nodeId && (
          <tr className="border-b border-border/40">
            <td className="py-1.5 text-muted-foreground pr-3">nodeId</td>
            <td className="py-1.5 font-mono text-right break-all">{receipt.nodeId}</td>
          </tr>
        )}
        {receipt?.attestorKeyId && (
          <tr className="border-b border-border/40">
            <td className="py-1.5 text-muted-foreground pr-3">kid</td>
            <td className="py-1.5 font-mono text-right break-all">{receipt.attestorKeyId}</td>
          </tr>
        )}
        <tr>
          <td className="py-1.5 text-muted-foreground pr-3">Keys source</td>
          <td className="py-1.5 font-mono text-[11px] text-right break-all">
            {nodeUrl}/.well-known/nexart-node.json
          </td>
        </tr>
      </tbody>
    </table>
  );
}
