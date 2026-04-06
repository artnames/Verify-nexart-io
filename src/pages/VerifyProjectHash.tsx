/**
 * VerifyProjectHash — resolves /p/:projectHash by fetching the project bundle
 * from the nexart.io public Project Bundle registry, then renders the existing
 * ProjectBundlePage with the fetched bundle.
 *
 * No frontend-owned verification semantics — canonical verification is delegated
 * to ProjectBundlePage which uses verifyProjectBundle() from @nexart/ai-execution.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuditLayout } from '@/components/AuditLayout';
import { ProjectBundlePage } from '@/pages/ProjectBundlePage';
import { useSEO } from '@/hooks/useSEO';
import type { ProjectBundle } from '@nexart/ai-execution';

/** The public registry endpoint on nexart.io */
const PROJECT_BUNDLE_REGISTRY_BASE = 'https://nexart.io/api/public/project-bundle';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; code: string; message: string }
  | { status: 'ready'; bundle: ProjectBundle };

/**
 * Validate project hash format: must be sha256:<64 hex chars> or raw 64 hex chars
 */
function validateProjectHash(input: string): { valid: boolean; normalized: string | null } {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.startsWith('sha256:')) {
    const hex = trimmed.slice(7);
    if (/^[a-f0-9]{64}$/.test(hex)) {
      return { valid: true, normalized: `sha256:${hex}` };
    }
    return { valid: false, normalized: null };
  }

  if (/^[a-f0-9]{64}$/.test(trimmed)) {
    return { valid: true, normalized: `sha256:${trimmed}` };
  }

  return { valid: false, normalized: null };
}

export default function VerifyProjectHash() {
  const { projectHash } = useParams<{ projectHash: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useSEO({
    title: 'Project Bundle Verification | verify.nexart.io',
    description: 'Verify a NexArt project bundle by its project hash.',
    path: `/p/${projectHash ?? ''}`,
  });

  useEffect(() => {
    if (!projectHash) {
      setState({ status: 'error', code: 'MISSING_HASH', message: 'No project hash provided.' });
      return;
    }

    const { valid, normalized } = validateProjectHash(projectHash);
    if (!valid || !normalized) {
      setState({
        status: 'error',
        code: 'INVALID_FORMAT',
        message: `Invalid project hash format. Expected sha256:<64 hex chars> or a raw 64-character hex string.`,
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const url = `${PROJECT_BUNDLE_REGISTRY_BASE}?projectHash=${encodeURIComponent(normalized)}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (cancelled) return;

        if (res.status === 404) {
          setState({
            status: 'error',
            code: 'NOT_FOUND',
            message: `No project bundle found for hash ${normalized}. The project may not be registered in the public registry.`,
          });
          return;
        }

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          setState({
            status: 'error',
            code: 'LOOKUP_FAILED',
            message: `Project bundle lookup failed (HTTP ${res.status}). ${body ? body.slice(0, 200) : 'Please try again later.'}`,
          });
          return;
        }

        const json = await res.json();

        // The registry may wrap the bundle in a response envelope
        const bundle: ProjectBundle = json.bundle ?? json;

        if (!bundle || typeof bundle !== 'object' || bundle.bundleType !== 'cer.project.bundle.v1') {
          setState({
            status: 'error',
            code: 'INVALID_BUNDLE',
            message: 'The retrieved artifact is not a valid NexArt project bundle (expected bundleType: cer.project.bundle.v1).',
          });
          return;
        }

        setState({ status: 'ready', bundle });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred while looking up the project bundle.',
        });
      }
    })();

    return () => { cancelled = true; };
  }, [projectHash]);

  if (state.status === 'loading') {
    return (
      <AuditLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Looking up project bundle…</p>
          <p className="text-xs font-mono text-muted-foreground break-all max-w-md text-center">
            {projectHash}
          </p>
        </div>
      </AuditLayout>
    );
  }

  if (state.status === 'error') {
    return (
      <AuditLayout>
        <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
          <Card className="border-destructive/30">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center py-8">
                {state.code === 'NOT_FOUND' ? (
                  <ShieldAlert className="w-12 h-12 text-muted-foreground" />
                ) : (
                  <AlertTriangle className="w-12 h-12 text-destructive" />
                )}
                <div>
                  <h3 className="text-lg font-semibold">
                    {state.code === 'NOT_FOUND' ? 'Project Bundle Not Found' :
                     state.code === 'INVALID_FORMAT' ? 'Invalid Project Hash' :
                     'Lookup Failed'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    {state.message}
                  </p>
                </div>
                <Button onClick={() => navigate('/')}>Back to Verifier</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuditLayout>
    );
  }

  // Render the existing ProjectBundlePage with the fetched bundle
  return <ProjectBundlePage projectBundle={state.bundle} />;
}
