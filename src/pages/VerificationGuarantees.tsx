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

          {/* Introduction */}
          <header>
            <h1 className="text-2xl font-bold mb-3">Verification Guarantees</h1>
            <h2 className="text-lg font-semibold mb-3">Verification you can rely on, with clearly defined guarantees</h2>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Verification matters when a record may be reviewed, challenged, or relied on later.</p>
              <p>NexArt verification is designed to answer a simple question:</p>
              <blockquote className="pl-4 border-l-2 border-primary/40 text-foreground font-medium italic">
                Can this record still be trusted as evidence of what actually happened?
              </blockquote>
              <p>
                Not every record carries the same integrity scope. NexArt makes that explicit so reviewers can see exactly what is protected, what is not, and how much trust the result supports.
              </p>
            </div>
          </header>

          {/* What verification proves */}
          <section>
            <h2 className="text-lg font-semibold mb-3">What verification proves</h2>
            <p className="text-sm text-muted-foreground mb-3">NexArt verification confirms that:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "the record matches the certified state",
                "the certificate hash matches the sealed output",
                "the record structure is valid and internally consistent",
                "if present, the attestation receipt is valid and correctly signed",
                "the result can be checked without trusting the originating system alone",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              This means the record is tamper-evident and independently verifiable within the scope of the verification result.
            </p>
          </section>

          {/* What verification does not claim */}
          <section>
            <h2 className="text-lg font-semibold mb-3">What verification does not claim</h2>
            <p className="text-sm text-muted-foreground mb-3">Verification does <strong className="text-foreground">not</strong> prove that:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "the AI output is correct",
                "the decision is fair or unbiased",
                "the inputs were truthful or complete",
                "the model performed well",
                "the outcome was appropriate in a business, legal, or ethical sense",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-sm text-muted-foreground space-y-1">
              <p>Verification answers: <strong className="text-foreground">"Was this record altered?"</strong></p>
              <p>It does <strong className="text-foreground">not</strong> answer: <strong className="text-foreground">"Was this decision right?"</strong></p>
            </div>
          </section>

          {/* Verification states */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Verification states</h2>
            <div className="space-y-5">
              {/* Fully Verified */}
              <Card className="border-verified/30 bg-verified/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-verified" />
                    <h3 className="font-semibold text-sm">Fully Verified</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    All relevant fields shown in the verification result are within the integrity-protected scope.
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">This means:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-7 list-disc">
                    <li>core execution data is protected</li>
                    <li>context and signals, if present, are included in the protected scope</li>
                    <li>the record reflects what was certified without detectable modification</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3 italic">This is the strongest form of verification.</p>
                </CardContent>
              </Card>

              {/* Partially Verified */}
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-semibold text-sm">Partially Verified</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Core execution data is integrity-protected, but some displayed fields are outside the certificate hash scope.
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">This means:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-7 list-disc">
                    <li>the core certified record still verifies</li>
                    <li>some additional fields are present for interpretation or review</li>
                    <li>those fields are not covered by the same integrity guarantee</li>
                  </ul>
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mt-3">
                    Context or signals may be present, but they are not cryptographically protected in this verification result. They may have been modified after certification.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    A partially verified result still provides meaningful evidence, but it should not be interpreted as full protection over every visible field.
                  </p>
                </CardContent>
              </Card>

              {/* Not Verified */}
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldX className="w-5 h-5 text-destructive" />
                    <h3 className="font-semibold text-sm">Not Verified</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    The record failed one or more verification checks.
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">This can happen because:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-7 list-disc">
                    <li>the certificate hash does not match</li>
                    <li>required data is missing</li>
                    <li>the structure is invalid</li>
                    <li>verification material is unavailable or inconsistent</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    A record in this state should not be trusted as evidence of the original certified execution.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Integrity coverage */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Integrity coverage</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Verification is scoped. Not every field in a record is necessarily protected by the certificate hash.
            </p>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>
                <h3 className="font-medium text-foreground mb-1">Hash-protected fields</h3>
                <p className="mb-2">These are the fields sealed at certification time, such as:</p>
                <ul className="space-y-1 ml-5 list-disc">
                  <li>the execution snapshot</li>
                  <li>output data</li>
                  <li>timestamps</li>
                  <li>declared parameters</li>
                  <li>other protected execution fields defined by the record format</li>
                </ul>
                <p className="mt-2">If any of these fields are modified, verification should fail.</p>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Fields outside hash scope</h3>
                <p className="mb-2">These may include:</p>
                <ul className="space-y-1 ml-5 list-disc">
                  <li>context signals</li>
                  <li>reviewer-facing annotations</li>
                  <li>display metadata</li>
                  <li>other non-protected fields included for interpretation</li>
                </ul>
                <p className="mt-2">
                  These fields may still be useful for understanding the record, but they do not carry the same integrity guarantee unless the result is <strong className="text-foreground">Fully Verified</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Trust layers */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Trust layers</h2>
            <p className="text-sm text-muted-foreground mb-4">
              NexArt verification can apply multiple layers of checking. Each one increases confidence in the record.
            </p>
            <div className="space-y-4">
              {[
                {
                  title: "Certificate hash validation",
                  desc: "Recomputes the hash from the canonical record contents and compares it to the declared certificate hash.",
                },
                {
                  title: "Structure validation",
                  desc: "Confirms that required fields, types, and versioned semantics are present and well-formed.",
                },
                {
                  title: "Attestation receipt verification",
                  desc: "If present, validates the attestation receipt against the attesting node's public key.",
                },
                {
                  title: "Verification envelope",
                  desc: "If present, confirms that the outer verification envelope is consistent and has not been modified independently of the protected record.",
                },
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
            <p className="text-xs text-muted-foreground mt-4 italic">
              These layers do not all appear in every record, but when present, they strengthen the overall verification result.
            </p>
          </section>

          {/* Why this matters */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Why this matters</h2>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Most systems rely on:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>logs</li>
                <li>dashboards</li>
                <li>internal audit trails</li>
                <li>stored telemetry</li>
              </ul>
              <p>
                Those tools are useful for operations, but they are usually controlled by the same system that produced the output in the first place. That makes them weak as independent evidence.
              </p>
              <p>
                NexArt verification is different. It allows a record to be checked outside the originating system, using integrity rules that do not depend on trusting the original application alone.
              </p>
              <p>That is what makes it useful in reviews, disputes, audits, and high-trust workflows.</p>
            </div>
          </section>

          {/* Principle */}
          <section>
            <h2 className="text-lg font-semibold mb-2">NexArt's principle</h2>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>NexArt does not overstate trust.</p>
              <p>If something is not protected, it is not presented as fully verified.</p>
              <p>If a record is only partially protected, that distinction is surfaced clearly.</p>
              <blockquote className="pl-4 border-l-2 border-primary/40 text-foreground italic">
                A system that overstates trust is more dangerous than one that fails clearly.
              </blockquote>
            </div>
          </section>

          {/* Summary */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Summary</h2>
            <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-verified mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Fully Verified</span>
                  <p className="text-muted-foreground text-xs">Everything shown is within the integrity-protected scope.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Partially Verified</span>
                  <p className="text-muted-foreground text-xs">Core execution data is protected, but some displayed fields are outside the hash scope.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldX className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Not Verified</span>
                  <p className="text-muted-foreground text-xs">The record failed integrity checks and should not be trusted as evidence.</p>
                </div>
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
