/**
 * Project Bundle Verification Page
 *
 * Displays project-level verification status and ordered certified steps.
 * Allows drill-down into individual step CER details, reusing AICERVerifyResult
 * and CertificationReport for step-level trust surfaces.
 *
 * ARCHITECTURE: All verification semantics come from verifyProjectBundle()
 * exported by @nexart/ai-execution. The frontend does NOT own verification
 * logic — it consumes and presents canonical results.
 *
 * Node receipt verification is performed browser-side using WebCrypto
 * against the node's published public key.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { recertifyAICER } from '@/api/aiCerRecertification';
import type { AICERBundle } from '@/types/aiCerBundle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Layers,
  ArrowRight,
  Hash,
  Clock,
  FileJson,
  ChevronDown,
  ChevronUp,
  Cpu,
  Tag,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ProjectBundle,
} from '@nexart/ai-execution';
import {
  verifyProjectBundleBrowser,
  type ProjectBundleVerifyResult,
  type ProjectBundleStepVerifyResult,
} from '@/lib/verifyProjectBundleBrowser';
import { AICERVerifyResult } from '@/components/AICERVerifyResult';
import { CertificationReport } from '@/components/certification-report/CertificationReport';
import { useSEO } from '@/hooks/useSEO';
import type { NodeReceipt, NodeReceiptVerifyResult } from '@/lib/verifyNodeReceipt';

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

interface ProjectBundlePageProps {
  projectBundle?: ProjectBundle | null;
  nodeReceipt?: NodeReceipt | null;
  nodeReceiptResult?: NodeReceiptVerifyResult | null;
}

export function ProjectBundlePage({ projectBundle: propBundle, nodeReceipt, nodeReceiptResult }: ProjectBundlePageProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state as { projectBundle?: ProjectBundle } | null;
  const projectBundle = propBundle ?? routerState?.projectBundle ?? null;

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<ProjectBundleVerifyResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isAttesting, setIsAttesting] = useState(false);
  const [stepAttestResult, setStepAttestResult] = useState<any>(null);
  const [stepAttestError, setStepAttestError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  useSEO({
    title: projectBundle?.projectTitle
      ? `${projectBundle.projectTitle} — Project Verification | verify.nexart.io`
      : 'Project Bundle Verification | verify.nexart.io',
    description: 'Verify a NexArt project bundle containing multiple certified execution records.',
    path: '/project',
  });

  // Ordered step registry (by sequence)
  const orderedSteps = useMemo(
    () => projectBundle
      ? [...projectBundle.stepRegistry].sort((a, b) => a.sequence - b.sequence)
      : [],
    [projectBundle]
  );

  // Run canonical verification on mount
  useEffect(() => {
    if (!projectBundle) return;
    let cancelled = false;

    setIsVerifying(true);
    verifyProjectBundleBrowser(projectBundle)
      .then(result => {
        if (!cancelled) setVerifyResult(result);
      })
      .catch(err => {
        if (!cancelled) {
          setVerifyResult({
            ok: false,
            code: 'SCHEMA_ERROR',
            errors: [err instanceof Error ? err.message : 'Unknown verification error'],
            steps: [],
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsVerifying(false);
      });

    return () => { cancelled = true; };
  }, [projectBundle]);

  // Build a lookup map from stepId to per-step verify result
  const stepResultMap = useMemo(() => {
    const map = new Map<string, ProjectBundleStepVerifyResult>();
    if (verifyResult?.steps) {
      for (const sr of verifyResult.steps) {
        map.set(sr.stepId, sr);
      }
    }
    return map;
  }, [verifyResult]);

  const handleBack = useCallback(() => {
    if (selectedStepId !== null) {
      setSelectedStepId(null);
    } else {
      navigate('/');
    }
  }, [selectedStepId, navigate]);

  // Not found / no bundle
  if (!projectBundle) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center py-8">
              <AlertTriangle className="w-12 h-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold">No Project Bundle</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a project bundle from the home page to verify it.
                </p>
              </div>
              <Button onClick={() => navigate('/')}>Go to Verifier</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Derive display values from canonical verification result
  const totalSteps = verifyResult?.totalSteps ?? projectBundle.totalSteps;
  const passedCount = verifyResult?.passedSteps ?? 0;
  const failedCount = verifyResult?.failedSteps ?? 0;

  const overallStatus: 'pass' | 'fail' | 'partial' | 'pending' = isVerifying
    ? 'pending'
    : verifyResult?.ok
      ? 'pass'
      : (verifyResult && failedCount > 0 && passedCount > 0)
        ? 'partial'
        : 'fail';

  // Step detail drill-down
  if (selectedStepId !== null) {
    const stepEntry = orderedSteps.find(s => s.stepId === selectedStepId);
    const stepIdx = orderedSteps.findIndex(s => s.stepId === selectedStepId);
    const embeddedBundle = stepEntry ? projectBundle.embeddedBundles[stepEntry.stepId] : null;
    const stepResult = stepEntry ? stepResultMap.get(stepEntry.stepId) : undefined;

    if (!stepEntry || !embeddedBundle) {
      setSelectedStepId(null);
      return null;
    }

    // Map step verification result to the CER detail view's expected format
    const verifyStatus: 'pass' | 'fail' | 'error' | 'degraded' =
      stepResult?.ok ? 'pass' : 'fail';

    return (
      <div className="max-w-6xl mx-auto space-y-6 px-6 pb-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Project Overview
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">
            Step {stepEntry.sequence} — {stepEntry.stepLabel}
          </span>
        </div>

        {/* Project context bar */}
        <div className="rounded-lg border border-border/60 bg-muted/5 px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>
            Viewing step {stepEntry.sequence + 1} of {totalSteps} in project{' '}
            <strong className="text-foreground">{projectBundle.projectTitle}</strong>
          </span>
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-[10px] h-5",
              overallStatus === 'pass' && "border-verified text-verified",
              overallStatus === 'partial' && "border-warning text-warning",
              overallStatus === 'fail' && "border-destructive text-destructive",
            )}
          >
            Project: {overallStatus === 'pass' ? 'Verified' : overallStatus === 'partial' ? 'Partial' : 'Failed'}
          </Badge>
        </div>

        {/* Step-level verification error details from canonical result */}
        {stepResult && !stepResult.ok && stepResult.errors.length > 0 && (
          <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 space-y-1">
            <p className="text-sm font-medium text-destructive">Step Verification Failed — {stepResult.code}</p>
            {stepResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive">{e}</p>
            ))}
          </div>
        )}

        {/* Reuse existing CER detail view for the embedded bundle */}
        <AICERVerifyResult
          verifyResult={{
            ok: stepResult?.ok ?? false,
            code: (stepResult?.code ?? 'UNKNOWN_ERROR') as any,
            errors: stepResult?.errors ?? [],
            details: [],
          } as any}
          bundle={embeddedBundle}
          attestationPresent={false}
        />
      </div>
    );
  }

  // Project overview
  return (
    <div className="max-w-6xl mx-auto space-y-6 px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Verifier
        </Button>
      </div>

      {/* ============================================ */}
      {/* PROJECT OVERVIEW                             */}
      {/* ============================================ */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Project Bundle Verification</CardTitle>
          </div>
          <CardDescription className="text-sm leading-relaxed mt-2">
            This artifact contains multiple individually certified executions grouped under a single project.
            Each step has its own certification, and the project bundle provides structural integrity over the whole set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall status — derived from canonical verifyProjectBundle() result */}
          <div className="flex items-center gap-3">
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Verifying project bundle…</span>
              </>
            ) : overallStatus === 'pass' ? (
              <>
                <ShieldCheck className="w-6 h-6 text-verified" />
                <div>
                  <p className="text-sm font-semibold text-verified">Fully Verified</p>
                  <p className="text-xs text-muted-foreground">All steps passed verification and project structure is valid.</p>
                </div>
              </>
            ) : overallStatus === 'partial' ? (
              <>
                <ShieldAlert className="w-6 h-6 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-warning">Partially Verified</p>
                  <p className="text-xs text-muted-foreground">{passedCount} of {totalSteps} steps passed. Review individual results below.</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Verification Failed</p>
                  <p className="text-xs text-muted-foreground">
                    {verifyResult?.code || 'Unknown failure'}{verifyResult?.errors?.length ? ` — ${verifyResult.errors[0]}` : ''}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Canonical verification errors */}
          {verifyResult && !verifyResult.ok && verifyResult.errors.length > 0 && (
            <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 space-y-1">
              <p className="text-sm font-medium text-destructive">Verification Errors</p>
              {verifyResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">{e}</p>
              ))}
            </div>
          )}

          {/* Key fields grid — presentation only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <MetaField label="Project Title" value={projectBundle.projectTitle} icon={<FileText className="w-3.5 h-3.5" />} />
            <MetaField label="Project Bundle ID" value={projectBundle.projectBundleId} mono icon={<Hash className="w-3.5 h-3.5" />} />
            <MetaField label="Protocol Version" value={projectBundle.protocolVersion} />
            <MetaField label="Artifact Version" value={projectBundle.version} />
            <MetaField label="Started At" value={formatDate(projectBundle.startedAt)} icon={<Clock className="w-3.5 h-3.5" />} />
            <MetaField label="Completed At" value={formatDate(projectBundle.completedAt)} icon={<Clock className="w-3.5 h-3.5" />} />
            <MetaField label="Total Steps" value={String(totalSteps)} />
            <MetaField
              label="Passed / Failed"
              value={isVerifying ? 'Verifying…' : `${passedCount} passed · ${failedCount} failed`}
              valueColor={!isVerifying && failedCount > 0 ? 'text-warning' : !isVerifying ? 'text-verified' : undefined}
            />
            {projectBundle.appName && (
              <MetaField label="Application" value={projectBundle.appName} icon={<Cpu className="w-3.5 h-3.5" />} />
            )}
            {projectBundle.frameworkName && (
              <MetaField label="Framework" value={projectBundle.frameworkName} />
            )}
          </div>

          {/* Project hash validity — from canonical result */}
          {verifyResult && verifyResult.projectHashValid !== undefined && (
            <div className={cn(
              "p-3 rounded-md border text-sm",
              verifyResult.projectHashValid
                ? "border-verified/30 bg-verified/5"
                : "border-destructive/30 bg-destructive/5"
            )}>
              <div className="flex items-center gap-2 mb-1">
                {verifyResult.projectHashValid ? (
                  <CheckCircle2 className="w-4 h-4 text-verified" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="font-medium">
                  Project Hash: {verifyResult.projectHashValid ? 'Valid' : 'Mismatch'}
                </span>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {projectBundle.integrity.projectHash}
              </p>
            </div>
          )}

          {/* Structural validity — from canonical result */}
          {verifyResult && verifyResult.structuralValid !== undefined && !verifyResult.structuralValid && (
            <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="font-medium text-destructive">Structural Validation Failed</span>
              </div>
            </div>
          )}

          {/* Node Receipt — independent verification of node endorsement */}
          {nodeReceipt && nodeReceiptResult && (
            <div className={cn(
              "p-3 rounded-md border text-sm",
              nodeReceiptResult.status === 'valid'
                ? "border-verified/30 bg-verified/5"
                : nodeReceiptResult.status === 'invalid'
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-muted/5"
            )}>
              <div className="flex items-center gap-2 mb-1">
                {nodeReceiptResult.status === 'valid' ? (
                  <CheckCircle2 className="w-4 h-4 text-verified" />
                ) : nodeReceiptResult.status === 'invalid' ? (
                  <XCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-medium">
                  Node Receipt: {nodeReceiptResult.status === 'valid' ? 'Verified' : nodeReceiptResult.status === 'invalid' ? 'Invalid' : 'Not Verified'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{nodeReceiptResult.detail}</p>
              {nodeReceiptResult.kid && (
                <p className="text-xs font-mono text-muted-foreground mt-1">Key: {nodeReceiptResult.kid}</p>
              )}
              {nodeReceiptResult.signedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">Signed: {formatDate(nodeReceiptResult.signedAt)}</p>
              )}
            </div>
          )}

          {/* Goal / Summary / Final output — presentation only */}
          {projectBundle.projectGoal && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Project Goal</p>
              <p className="text-sm">{projectBundle.projectGoal}</p>
            </div>
          )}
          {projectBundle.projectSummary && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Summary</p>
              <p className="text-sm">{projectBundle.projectSummary}</p>
            </div>
          )}
          {projectBundle.finalOutputSummary && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Final Output</p>
              <p className="text-sm">{projectBundle.finalOutputSummary}</p>
            </div>
          )}

          {/* Tags */}
          {projectBundle.tags && projectBundle.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              {projectBundle.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* CERTIFIED STEPS                              */}
      {/* ============================================ */}
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Certified Steps ({totalSteps})
        </h2>
      </div>

      <div className="space-y-2">
        {orderedSteps.map((step) => {
          const stepVR = stepResultMap.get(step.stepId);
          const status: 'pass' | 'fail' | 'pending' = !stepVR
            ? 'pending'
            : stepVR.ok ? 'pass' : 'fail';

          return (
            <Card
              key={step.stepId}
              className={cn(
                "cursor-pointer hover:border-primary/40 transition-colors",
                status === 'fail' && "border-destructive/30",
              )}
              onClick={() => setSelectedStepId(step.stepId)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Sequence badge */}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-bold shrink-0">
                    {step.sequence}
                  </div>

                  {/* Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{step.stepLabel}</span>
                      <Badge variant="outline" className="text-[10px] h-4 shrink-0">{step.stepType}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono truncate max-w-[180px]">{step.executionId}</span>
                      <span className="font-mono truncate max-w-[160px]">
                        {step.certificateHash.slice(0, 24)}…
                      </span>
                      {step.recordedAt && (
                        <span className="shrink-0">{formatDate(step.recordedAt)}</span>
                      )}
                      {step.modelIdentity && (
                        <span className="shrink-0">
                          {step.modelIdentity.provider}/{step.modelIdentity.model}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status — from canonical per-step result */}
                  <div className="shrink-0">
                    {status === 'pending' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : status === 'pass' ? (
                      <CheckCircle2 className="w-5 h-5 text-verified" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ============================================ */}
      {/* RAW JSON / DIAGNOSTICS                       */}
      {/* ============================================ */}
      <div className="pt-2">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileJson className="w-3.5 h-3.5" />
          <span>Raw project bundle JSON</span>
          {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showRawJson && (
          <pre className="mt-2 p-4 rounded-lg bg-muted text-xs font-mono overflow-auto max-h-96 border">
            {JSON.stringify(projectBundle, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Presentation helpers — no verification semantics                          */
/* -------------------------------------------------------------------------- */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function MetaField({
  label,
  value,
  mono,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={cn("text-sm font-medium break-all", mono && "font-mono text-xs", valueColor)}>
        {value}
      </p>
    </div>
  );
}
