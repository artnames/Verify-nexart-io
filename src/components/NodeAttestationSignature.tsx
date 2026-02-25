/**
 * Node Attestation Signature — Offline verification of node-signed receipts
 *
 * Accepts injected verifier functions so callers can provide the correct SDK:
 *  - @nexart/codemode-sdk/core for Code Mode bundles
 *  - @nexart/ai-execution for AI Execution CER bundles
 *
 * Steps:
 *  1. Fetch node keys from /.well-known/nexart-node.json
 *  2. Verify receipt signature offline (Ed25519)
 *  3. Cross-check receipt.certificateHash vs bundle.certificateHash
 *
 * Includes a "Tamper (demo)" toggle that flips a character in the receipt
 * to prove tamper resistance — without mutating the original bundle.
 */

import { useState, useCallback } from 'react';
import {
  ShieldCheck, ShieldAlert, Info, ChevronDown, Key, Globe, ToggleLeft, ToggleRight,
  Loader2, AlertTriangle, Search,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { cn } from '@/lib/utils';
import { probeReceiptFields, type ReceiptFieldProbe } from '@/lib/extractSignedReceipt';

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
  /** Returns true if the bundle carries any attestation data */
  hasAttestation: (bundle: unknown) => boolean;
  /** Extracts normalised receipt from any bundle layout */
  getAttestationReceipt: (bundle: unknown) => AttestationReceiptCompat | null;
  /** Fully verifies node receipt signature offline */
  verifyBundleAttestation: (bundle: unknown, options: { nodeUrl: string; kid?: string }) => Promise<NodeReceiptVerifyResultCompat>;
}

interface NodeAttestationSignatureProps {
  /** The full bundle object (Code Mode or AI CER) */
  bundle: unknown;
  /** Injected verifier functions from the correct SDK */
  verifiers: AttestationVerifiers;
  /** Optional custom node URL */
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
  const [showDetails, setShowDetails] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const receipt = verifiers.getAttestationReceipt(bundle);
  const hasReceipt = verifiers.hasAttestation(bundle) && receipt !== null;

  // ── Run verification (original) ──
  const runVerify = useCallback(async () => {
    if (!hasReceipt) {
      // Probe for partial fields to give helpful diagnostics
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
      const result = await verifiers.verifyBundleAttestation(bundle, { nodeUrl: resolvedNodeUrl });
      if (result.ok) {
        setState({ status: 'verified', result, receipt: receipt! });
      } else {
        // Check if the SDK returned a missing-receipt code even though hasAttestation was true
        if (result.code === 'NODE_RECEIPT_MISSING') {
          const probe = probeReceiptFields(bundle);
          setState({ status: 'missing-fields', probe });
        } else {
          setState({ status: 'failed', result, receipt: receipt! });
        }
      }
    } catch (err: any) {
      setState({ status: 'error', message: err?.message || 'Verification failed' });
    }
  }, [bundle, hasReceipt, receipt, resolvedNodeUrl, verifiers]);

  // ── Tamper demo ──
  const runTamper = useCallback(async () => {
    if (!hasReceipt || !receipt) return;

    const tampered = JSON.parse(JSON.stringify(bundle)) as any;

    const att = tampered.attestation || tampered;
    if (att.receipt && typeof att.receipt === 'object') {
      const rct = att.receipt;
      if (rct.certificateHash && typeof rct.certificateHash === 'string') {
        const ch = rct.certificateHash;
        rct.certificateHash = (ch[0] === 'a' ? 'b' : 'a') + ch.slice(1);
      }
    } else if (att.attestation && typeof att.attestation === 'object') {
      const inner = att.attestation;
      if (inner.certificateHash && typeof inner.certificateHash === 'string') {
        const ch = inner.certificateHash;
        inner.certificateHash = (ch[0] === 'a' ? 'b' : 'a') + ch.slice(1);
      }
    }
    if (tampered.attestation?.signatureB64Url) {
      const sig = tampered.attestation.signatureB64Url;
      tampered.attestation.signatureB64Url = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    }

    try {
      const result = await verifiers.verifyBundleAttestation(tampered, { nodeUrl: resolvedNodeUrl });
      if (result.ok) {
        setTamperState({ status: 'verified', result, receipt: receipt! });
      } else {
        setTamperState({ status: 'failed', result, receipt: receipt! });
      }
    } catch (err: any) {
      setTamperState({ status: 'error', message: err?.message || 'Tamper verification failed' });
    }
  }, [bundle, hasReceipt, receipt, resolvedNodeUrl, verifiers]);

