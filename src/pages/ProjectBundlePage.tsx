/**
 * Project Bundle Verification Page
 *
 * Displays project-level verification status and ordered certified steps.
 * Allows drill-down into individual step CER details, reusing AICERVerifyResult
 * and CertificationReport for step-level trust surfaces.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Target,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isAICERBundle } from '@/types/aiCerBundle';
import {
  isProjectBundle,
  validateProjectBundleStructure,
  sortStepsBySequence,
  type ProjectBundleManifest,
  type ProjectBundleStep,
} from '@/types/projectBundle';
import { verifyUploadedBundleAsync, type BundleVerifyResult } from '@/lib/verifyBundle';
import { AICERVerifyResult } from '@/components/AICERVerifyResult';
import { CertificationReport } from '@/components/certification-report/CertificationReport';
import { useSEO } from '@/hooks/useSEO';

/* -------------------------------------------------------------------------- */
/*  Project-level hash verification (WebCrypto)                               */
/* -------------------------------------------------------------------------- */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyProjectHash(bundle: ProjectBundleManifest): Promise<{
  valid: boolean;
  computed?: string;
  expected?: string;
}> {
  const expected = bundle.projectHash;
  if (!expected || typeof expected !== 'string') {
    return { valid: false };
  }

  // Project hash = SHA-256 of ordered step certificate hashes joined by '|'
  const orderedSteps = sortStepsBySequence(bundle.steps);
  const hashInput = orderedSteps
    .map(s => s.certificateHash || (s.bundle as any)?.certificateHash || '')
    .join('|');

  const computed = `sha256:${await sha256Hex(hashInput)}`;
  const normalizedExpected = expected.toLowerCase();

  return {
    valid: computed === normalizedExpected,
    computed,
    expected: normalizedExpected,
  };
}

/* -------------------------------------------------------------------------- */
/*  Step verification                                                         */
/* -------------------------------------------------------------------------- */

interface StepVerification {
  step: ProjectBundleStep;
  result: BundleVerifyResult | null;
  status: 'pass' | 'fail' | 'error' | 'pending';
}

