import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useJsonLd, buildWebPage, buildBreadcrumbs } from "@/hooks/useJsonLd";
import { VerifierFAQ } from "@/components/VerifierFAQ";

export default function AboutVerifier() {
  useSEO({
    title: 'What is verify.nexart.io — AI Execution Verification Explained',
    description: 'Learn how verify.nexart.io independently verifies Certified Execution Records (CERs). Understand what "verified" means, what is checked, and why independent verification matters for AI execution integrity.',
    path: '/about',
  });

  useJsonLd([
    buildWebPage({
      name: 'What is verify.nexart.io — AI Execution Verification',
      description: 'Explainer page for the NexArt Verification Portal. Covers how independent CER verification works, what "verified" means, and why verification needs a separate surface.',
      path: '/about',
    }),
    buildBreadcrumbs([
      { name: 'Verification Portal', path: '/' },
      { name: 'About', path: '/about' },
    ]),
  ]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <MobileHeader activeView="about" onViewChange={() => {}} />
      <Sidebar activeView="about" onViewChange={() => {}} />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <article className="max-w-3xl mx-auto space-y-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link to="/" className="text-link hover:underline">Verification Portal</Link>
            <span className="mx-1">/</span>
            <span>About</span>
          </nav>

          <header>
            <h1 className="text-2xl font-bold mb-3">
              What is verify.nexart.io?
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">verify.nexart.io</strong> is the independent verification surface for{" "}
              <a href="https://nexart.io/cer" target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                Certified Execution Records
              </a>{" "}
              (CERs) produced by the NexArt execution runtime.
              It exists as a separate surface so that records can be checked without relying on the system that created them.
            </p>
          </header>

          {/* Why a separate surface */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Why Verification Needs Its Own Surface</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Producing a record is not enough. For a record to be trustworthy, it must be checkable
              by a party that did not create it. verify.nexart.io is architecturally separate from
              the NexArt execution infrastructure — it receives records and validates them independently,
              without privileged access to the originating runtime.
            </p>
            <blockquote className="mt-3 pl-4 border-l-2 border-primary/40 text-sm text-foreground italic">
              "A record is only useful if someone else can verify it."
            </blockquote>
          </section>

          {/* What verified means */}
          <section>
            <h2 className="text-lg font-semibold mb-2">What "Verified" Means</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              When verify.nexart.io marks a record as <strong className="text-verified">Verified</strong>, it confirms:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>The certificate hash matches the canonical representation of the record contents.</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>Node attestation signatures are cryptographically valid (Ed25519).</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>Attestation fields, runtime hashes, and protocol versions are present and consistent.</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3 italic">
              Verification confirms structural integrity and cryptographic consistency.
              It does not evaluate the correctness of the underlying model or the business decisions that produced the output.
            </p>
          </section>

          {/* What is checked */}
          <section>
            <h2 className="text-lg font-semibold mb-2">What Is Checked During Verification</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Certificate hash integrity</strong> — the SHA-256 hash is recomputed
                from the record's canonical JSON and compared against the declared certificate hash.
              </p>
              <p>
                <strong className="text-foreground">Attestation receipt</strong> — if present, the Ed25519 node signature
                is verified against the attesting node's public key. This confirms the record was attested by a specific node.
              </p>
              <p>
                <strong className="text-foreground">Receipt consistency</strong> — protocol version, runtime hash,
                and structural fields are checked for completeness and well-formedness.
              </p>
              <p>
                <strong className="text-foreground">Evidence review</strong> — the full execution record is presented
                for inspection, including inputs, outputs, conditions, and cryptographic proof layers.
              </p>
            </div>
          </section>

          {/* Quotable definitions */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Key Definitions</h2>
            <div className="space-y-4">
              <Card className="border-border/60">
                <CardContent className="pt-5 pb-4">
                  <dl>
                    <dt className="font-semibold text-sm mb-1">AI Execution Verification</dt>
                    <dd className="text-sm text-muted-foreground">
                      The process of independently confirming that an AI execution record is structurally intact,
                      cryptographically consistent, and properly attested — without trusting the originating system.
                    </dd>
                  </dl>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="pt-5 pb-4">
                  <dl>
                    <dt className="font-semibold text-sm mb-1">Verified Execution Record</dt>
                    <dd className="text-sm text-muted-foreground">
                      A CER that has passed all verification checks on verify.nexart.io: certificate hash match,
                      valid node attestation, and receipt consistency.
                    </dd>
                  </dl>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="pt-5 pb-4">
                  <dl>
                    <dt className="font-semibold text-sm mb-1">Verification Result</dt>
                    <dd className="text-sm text-muted-foreground">
                      The outcome of a verification check: Verified (all checks passed), Not Verified (one or more checks failed),
                      or Record Not Found (no matching record exists).
                    </dd>
                  </dl>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="pt-5 pb-4">
                  <dl>
                    <dt className="font-semibold text-sm mb-1">Attestation Receipt</dt>
                    <dd className="text-sm text-muted-foreground">
                      A cryptographic receipt issued by a NexArt node confirming that it processed and attested a specific
                      execution record. Contains an Ed25519 signature and node metadata.
                    </dd>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* FAQ */}
          <VerifierFAQ />

          {/* Ecosystem links */}
          <nav aria-label="NexArt ecosystem" className="pt-4 border-t border-border">
            <h2 className="text-sm font-medium mb-3">Learn More</h2>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <a href="https://nexart.io" target="_blank" rel="noopener noreferrer" className="text-link hover:underline inline-flex items-center gap-1">
                NexArt Home <ExternalLink className="w-3 h-3" />
              </a>
              <a href="https://nexart.io/protocol" target="_blank" rel="noopener noreferrer" className="text-link hover:underline inline-flex items-center gap-1">
                Protocol <ExternalLink className="w-3 h-3" />
              </a>
              <a href="https://nexart.io/cer" target="_blank" rel="noopener noreferrer" className="text-link hover:underline inline-flex items-center gap-1">
                Certified Execution Records <ExternalLink className="w-3 h-3" />
              </a>
              <a href="https://nexart.io/integrity" target="_blank" rel="noopener noreferrer" className="text-link hover:underline inline-flex items-center gap-1">
                AI Execution Integrity <ExternalLink className="w-3 h-3" />
              </a>
              <a href="https://docs.nexart.io" target="_blank" rel="noopener noreferrer" className="text-link hover:underline inline-flex items-center gap-1">
                Documentation <ExternalLink className="w-3 h-3" />
              </a>
              <Link to="/" className="text-link hover:underline">
                ← Back to Verification Portal
              </Link>
            </div>
          </nav>
        </article>
      </main>
    </div>
  );
}
