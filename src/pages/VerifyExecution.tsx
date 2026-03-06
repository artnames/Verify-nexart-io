import { useParams, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { lookupByExecutionId } from "@/api/executionLookup";
import { importLocalRecord } from "@/storage/localAuditLog";
import { computeCertificateHash } from "@/lib/canonicalize";
import type { CERBundle } from "@/types/auditRecord";

/**
 * /e/:executionId → looks up a bundle by execution ID from the Decision Certifier
 * public-certificate endpoint (via fetch-bundle proxy), imports it locally,
 * then redirects to /audit/:hash.
 */
export default function VerifyExecution() {
  const { executionId } = useParams<{ executionId: string }>();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; hash: string }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    if (!executionId) {
      setState({ status: "error", message: "No execution ID provided." });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await lookupByExecutionId(executionId);

        if (cancelled) return;

        if (!result.success || !result.bundle) {
          setState({
            status: "error",
            message: result.error || "Could not find execution record.",
          });
          return;
        }

        // Import into local audit log so AuditPage can find it
        const importResult = await importLocalRecord(
          result.bundle as CERBundle,
          "url",
          result.wrapperMetadata,
        );

        // Use certificateHash from the lookup result, import result, or compute it
        const hash =
          result.certificateHash ||
          importResult.certificateHash ||
          (await computeCertificateHash(result.bundle as CERBundle));

        if (!cancelled) {
          setState({ status: "ready", hash });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [executionId]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="font-mono text-sm">Looking up execution record…</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <h1 className="text-lg font-serif">Execution Not Found</h1>
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <a href="/" className="text-sm text-link underline hover:opacity-80">
            Return to verifier
          </a>
        </div>
      </div>
    );
  }

  return <Navigate to={`/audit/${state.hash}`} replace />;
}
