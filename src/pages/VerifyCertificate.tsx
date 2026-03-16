import { useParams } from "react-router-dom";
import PublicVerificationPage from "./PublicVerificationPage";
import { useSEO } from "@/hooks/useSEO";
import { useJsonLd, buildWebPage, buildBreadcrumbs } from "@/hooks/useJsonLd";

/**
 * /c/:certificateHash → public verification by certificate hash.
 */
export default function VerifyCertificate() {
  const { certificateHash } = useParams<{ certificateHash: string }>();

  useSEO({
    title: `Verify Certificate ${certificateHash ? certificateHash.slice(0, 12) + '…' : ''} — NexArt`,
    description: 'Independent verification of a Certified Execution Record (CER) by certificate hash. Validates integrity, attestation, and execution evidence.',
    path: `/c/${certificateHash ?? ''}`,
  });

  useJsonLd([
    buildWebPage({
      name: `Certificate Verification — ${certificateHash ?? 'unknown'}`,
      description: 'Verification result for a Certified Execution Record looked up by certificate hash.',
      path: `/c/${certificateHash ?? ''}`,
    }),
    buildBreadcrumbs([
      { name: 'Verification Portal', path: '/' },
      { name: 'Certificate Lookup', path: `/c/${certificateHash ?? ''}` },
    ]),
  ]);

  if (!certificateHash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">No certificate hash provided.</p>
      </div>
    );
  }

  return <PublicVerificationPage lookupKey={certificateHash} mode="certificateHash" />;
}
