import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { fetchBundleFromUrl } from "@/api/auditRecords";
import { computeCertificateHash } from "@/lib/canonicalize";
import { AuditLayout } from "@/components/AuditLayout";
import { AuditPage } from "@/components/AuditPage";
import { importLocalRecord } from "@/storage/localAuditLog";
import type { CERBundle } from "@/types/auditRecord";

/**
 * /e/:executionId → looks up a bundle by execution ID via the fetch-bundle proxy,
 * imports it locally, then renders the full AuditPage for that certificate hash.
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
        // Try fetching the bundle by execution ID (the proxy accepts hashes)
        const result = await fetchBundleFromUrl(executionId);

        if (cancelled) return;

        if (!result.success || !result.bundle) {
          setState({
            status: "error",
            message: result.error || "Could not fetch execution record.",
          });
          return;
        }

        const bundle = result.bundle as CERBundle;
        const hash = await computeCertificateHash(bundle);

        // Import into local audit log so AuditPage can find it
        await importLocalRecord("url", undefined, bundle, hash);

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
          <p className="font-mono text-sm">Fetching execution record…</p>
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

  // Render the full audit page with the resolved hash
  return (
    <AuditLayout>
      <AuditPage />
    </AuditLayout>
  );
}
