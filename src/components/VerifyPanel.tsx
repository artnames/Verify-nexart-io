import { useState, useMemo } from "react";
import { Search, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Upload, Info, BookOpen, Zap, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { HashDisplay } from "./HashDisplay";
import { CanonicalRendererStatus } from "./CanonicalHealthBadge";
import { QuickGuide } from "./QuickGuide";
import { CLIExamples } from "./CLIExamples";
import { LiveVerifier } from "./LiveVerifier";
import { StartHereCard } from "./StartHereCard";
import { BundleValidator, validateBundle, detectBundleKind, EXAMPLE_STATIC_BUNDLE, resolveExpectedHash, resolveExpectedAnimationHash, formatHashForDisplay } from "./BundleValidator";
import { RendererErrorDisplay } from "./RendererErrorDisplay";
import { AICERVerifyResult } from "./AICERVerifyResult";
import { NodeAttestationSignature } from "./NodeAttestationSignature";
import { CertificationReport } from "./certification-report/CertificationReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { toast } from "sonner";
import { 
  verifyCertifiedStatic,
  verifyCertifiedLoop,
  isLoopMode,
  type CanonicalSnapshot,
  type CanonicalVerifyResponse,
} from "@/certified/canonicalClient";
import {
  verify as verifyAICER,
  hasAttestation,
  attest,
  sanitizeForAttestation,
  verifyBundleAttestation as verifyAICERBundleAttestation,
  getAttestationReceipt as getAICERAttestationReceipt,
  hasAttestation as hasAICERAttestation,
  type VerificationResult as AICERVerificationResult,
  type AttestationResult,
} from "@nexart/ai-execution";
import {
  verifyBundleAttestation as verifyCodeModeBundleAttestation,
  getAttestationReceipt as getCodeModeAttestationReceipt,
  hasAttestation as hasCodeModeAttestation,
} from "@nexart/codemode-sdk/core";
import type { AttestationVerifiers } from "./NodeAttestationSignature";
import { extractSignedReceiptEnvelope } from "@/lib/extractSignedReceipt";
import { getNodeApiKey } from "@/storage/nodeApiKey";

// ── Code Mode verification state ──
interface CodeModeVerificationState {
  kind: 'code-mode';
  status: 'verified' | 'mismatch' | 'error';
  mode: 'static' | 'loop';
  originalHash?: string;
  computedHash?: string;
  posterVerified?: boolean;
  expectedPosterHash?: string;
  computedPosterHash?: string;
  animationVerified?: boolean;
  expectedAnimationHash?: string;
  computedAnimationHash?: string;
  hashMatchType?: string;
  matchDetails?: {
    codeMatch: boolean;
    seedMatch: boolean;
    varsMatch: boolean;
    outputMatch: boolean;
  };
  error?: string;
  rendererVersion?: string;
  nodeVersion?: string;
  httpStatus?: number;
  hashSource?: string;
  animationHashSource?: string;
}

// ── AI Execution CER verification state ──
interface AICERVerificationState {
  kind: 'ai-execution';
  verifyResult: AICERVerificationResult;
  bundle: any;
  attestationPresent: boolean;
  attestationFields?: {
    attestationId?: string;
    nodeRuntimeHash?: string;
    protocolVersion?: string;
    certificateHash?: string;
  };
}

type VerificationState = CodeModeVerificationState | AICERVerificationState;

/**
 * Extract existing attestation fields from an AI CER bundle.
 */
function extractAttestationFields(bundle: any): AICERVerificationState['attestationFields'] | null {
  const att = bundle?.attestation && typeof bundle.attestation === 'object'
    ? bundle.attestation : null;

  const attestationId = att?.attestationId || att?.attestationHash || bundle?.attestationId || bundle?.attestationHash;
  const nodeRuntimeHash = att?.nodeRuntimeHash || bundle?.nodeRuntimeHash || bundle?.canonicalRuntimeHash;
  const protocolVersion = att?.protocolVersion || bundle?.canonicalProtocolVersion;

  if (!attestationId && !nodeRuntimeHash && !att) return null;
  return { attestationId, nodeRuntimeHash, protocolVersion, certificateHash: bundle?.certificateHash };
}

export function VerifyPanel() {
  const [bundleJson, setBundleJson] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationState | null>(null);
  const [activeTab, setActiveTab] = useState('verify');

  // AI CER attestation state
  const [isAttesting, setIsAttesting] = useState(false);
  const [attestResult, setAttestResult] = useState<AttestationResult | null>(null);
  const [attestError, setAttestError] = useState<string | null>(null);

  // Validation state
  const validation = useMemo(() => validateBundle(bundleJson), [bundleJson]);
  const canVerify = validation.isValid && !isVerifying;

  const handleBundleGenerated = (json: string, type?: 'static' | 'loop' | 'failed') => {
    setBundleJson(json);
    setResult(null);
    setAttestResult(null);
    setAttestError(null);
  };

  const handleLoadExample = () => {
    setBundleJson(JSON.stringify(EXAMPLE_STATIC_BUNDLE, null, 2));
    setResult(null);
  };

  // ── AI CER attestation handler ──
  const handleAttest = async () => {
    if (!result || result.kind !== 'ai-execution' || !result.verifyResult.ok) return;

    setIsAttesting(true);
    setAttestError(null);
    setAttestResult(null);

    try {
      const nodeApiKey = getNodeApiKey();
      if (!nodeApiKey) {
        setAttestError('No API key configured');
        return;
      }

      const proof = await attest(result.bundle, {
        nodeUrl: 'https://node.nexart.io',
        apiKey: nodeApiKey,
        timeoutMs: 15000,
      });

      setAttestResult(proof);
      toast.success('Canonical node attested this record');
    } catch (err: any) {
      const msg = err?.message || 'Attestation failed';
      setAttestError(msg);
      toast.error('Attestation failed', { description: msg });
    } finally {
      setIsAttesting(false);
    }
  };

  const handleVerifyBundle = async () => {
    if (!validation.isValid) return;
    
    setIsVerifying(true);
    setResult(null);
    setAttestResult(null);
    setAttestError(null);

    try {
      const bundle = JSON.parse(bundleJson);
      const bundleKind = detectBundleKind(bundle);

      // ── AI Execution CER path ──
      if (bundleKind === 'ai-execution') {
        const verifyResult = verifyAICER(bundle);
        const isAttested = hasAttestation(bundle);
        const fields = extractAttestationFields(bundle);

        setResult({
          kind: 'ai-execution',
          verifyResult,
          bundle,
          attestationPresent: isAttested,
          attestationFields: fields || undefined,
        });
        setIsVerifying(false);
        return;
      }

      // ── Code Mode path (existing logic) ──
      const snapshot: CanonicalSnapshot = bundle.snapshot;
      const isLoop = isLoopMode(snapshot);

      const resolvedHash = resolveExpectedHash(bundle);
      const resolvedAnimationHash = resolveExpectedAnimationHash(bundle);

      let verifyResult: CanonicalVerifyResponse;

      if (isLoop) {
        if (!resolvedHash || !resolvedAnimationHash) {
          setResult({
            kind: 'code-mode',
            status: 'error',
            mode: 'loop',
            error: `Loop verification requires both poster and animation hashes. Missing: ${!resolvedHash ? 'posterHash' : ''} ${!resolvedAnimationHash ? 'animationHash' : ''}`.trim(),
          });
          setIsVerifying(false);
          return;
        }
        verifyResult = await verifyCertifiedLoop(snapshot, resolvedHash.normalized, resolvedAnimationHash.normalized);
      } else {
        if (!resolvedHash) {
          setResult({
            kind: 'code-mode',
            status: 'error',
            mode: 'static',
            error: 'Bundle missing expected hash. Looked for: expectedImageHash, baseline.posterHash, baseline.imageHash, poster_hash, posterHash',
          });
          setIsVerifying(false);
          return;
        }
        verifyResult = await verifyCertifiedStatic(snapshot, resolvedHash.normalized);
      }

      const hashSource = resolvedHash?.source;
      const animationHashSource = resolvedAnimationHash?.source;

      if (verifyResult.error) {
        setResult({
          kind: 'code-mode',
          status: 'error',
          mode: verifyResult.mode,
          error: verifyResult.error,
          hashSource,
          animationHashSource,
        });
      } else if (verifyResult.verified) {
        setResult({
          kind: 'code-mode',
          status: 'verified',
          mode: verifyResult.mode,
          originalHash: verifyResult.expectedHash,
          computedHash: verifyResult.computedHash,
          posterVerified: verifyResult.posterVerified,
          expectedPosterHash: verifyResult.expectedPosterHash,
          computedPosterHash: verifyResult.computedPosterHash,
          animationVerified: verifyResult.animationVerified,
          expectedAnimationHash: verifyResult.expectedAnimationHash,
          computedAnimationHash: verifyResult.computedAnimationHash,
          hashMatchType: verifyResult.hashMatchType,
          matchDetails: {
            codeMatch: verifyResult.verified,
            seedMatch: verifyResult.verified,
            varsMatch: verifyResult.verified,
            outputMatch: verifyResult.verified,
          },
          rendererVersion: verifyResult.metadata?.rendererVersion,
          nodeVersion: verifyResult.metadata?.nodeVersion,
          hashSource,
          animationHashSource,
        });
      } else {
        setResult({
          kind: 'code-mode',
          status: 'mismatch',
          mode: verifyResult.mode,
          originalHash: verifyResult.expectedHash,
          computedHash: verifyResult.computedHash,
          posterVerified: verifyResult.posterVerified,
          expectedPosterHash: verifyResult.expectedPosterHash,
          computedPosterHash: verifyResult.computedPosterHash,
          animationVerified: verifyResult.animationVerified,
          expectedAnimationHash: verifyResult.expectedAnimationHash,
          computedAnimationHash: verifyResult.computedAnimationHash,
          hashMatchType: verifyResult.hashMatchType,
          matchDetails: {
            codeMatch: false,
            seedMatch: false,
            varsMatch: false,
            outputMatch: false,
          },
          rendererVersion: verifyResult.metadata?.rendererVersion,
          nodeVersion: verifyResult.metadata?.nodeVersion,
          hashSource,
          animationHashSource,
        });
      }
    } catch (error) {
      setResult({
        kind: 'code-mode',
        status: 'error',
        mode: 'static',
        error: error instanceof Error ? error.message : 'Failed to parse bundle JSON',
      });
    }

    setIsVerifying(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setBundleJson(content);
      setResult(null);
      setAttestResult(null);
      setAttestError(null);
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">Check & Test</h2>
          <p className="text-sm text-muted-foreground">
            Check sealed results, create proof bundles, and explore the CLI.
          </p>
        </div>
      </div>

      {/* Renderer Status with Health Badge */}
      <CanonicalRendererStatus />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            Live Checker
          </TabsTrigger>
          <TabsTrigger value="verify">Check Bundle</TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            Quick Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-6">
          <LiveVerifier />
        </TabsContent>

        <TabsContent value="guide" className="mt-6">
          <QuickGuide />
        </TabsContent>

        <TabsContent value="verify" className="mt-6 space-y-6">
          {/* Start Here Card - Primary Action */}
          <StartHereCard onBundleGenerated={handleBundleGenerated} />

          {/* Bundle Input */}
          <div>
            <label className="section-header">Artifact Bundle JSON</label>
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Bundle JSON
                    </span>
                  </Button>
                </label>
              </div>
              <textarea
                value={bundleJson}
                onChange={(e) => {
                  setBundleJson(e.target.value);
                  setResult(null);
                }}
                placeholder='Paste sealed result bundle JSON here or use "Create Result" above...'
                className="w-full h-48 px-3 py-2 rounded-md bg-input border border-border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Validation Feedback */}
            <div className="mt-3">
              <BundleValidator bundleJson={bundleJson} onLoadExample={handleLoadExample} />
            </div>

            {/* Check Button */}
            <Button 
              variant="default" 
              onClick={handleVerifyBundle}
              disabled={!canVerify}
              className="mt-4"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {validation.bundleKind === 'ai-execution' ? 'Verifying AI CER…' : 'Checking via Canonical Renderer...'}
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Check Result
                </>
              )}
            </Button>

            {/* Disabled reason hint */}
            {!canVerify && !isVerifying && bundleJson.trim() && (
              <p className="text-xs text-muted-foreground mt-2">
                Fix the validation errors above to enable checking.
              </p>
            )}
          </div>

          {/* Result */}
          {result && result.kind === 'ai-execution' && (
            <AICERVerifyResult
              verifyResult={result.verifyResult}
              bundle={result.bundle}
              attestationPresent={result.attestationPresent}
              attestationFields={result.attestationFields}
              onAttest={handleAttest}
              isAttesting={isAttesting}
              attestResult={attestResult}
              attestError={attestError}
            />
          )}

          {result && result.kind === 'code-mode' && (
            <>
              {result.status === 'error' ? (
                <RendererErrorDisplay error={result.error || 'Unknown error'} httpStatus={result.httpStatus} />
              ) : (() => {
                const parsedBundle = JSON.parse(bundleJson);
                const codeModeVerifiers: AttestationVerifiers = {
                  hasAttestation: (b: unknown) => {
                    if (hasCodeModeAttestation(b)) return true;
                    return extractSignedReceiptEnvelope(b) !== null;
                  },
                  getAttestationReceipt: (b: unknown) => {
                    const sdkReceipt = getCodeModeAttestationReceipt(b);
                    if (sdkReceipt) return sdkReceipt;
                    const envelope = extractSignedReceiptEnvelope(b);
                    if (!envelope) return null;
                    return { attestorKeyId: envelope.kid, nodeId: envelope.nodeId };
                  },
                  verifyBundleAttestation: verifyCodeModeBundleAttestation,
                };

                return (
                  <CertificationReport
                    bundle={parsedBundle}
                    bundleKind="code-mode"
                    verifyStatus={result.status === 'verified' ? 'pass' : 'fail'}
                  >
                    {/* Code Mode-specific verification details */}
                    <div className={`p-4 rounded-md border ${
                      result.status === 'verified'
                        ? 'border-verified/30 bg-verified/5'
                        : 'border-destructive/30 bg-destructive/5'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        {result.status === 'verified' ? (
                          <ShieldCheck className="w-5 h-5 text-verified" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                        )}
                        <span className="text-sm font-medium">
                          Canonical Renderer {result.status === 'verified' ? 'Match' : 'Mismatch'}
                          {result.rendererVersion && ` (v${result.rendererVersion})`}
                        </span>
                      </div>

                      {/* Mode Badge */}
                      <div className="mb-3 flex gap-2 flex-wrap">
                        <span className="text-xs font-mono px-2 py-1 rounded bg-muted">
                          mode: {result.mode}
                        </span>
                        {result.hashMatchType && (
                          <span className="text-xs font-mono px-2 py-1 rounded bg-muted">
                            hashMatchType: {result.hashMatchType}
                          </span>
                        )}
                      </div>

                      {/* Loop Mode Details */}
                      {result.mode === 'loop' && (
                        <div className="space-y-3 mb-3 p-3 rounded-md bg-card border border-border">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Poster</span>
                              <span className={result.posterVerified ? 'text-verified' : 'text-destructive'}>
                                {result.posterVerified ? (
                                  <span className="flex items-center gap-1 text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Failed
                                  </span>
                                )}
                              </span>
                            </div>
                            {result.expectedPosterHash && (
                              <div>
                                <span className="text-xs text-muted-foreground">Expected</span>
                                <HashDisplay hash={result.expectedPosterHash} truncate={false} className="mt-1" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 pt-2 border-t border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Animation</span>
                              <span className={result.animationVerified ? 'text-verified' : 'text-destructive'}>
                                {result.animationVerified ? (
                                  <span className="flex items-center gap-1 text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Failed
                                  </span>
                                )}
                              </span>
                            </div>
                            {result.expectedAnimationHash && (
                              <div>
                                <span className="text-xs text-muted-foreground">Expected</span>
                                <HashDisplay hash={result.expectedAnimationHash} truncate={false} className="mt-1" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Static mode hash display */}
                      {result.mode === 'static' && result.originalHash && result.computedHash && (
                        <div className="space-y-2 mt-3 pt-3 border-t border-border">
                          <div>
                            <span className="text-xs text-muted-foreground">Expected Hash</span>
                            <HashDisplay hash={result.originalHash} truncate={false} className="mt-1" />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Computed Hash</span>
                            <HashDisplay hash={result.computedHash} truncate={false} className="mt-1" />
                          </div>
                        </div>
                      )}

                      {result.nodeVersion && (
                        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                          Node: {result.nodeVersion}
                        </div>
                      )}
                    </div>

                    {/* Node Attestation Signature */}
                    <NodeAttestationSignature
                      bundle={parsedBundle}
                      verifiers={codeModeVerifiers}
                    />
                  </CertificationReport>
                );
              })()}
            </>
          )}

          {/* CLI Examples */}
          <CLIExamples />

          {/* Instructions */}
          <div className="p-4 rounded-md bg-card border border-border">
            <h4 className="font-medium text-sm mb-2">How Verification Works</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Upload or paste a certified artifact bundle JSON</li>
              <li>Recânon auto-detects the bundle type (Code Mode or AI Execution CER)</li>
              <li><strong>Code Mode:</strong> Bundle is sent to Canonical Renderer for re-execution and hash comparison</li>
              <li><strong>AI Execution CER:</strong> Verified locally using @nexart/ai-execution SDK (certificate hash + input/output hashes)</li>
              <li>Any discrepancy = FAILED with reason code</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>AI CER attestation</strong> can optionally be requested to have the NexArt canonical node verify internal consistency. This requires an API key.
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              No authentication required for verification. Anyone can verify any certified artifact.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
