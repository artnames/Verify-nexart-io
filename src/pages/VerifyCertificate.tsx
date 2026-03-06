import { useParams } from "react-router-dom";
import PublicVerificationPage from "./PublicVerificationPage";

/**
 * /c/:certificateHash → public verification by certificate hash.
 * Self-contained: fetches, verifies, and renders directly.
 */
export default function VerifyCertificate() {
  const { certificateHash } = useParams<{ certificateHash: string }>();

  if (!certificateHash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">No certificate hash provided.</p>
      </div>
    );
  }

  return <PublicVerificationPage lookupKey={certificateHash} mode="certificateHash" />;
}