async function verifyAllSteps(steps: ProjectBundleStep[]): Promise<StepVerification[]> {
  const results: StepVerification[] = [];
  for (const step of steps) {
    try {
      const result = await verifyUploadedBundleAsync(step.bundle);
      results.push({
        step,
        result,
        status: result.ok ? 'pass' : (result.degraded ? 'pass' : 'fail'),
      });
    } catch {
      results.push({
        step,
        result: null,
        status: 'error',
      });
    }
  }
  return results;
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

export function ProjectBundlePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state as { projectBundle?: ProjectBundleManifest } | null;
  const projectBundle = routerState?.projectBundle ?? null;

  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [stepVerifications, setStepVerifications] = useState<StepVerification[]>([]);
  const [projectHashResult, setProjectHashResult] = useState<{ valid: boolean; computed?: string; expected?: string } | null>(null);
  const [structureResult, setStructureResult] = useState<ReturnType<typeof validateProjectBundleStructure> | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);

  useSEO({
    title: projectBundle?.title
      ? `${projectBundle.title} — Project Verification | verify.nexart.io`
      : 'Project Bundle Verification | verify.nexart.io',
    description: 'Verify a NexArt project bundle containing multiple certified execution records.',
    path: '/project',
  });

  const sortedSteps = useMemo(
    () => projectBundle ? sortStepsBySequence(projectBundle.steps) : [],
    [projectBundle]
  );

  // Run verification on mount
  useEffect(() => {
    if (!projectBundle) return;

    async function run() {
      setIsVerifying(true);

      const structure = validateProjectBundleStructure(projectBundle);
      setStructureResult(structure);

      const [hashResult, stepResults] = await Promise.all([
        verifyProjectHash(projectBundle!),
        verifyAllSteps(sortStepsBySequence(projectBundle!.steps)),
      ]);

      setProjectHashResult(hashResult);
      setStepVerifications(stepResults);
      setIsVerifying(false);
    }

    run();
  }, [projectBundle]);

  const passedCount = stepVerifications.filter(s => s.status === 'pass').length;
  const failedCount = stepVerifications.filter(s => s.status === 'fail' || s.status === 'error').length;
  const totalSteps = sortedSteps.length;

  const overallStatus: 'pass' | 'fail' | 'partial' | 'pending' = isVerifying
    ? 'pending'
    : (structureResult?.valid === false)
      ? 'fail'
      : (failedCount === 0 && passedCount === totalSteps)
        ? 'pass'
        : failedCount === totalSteps
          ? 'fail'
          : 'partial';

  const handleBack = useCallback(() => {
    if (selectedStepIndex !== null) {
      setSelectedStepIndex(null);
    } else {
      navigate('/');
    }
  }, [selectedStepIndex, navigate]);

  // Not found
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

  // Step detail drill-down
  if (selectedStepIndex !== null) {
    const sv = stepVerifications[selectedStepIndex];
    const step = sortedSteps[selectedStepIndex];
    if (!step) {
      setSelectedStepIndex(null);
      return null;
    }

    const stepBundle = step.bundle as Record<string, unknown>;
    const isAiCer = isAICERBundle(stepBundle);
    const vResult = sv?.result;

    const verifyStatus: 'pass' | 'fail' | 'error' | 'degraded' =
      vResult?.ok ? 'pass'
        : vResult?.degraded ? 'degraded'
          : vResult ? 'fail'
            : 'error';

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
            Step {step.sequence}{step.label ? ` — ${step.label}` : step.title ? ` — ${step.title}` : ''}
          </span>
        </div>

        {/* Project context bar */}
        <div className="rounded-lg border border-border/60 bg-muted/5 px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>
            Viewing step {step.sequence} of {totalSteps} in project{' '}
            <strong className="text-foreground">{projectBundle.title || projectBundle.projectId}</strong>
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

        {/* Step CER detail — reuse existing trust surface */}
        {isAiCer ? (
          <AICERVerifyResult
            verifyResult={{
              ok: vResult?.ok ?? false,
              code: (vResult?.code ?? 'ERROR') as any,
              errors: vResult?.errors ?? [],
              details: vResult?.details ?? [],
              degraded: vResult?.degraded,
            }}
            bundle={stepBundle}
            attestationPresent={false}
            contextIntegrityProtected={vResult?.contextIntegrityProtected}
          />
        ) : (
          <CertificationReport
            bundle={stepBundle}
            bundleKind="code-mode"
            verifyStatus={verifyStatus}
            verifyCode={vResult?.code}
            verifyDetails={vResult?.details}
            contextIntegrityProtected={vResult?.contextIntegrityProtected}
          />
        )}
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
          {/* Overall status */}
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
                  <p className="text-xs text-muted-foreground">Some steps failed verification. Review individual results below.</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Verification Failed</p>
                  <p className="text-xs text-muted-foreground">
                    {structureResult?.valid === false
                      ? 'Project bundle structure is invalid.'
                      : 'Step verification failed.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Structure errors */}
          {structureResult && !structureResult.valid && (
            <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 space-y-1">
              <p className="text-sm font-medium text-destructive">Structure Errors</p>
              {structureResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">{e}</p>
              ))}
            </div>
          )}
          {structureResult && structureResult.warnings.length > 0 && (
            <div className="p-3 rounded-md border border-warning/30 bg-warning/10 space-y-1">
              <p className="text-sm font-medium text-warning">Warnings</p>
              {structureResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-warning">{w}</p>
              ))}
            </div>
          )}

          {/* Key fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectBundle.title && (
              <MetaField label="Project Title" value={projectBundle.title} icon={<FileText className="w-3.5 h-3.5" />} />
            )}
            <MetaField label="Project ID" value={projectBundle.projectId} mono icon={<Hash className="w-3.5 h-3.5" />} />
            {projectBundle.protocolVersion && (
              <MetaField label="Protocol Version" value={projectBundle.protocolVersion} />
            )}
            {projectBundle.version && (
              <MetaField label="Artifact Version" value={projectBundle.version} />
            )}
            {projectBundle.startedAt && (
              <MetaField label="Started At" value={formatDate(projectBundle.startedAt)} icon={<Clock className="w-3.5 h-3.5" />} />
            )}
            {projectBundle.completedAt && (
              <MetaField label="Completed At" value={formatDate(projectBundle.completedAt)} icon={<Clock className="w-3.5 h-3.5" />} />
            )}
            <MetaField label="Total Steps" value={String(totalSteps)} />
            <MetaField
              label="Passed / Failed"
              value={`${passedCount} passed · ${failedCount} failed`}
              valueColor={failedCount > 0 ? 'text-warning' : 'text-verified'}
            />
            {projectBundle.app && (
              <MetaField label="Application" value={projectBundle.app} icon={<Cpu className="w-3.5 h-3.5" />} />
            )}
            {projectBundle.framework && (
              <MetaField label="Framework" value={projectBundle.framework} />
            )}
          </div>

          {/* Project hash */}
          {projectHashResult && (
            <div className={cn(
              "p-3 rounded-md border text-sm",
              projectHashResult.valid
                ? "border-verified/30 bg-verified/5"
                : "border-destructive/30 bg-destructive/5"
            )}>
              <div className="flex items-center gap-2 mb-1">
                {projectHashResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-verified" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="font-medium">
                  Project Hash: {projectHashResult.valid ? 'Valid' : 'Mismatch'}
                </span>
              </div>
              {projectHashResult.expected && (
                <p className="text-xs font-mono text-muted-foreground break-all">
                  Expected: {projectHashResult.expected}
                </p>
              )}
              {projectHashResult.computed && !projectHashResult.valid && (
                <p className="text-xs font-mono text-muted-foreground break-all">
                  Computed: {projectHashResult.computed}
                </p>
              )}
            </div>
          )}

          {/* Goal / Summary / Final output */}
          {projectBundle.goal && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Project Goal</p>
              <p className="text-sm">{projectBundle.goal}</p>
            </div>
          )}
          {projectBundle.summary && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Summary</p>
              <p className="text-sm">{projectBundle.summary}</p>
            </div>
          )}
          {projectBundle.finalOutput && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Final Output</p>
              <p className="text-sm">{projectBundle.finalOutput}</p>
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
        {sortedSteps.map((step, idx) => {
          const sv = stepVerifications[idx];
          const status = sv?.status ?? 'pending';
          const stepLabel = step.label || step.title || `Step ${step.sequence}`;
          const certHash = step.certificateHash || (step.bundle as any)?.certificateHash;

          return (
            <Card
              key={idx}
              className={cn(
                "cursor-pointer hover:border-primary/40 transition-colors",
                status === 'fail' && "border-destructive/30",
                status === 'error' && "border-destructive/30",
              )}
              onClick={() => setSelectedStepIndex(idx)}
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
                      <span className="text-sm font-medium truncate">{stepLabel}</span>
                      {step.stepType && (
                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">{step.stepType}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {step.executionId && (
                        <span className="font-mono truncate max-w-[180px]">{step.executionId}</span>
                      )}
                      {certHash && (
                        <span className="font-mono truncate max-w-[160px]">
                          {typeof certHash === 'string' ? certHash.slice(0, 24) + '…' : ''}
                        </span>
                      )}
                      {step.recordedAt && (
                        <span className="shrink-0">{formatDate(step.recordedAt)}</span>
                      )}
                      {(step.model || step.provider || step.tool) && (
                        <span className="shrink-0">
                          {step.provider && step.model ? `${step.provider}/${step.model}` : step.model || step.tool || ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    {status === 'pending' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : status === 'pass' ? (
                      <CheckCircle2 className="w-5 h-5 text-verified" />
                    ) : status === 'fail' ? (
                      <XCircle className="w-5 h-5 text-destructive" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-destructive" />
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
/*  Helpers                                                                    */
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
