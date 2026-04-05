/**
 * PublicVerificationPage — self-contained verification for /e/:executionId and /c/:certificateHash.
 *
 * Fetches the public-safe CER bundle from the canonical lookup backend,
 * verifies it in memory (WebCrypto), and renders the report directly.
 * No dependency on local audit records.
 */

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lookupByExecutionId } from '@/api/executionLookup';
import { fetchBundleFromUrl } from '@/api/auditRecords';
import { verifyUploadedBundleAsync, type BundleVerifyResult } from '@/lib/verifyBundle';
import { isAICERBundle, validateAICERForAttestation, type AICERBundle } from '@/types/aiCerBundle';
import { AICERVerifyResult } from '@/components/AICERVerifyResult';
import { CertificationReport } from '@/components/certification-report/CertificationReport';
import { AuditLayout } from '@/components/AuditLayout';
import type { CERBundle } from '@/types/auditRecord';

type LookupMode = 'executionId' | 'certificateHash';

interface PublicVerificationPageProps {
  lookupKey: string;
  mode: LookupMode;
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; bundle: Record<string, unknown>; verifyResult: BundleVerifyResult };

export default function PublicVerificationPage({ lookupKey, mode }: PublicVerificationPageProps) {
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    if (!lookupKey) {
      setState({ status: 'error', message: 'No identifier provided.' });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        let bundle: CERBundle | undefined;
        let errorMsg: string | undefined;

        if (mode === 'executionId') {
          const result = await lookupByExecutionId(lookupKey);
          if (!result.success || !result.bundle) {
            const raw = result.error || 'Could not find execution record.';
            errorMsg = sanitizeError(raw);
          } else {
            bundle = result.bundle;
          }
        } else {
          // certificateHash lookup
          const result = await fetchBundleFromUrl(lookupKey);
          if (!result.success || !result.bundle) {
            const raw = result.error || 'Could not find certificate record.';
            errorMsg = sanitizeError(raw);
          } else {
            bundle = result.bundle;
          }
        }

        if (cancelled) return;

        if (!bundle) {
          setState({ status: 'error', message: errorMsg || 'Record not found.' });
          return;
        }

        // Verify in memory
        const verifyResult = await verifyUploadedBundleAsync(bundle as Record<string, unknown>);

        if (!cancelled) {
          setState({ status: 'ready', bundle: bundle as Record<string, unknown>, verifyResult });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const raw = err instanceof Error ? err.message : 'Unknown error';
          setState({ status: 'error', message: sanitizeError(raw) });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [lookupKey, mode]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="font-mono text-sm">
            {mode === 'executionId' ? 'Looking up execution record…' : 'Looking up certificate…'}
          </p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <h1 className="text-lg font-serif">Record Not Found</h1>
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <a href="/" className="text-sm text-primary underline hover:opacity-80">
            Return to verifier
          </a>
        </div>
      </div>
    );
  }

  const { bundle, verifyResult } = state;
  const isAiCer = isAICERBundle(bundle);

  if (isAiCer) {
    const aiBundle = bundle as unknown as AICERBundle;
    const att = (aiBundle as any).meta?.attestation || (aiBundle as any).attestation;
    const attPresent = !!(att && typeof att === 'object' && (att.attestationId || att.attestationStatus));
    const attFields = attPresent ? {
      attestationId: att.attestationId,
      nodeRuntimeHash: att.nodeRuntimeHash,
      protocolVersion: att.protocolVersion,
      certificateHash: (aiBundle as any).certificateHash,
    } : undefined;

    const sdkVerifyResult = {
      ok: verifyResult.ok,
      code: verifyResult.code as any,
      errors: verifyResult.errors,
      details: verifyResult.details,
      degraded: verifyResult.degraded,
    };

    return (
      <AuditLayout>
        <div className="max-w-6xl mx-auto space-y-6 px-6 pb-12">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <a href="/">← Verifier</a>
            </Button>
          </div>
          <AICERVerifyResult
            verifyResult={sdkVerifyResult}
            bundle={aiBundle}
            attestationPresent={attPresent}
            attestationFields={attFields}
            contextIntegrityProtected={verifyResult.contextIntegrityProtected}
          />
        </div>
      </AuditLayout>
    );
  }

  // Code Mode bundle
  const verifyStatus = verifyResult.ok ? 'pass' as const : verifyResult.degraded ? 'degraded' as const : 'fail' as const;

  return (
    <AuditLayout>
      <div className="max-w-6xl mx-auto space-y-6 px-6 pb-12">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <a href="/">← Verifier</a>
          </Button>
        </div>
        <CertificationReport
          bundle={bundle}
          bundleKind="code-mode"
          verifyStatus={verifyStatus}
          verifyCode={verifyResult.code}
          verifyDetails={verifyResult.details}
          contextIntegrityProtected={verifyResult.contextIntegrityProtected}
        />
      </div>
    </AuditLayout>
  );
}

/** Sanitize raw error messages for display — user-safe language only */
function sanitizeError(raw: string): string {
  if (raw.includes('dns error') || raw.includes('Service unreachable'))
    return 'The verification service is temporarily unavailable. Please try again later.';
  if (raw.includes('SERVER_CONFIG_ERROR') || raw.includes('not configured'))
    return 'The verification service is not yet configured. Please contact the administrator.';
  if (raw.includes('fetch') || raw.includes('network'))
    return 'Unable to reach the verification service. Please check your connection and try again.';
  if (raw.includes('status 400') || raw.includes('status 404'))
    return 'No matching record was found for the provided identifier.';
  if (raw.includes('status'))
    return 'The verification service returned an unexpected response. Please try again.';
  return raw;
}
