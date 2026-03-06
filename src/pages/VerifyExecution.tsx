import { useParams } from "react-router-dom";
import PublicVerificationPage from "./PublicVerificationPage";

/**
 * /e/:executionId → public verification by execution ID.
 * Self-contained: fetches, verifies, and renders directly.
 */
export default function VerifyExecution() {
  const { executionId } = useParams<{ executionId: string }>();

  if (!executionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">No execution ID provided.</p>
      </div>
    );
  }

  return <PublicVerificationPage lookupKey={executionId} mode="executionId" />;
}