  const handleTamperToggle = async () => {
    if (!tamperActive) {
      setTamperActive(true);
      await runTamper();
    } else {
      setTamperActive(false);
      setTamperState(null);
    }
  };

  // Auto-verify on first render if receipt is present
  const handleAutoVerify = useCallback(() => {
    if (state.status === 'idle') {
      runVerify();
    }
  }, [state.status, runVerify]);

  // Trigger auto-verify
  if (state.status === 'idle' && hasReceipt) {
    handleAutoVerify();
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
    <Card className={cn("border", className,
      displayState.status === 'verified' && "border-verified/30 bg-verified/5",
      displayState.status === 'failed' && "border-destructive/30 bg-destructive/5",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {displayState.status === 'verified' ? (
              <ShieldCheck className="w-4 h-4 text-verified" />
            ) : displayState.status === 'failed' ? (
              <ShieldAlert className="w-4 h-4 text-destructive" />
            ) : (
              <Key className="w-4 h-4 text-muted-foreground" />
            )}
            <span>Node Attestation Signature</span>
          </div>
          <div className="flex items-center gap-2">
            {displayState.status === 'verified' && (
              <Badge className="bg-verified text-verified-foreground text-xs">
                ✅ Signature Verified (Offline)
              </Badge>
            )}
            {displayState.status === 'failed' && (
              <Badge variant="destructive" className="text-xs">
                ❌ Invalid Signature
              </Badge>
            )}
            {displayState.status === 'no-receipt' && (
              <Badge variant="secondary" className="text-xs">Not present</Badge>
            )}
            {displayState.status === 'missing-fields' && (
              <Badge variant="secondary" className="text-xs">Missing fields</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Loading */}
        {displayState.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying signature offline…</span>
          </div>
        )}

        {/* No receipt at all */}
        {displayState.status === 'no-receipt' && (
          <p className="text-xs text-muted-foreground">
            This bundle has no signed receipt fields (receipt/signature/kid). It may have been attested before signed receipts were enabled, or the producer did not persist the receipt.
          </p>
        )}

        {/* Missing fields — partial attestation data found */}
        {displayState.status === 'missing-fields' && 'probe' in displayState && (
          <MissingFieldsPanel probe={displayState.probe} />
        )}

        {/* Verified */}
        {displayState.status === 'verified' && (
          <VerifiedDetails receipt={receipt} resolvedNodeUrl={resolvedNodeUrl} />
        )}

        {/* Failed */}
        {displayState.status === 'failed' && 'result' in displayState && (
          <FailedDetails result={displayState.result} receipt={receipt} />
        )}

        {/* Error */}
        {displayState.status === 'error' && 'message' in displayState && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm font-medium text-destructive">Signature verification error</p>
            <p className="text-xs text-muted-foreground mt-1">{displayState.message}</p>
          </div>
        )}

        {/* Details collapsible */}
        {displayState.status === 'verified' && 'result' in displayState && displayState.result.details && displayState.result.details.length > 0 && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <ChevronDown className={cn("w-3 h-3 transition-transform", showDetails && "rotate-180")} />
              <span>Details ({displayState.result.details.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 text-xs font-mono bg-muted/50 p-3 rounded">
              {displayState.result.details.map((d, i) => (
                <div key={i} className="text-muted-foreground">{d}</div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Tamper demo toggle */}
        {hasReceipt && (state.status === 'verified' || state.status === 'failed') && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              variant={tamperActive ? "destructive" : "outline"}
              size="sm"
              onClick={handleTamperToggle}
              className="gap-2"
            >
              {tamperActive ? (
                <>
                  <ToggleRight className="w-4 h-4" />
                  Tamper (demo) — ON
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  Tamper (demo)
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {tamperActive
                ? "Viewing tampered copy — flipped receipt hash to prove detection. Original bundle is unchanged."
                : "Flip a character in the receipt to prove tamper resistance."}
            </p>
            {tamperActive && tamperState?.status === 'failed' && 'result' in tamperState && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <span className="text-destructive font-mono">{tamperState.result.code}</span>
                <span className="text-muted-foreground">— tamper detected as expected</span>
              </div>
            )}
          </div>
        )}

        {/* Retry button for errors */}
        {state.status === 'error' && (
          <Button variant="outline" size="sm" onClick={runVerify} className="mt-2">
            Retry verification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Sub-components ──

function MissingFieldsPanel({ probe }: { probe: ReceiptFieldProbe }) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="space-y-2">
      <div className="p-3 rounded-md bg-muted/50 border border-border">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Attestation present, but signed receipt fields are missing.
            </p>
            <p className="text-xs text-muted-foreground">
              Expected <code className="font-mono">receipt</code> + <code className="font-mono">signature</code> + <code className="font-mono">kid</code> to verify offline.
              This bundle may have been attested before signed receipts were enabled, or the producer did not persist the full receipt envelope.
            </p>
          </div>
        </div>
      </div>

      <Collapsible open={showDebug} onOpenChange={setShowDebug}>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
          <Search className="w-3 h-3" />
          <span>Debug: Field Probe</span>
          <ChevronDown className={cn("w-3 h-3 transition-transform ml-auto", showDebug && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 text-xs font-mono bg-muted/50 p-3 rounded space-y-1">
          {probe.foundIn && (
            <div className="text-muted-foreground mb-2">
              Searched in: <code className="text-foreground">{probe.foundIn}</code>
            </div>
          )}
          <FieldStatus label="attestationId" found={probe.hasAttestationId} />
          <FieldStatus label="receipt" found={probe.hasReceipt} />
          <FieldStatus label="signature" found={probe.hasSignature} />
          <FieldStatus label="kid (attestorKeyId)" found={probe.hasKid} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function FieldStatus({ label, found }: { label: string; found: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={found ? 'text-verified' : 'text-destructive'}>
        {found ? '✓' : '✗'}
      </span>
      <span className="text-muted-foreground">{label}:</span>
      <span className={found ? 'text-verified' : 'text-muted-foreground'}>
        {found ? 'found' : 'missing'}
      </span>
    </div>
  );
}

function VerifiedDetails({ receipt, resolvedNodeUrl }: { receipt: AttestationReceiptCompat | null; resolvedNodeUrl: string }) {
  return (
    <div className="space-y-2 text-xs">
      {receipt?.nodeId && (
        <div className="flex items-start gap-2">
          <Globe className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <span className="text-muted-foreground">nodeId: </span>
            <code className="font-mono break-all">{receipt.nodeId}</code>
          </div>
        </div>
      )}
      {receipt?.attestorKeyId && (
        <div className="flex items-start gap-2">
          <Key className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <span className="text-muted-foreground">kid: </span>
            <code className="font-mono break-all">{receipt.attestorKeyId}</code>
          </div>
        </div>
      )}
      <div className="flex items-start gap-2">
        <Info className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <span className="text-muted-foreground">Keys source: </span>
          <code className="font-mono text-xs break-all">
            {resolvedNodeUrl}/.well-known/nexart-node.json
          </code>
        </div>
      </div>
    </div>
  );
}

function FailedDetails({ result, receipt }: { result: NodeReceiptVerifyResultCompat; receipt: AttestationReceiptCompat | null }) {
  return (
    <div className="space-y-2">
      <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
        <p className="text-sm font-medium text-destructive font-mono">{result.code}</p>
        {result.details && result.details.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
            {result.details.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        )}
      </div>
      {receipt?.nodeId && (
        <div className="flex items-start gap-2 text-xs">
          <Globe className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">nodeId: <code className="font-mono">{receipt.nodeId}</code></span>
        </div>
      )}
    </div>
  );
}
