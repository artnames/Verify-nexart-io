import { useParams } from "react-router-dom";
import PublicVerificationPage from "./PublicVerificationPage";
import { useSEO } from "@/hooks/useSEO";
import { useJsonLd, buildWebPage, buildBreadcrumbs } from "@/hooks/useJsonLd";

/**
 * /e/:executionId → public verification by execution ID.
 */
export default function VerifyExecution() {
  const { executionId } = useParams<{ executionId: string }>();

  useSEO({
    title: `Verify Execution ${executionId ? executionId.slice(0, 12) + '…' : ''} — NexArt`,
    description: 'Independent verification of a Certified Execution Record (CER) by execution ID. Validates integrity, node signatures, and execution evidence.',
    path: `/e/${executionId ?? ''}`,
  });

  useJsonLd([
    buildWebPage({
      name: `Execution Verification — ${executionId ?? 'unknown'}`,
      description: 'Verification result for a Certified Execution Record looked up by execution ID.',
      path: `/e/${executionId ?? ''}`,
    }),
    buildBreadcrumbs([
      { name: 'Verification Portal', path: '/' },
      { name: 'Execution Lookup', path: `/e/${executionId ?? ''}` },
    ]),
  ]);

  if (!executionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">No execution ID provided.</p>
      </div>
    );
  }

  return <PublicVerificationPage lookupKey={executionId} mode="executionId" />;
}
