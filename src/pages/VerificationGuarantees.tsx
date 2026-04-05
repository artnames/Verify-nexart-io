import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, ShieldX, Layers, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useJsonLd, buildWebPage, buildBreadcrumbs } from "@/hooks/useJsonLd";

export default function VerificationGuarantees() {
  useSEO({
    title: "Verification Guarantees — What NexArt Verification Proves (and What It Doesn't)",
    description:
      'Understand what "Fully Verified", "Partially Verified", and "Not Verified" mean in NexArt. Learn what verification guarantees and what it does not claim.',
    path: "/verification-guarantees",
  });

  useJsonLd([
    buildWebPage({
      name: "Verification Guarantees — What NexArt Verification Proves",
      description:
        'Explains what "Fully Verified", "Partially Verified", and "Not Verified" mean in NexArt verification, what is guaranteed, and what is not claimed.',
      path: "/verification-guarantees",
    }),
    buildBreadcrumbs([
      { name: "Verification Portal", path: "/" },
      { name: "Verification Guarantees", path: "/verification-guarantees" },
    ]),
  ]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <MobileHeader activeView="guarantees" onViewChange={() => {}} />
      <Sidebar activeView="guarantees" onViewChange={() => {}} />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <article className="max-w-3xl mx-auto space-y-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link to="/" className="text-link hover:underline">Verification Portal</Link>
            <span className="mx-1">/</span>
            <span>Verification Guarantees</span>
          </nav>

          {/* Section 1 — Introduction */}
          <header>
            <h1 className="text-2xl font-bold mb-3">
              Verification you can rely on, with clearly defined guarantees
            </h1>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>
                NexArt verification answers a simple question:
              </p>
              <blockquote className="pl-4 border-l-2 border-primary/40 text-foreground italic">
                Can this record be trusted as evidence of what actually happened?
              </blockquote>
              <p>
                Verification is not binary. Not all records carry the same level of integrity protection.
                NexArt makes this explicit so reviewers can understand exactly what is guaranteed.
              </p>
            </div>
          </header>

          {/* Section 2 — What verification proves */}
          <section>
            <h2 className="text-lg font-semibold mb-3">What verification proves</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>The record has not been altered since certification.</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>The certificate hash matches the sealed output.</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>The record structure is valid and consistent.</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>If present, the attestation receipt is valid and correctly signed.</span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <span>Verification is independent of the originating system.</span>
              </li>
            </ul>
          </section>

          {/* Section 3 — What verification does NOT claim */}
          <section>
            <h2 className="text-lg font-semibold mb-3">What verification does NOT claim</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span>It does not prove the AI output is correct.</span>
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span>It does not prove the decision is fair or unbiased.</span>
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span>It does not prove inputs were truthful or complete.</span>
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span>It does not evaluate model quality or performance.</span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3 italic">
              Verification answers "Was this record altered?", not "Was this decision right?"
            </p>
          </section>

          {/* Section 4 — Verification states */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Verification states</h2>
            <div className="space-y-4">
              <Card className="border-verified/30 bg-verified/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-verified" />
                    <h3 className="font-semibold text-sm">Fully Verified</h3>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-7">
                    <li>All relevant fields are protected by the certificate hash.</li>
                    <li>Context and signals (if present) are included in the integrity scope.</li>
                    <li>Represents the strongest level of verification.</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-semibold text-sm">Partially Verified</h3>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-7">
                    <li>Core execution data is verified.</li>
                    <li>Some fields are outside the hash scope.</li>
                  </ul>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 ml-7 font-medium">
                    Context or signals are present but not integrity-protected. These fields may have been modified after certification.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldX className="w-5 h-5 text-destructive" />
                    <h3 className="font-semibold text-sm">Not Verified</h3>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-7">
                    <li>Hash mismatch, missing data, or invalid structure.</li>
                    <li>Record should not be trusted as evidence.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 5 — Integrity coverage */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Integrity coverage</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Verification is scoped. Not all fields in a record are necessarily protected by the certificate hash.
            </p>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">Hash-protected fields:</strong> The execution snapshot, output data, timestamps, and configuration parameters that were sealed at certification time. These fields cannot be modified without invalidating the certificate hash.
              </p>
              <p>
                <strong className="text-foreground">Informational fields:</strong> Context signals, metadata annotations, and display-layer fields that may sit outside the hash scope. These are presented for reference but are not covered by the integrity guarantee unless the record is Fully Verified.
              </p>
            </div>
          </section>

          {/* Section 6 — Trust layers */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Trust layers</h2>
            <p className="text-sm text-muted-foreground mb-3">
              NexArt verification applies multiple independent checks. Each layer increases confidence in the record.
            </p>
            <div className="space-y-3">
              {[
                { title: "Certificate hash validation", desc: "Recomputes the SHA-256 hash from canonical record contents and compares it to the declared certificate hash." },
                { title: "Structure validation", desc: "Confirms required fields, types, and protocol version are present and well-formed." },
                { title: "Attestation receipt verification", desc: "If present, validates the Ed25519 signature from the attesting node against the node's public key." },
                { title: "Verification envelope", desc: "If present, confirms the outer envelope wrapping the record is consistent and has not been repackaged." },
              ].map((layer) => (
                <div key={layer.title} className="flex gap-3">
                  <Layers className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{layer.title}</p>
                    <p className="text-xs text-muted-foreground">{layer.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 7 — Why this matters */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Why this matters</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Logs and dashboards are mutable and system-dependent. They can be edited, deleted, or rewritten by the system that created them.
              NexArt verification is independent and externally checkable. It does not rely on the originating system to confirm integrity.
            </p>
          </section>

          {/* Section 8 — Principle */}
          <section>
            <blockquote className="pl-4 border-l-2 border-primary/40 text-foreground italic text-sm">
              NexArt does not overstate trust. If something is not protected, it is not presented as verified.
            </blockquote>
          </section>

          {/* Section 9 — Simple summary */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Summary</h2>
            <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-verified" />
                <span className="font-medium text-foreground">Fully Verified</span>
                <span className="text-muted-foreground">— everything protected</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-yellow-500" />
                <span className="font-medium text-foreground">Partially Verified</span>
                <span className="text-muted-foreground">— core protected, context not</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldX className="w-4 h-4 text-destructive" />
                <span className="font-medium text-foreground">Not Verified</span>
                <span className="text-muted-foreground">— integrity failed</span>
              </div>
            </div>
          </section>

          {/* Back nav */}
          <nav className="pt-4 border-t border-border text-xs">
            <Link to="/about" className="text-link hover:underline">← About the Verifier</Link>
            <span className="mx-3 text-muted-foreground">·</span>
            <Link to="/" className="text-link hover:underline">Verification Portal</Link>
          </nav>
        </article>
      </main>
    </div>
  );
}
