import { ShieldCheck, CheckCircle2, ArrowRight, ScrollText, Fingerprint, FileCheck, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AuditEntryPanel } from "./AuditEntryPanel";
import { useNavigate, Link } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

export function HowItWorksPanel() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Hero — SEO-optimized with quotable definitions */}
      <header>
        <h1 className="text-2xl font-bold mb-3">
          AI Execution Verification — Independently Verify Certified Execution Records
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          <strong className="text-foreground">verify.nexart.io</strong> is the independent verification surface for{" "}
          <a href="https://nexart.io/protocol" target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
            Certified Execution Records (CERs)
          </a>{" "}
          produced by the NexArt deterministic execution runtime.
          Look up a record by execution ID or certificate hash, upload a CER bundle,
          and validate integrity — without relying on the system that created it.
        </p>
        <p className="text-sm text-muted-foreground mt-3 max-w-3xl">
          Verification does not require a NexArt account. Anyone with a record identifier or bundle file can verify independently.
        </p>
      </header>

      {/* Quotable definitions — GEO-friendly */}
      <section aria-labelledby="definitions-heading">
        <h2 id="definitions-heading" className="sr-only">Key Definitions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <dl>
                <dt className="font-semibold text-sm mb-1">Certified Execution Record (CER)</dt>
                <dd className="text-sm text-muted-foreground">
                  A cryptographically sealed record proving that a specific output was produced from specific inputs,
                  under a specific policy and runtime. CERs are designed to be independently verifiable by any party.
                </dd>
              </dl>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <dl>
                <dt className="font-semibold text-sm mb-1">Independent Verification</dt>
                <dd className="text-sm text-muted-foreground">
                  The process of validating a record's integrity, attestation, and evidence without trusting
                  or relying on the originating system. verify.nexart.io operates as a separate verification surface.
                </dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What this portal verifies */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            What This Portal Verifies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Bundle Integrity:</strong> Validates that the certificate hash matches the canonical representation of the bundle contents.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Node Signature:</strong> Checks node attestation receipts and Ed25519 signatures for offline verifiability.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Receipt Consistency:</strong> Confirms attestation fields, runtime hashes, and protocol versions are present and well-formed.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Evidence Review:</strong> Displays the full execution record — inputs, conditions, outputs, and cryptographic proof.
          </p>
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground italic">
              <strong className="text-foreground not-italic">What it does not claim:</strong>{" "}
              Verification confirms structural integrity and cryptographic consistency.
              It does not guarantee the correctness of the underlying model or the business logic that produced the output.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3-Step Flow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">How Verification Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch gap-4">
            <div className="flex-1 p-4 rounded-lg bg-muted/50 text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">1</div>
              <div className="font-medium mb-1">Enter an Identifier</div>
              <p className="text-xs text-muted-foreground">
                Execution ID, certificate hash, or upload a JSON bundle
              </p>
            </div>
            <div className="hidden sm:flex items-center">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-muted/50 text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">2</div>
              <div className="font-medium mb-1">Verify &amp; Validate</div>
              <p className="text-xs text-muted-foreground">
                Certificate hash, node signature, and receipt consistency are checked
              </p>
            </div>
            <div className="hidden sm:flex items-center">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-muted/50 text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">3</div>
              <div className="font-medium mb-1">Inspect Evidence</div>
              <p className="text-xs text-muted-foreground">
                Review the full execution record with evidence layers
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verify a Record — primary action */}
      <AuditEntryPanel />

      {/* Who is this for */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Who Uses This Verification Surface</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Auditors &amp; compliance teams</strong> reviewing AI execution evidence for governed workflows.
          </p>
          <p>
            <strong className="text-foreground">Counterparties &amp; reviewers</strong> independently confirming that a record is intact and unaltered.
          </p>
          <p>
            <strong className="text-foreground">Developers &amp; integrators</strong> validating CER bundles during integration testing.
          </p>
          <p>
            <strong className="text-foreground">Anyone</strong> who needs to verify without relying on the system that created the record.
          </p>
        </CardContent>
      </Card>

      {/* Advanced: Canonical Re-Certification (collapsed) */}
      <Collapsible>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
              <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                <FileCheck className="w-4 h-4" />
                Advanced: Canonical Re-Certification
              </CardTitle>
              <span className="text-xs text-muted-foreground">expand ▾</span>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3 text-sm pt-0">
              <p className="text-muted-foreground">
                For deterministic execution records, canonical re-run may be available where supported.
                The record is independently re-executed against the NexArt Canonical Renderer to confirm
                the certified output can be reproduced exactly under the current canonical runtime.
              </p>
              <p className="text-muted-foreground">
                For AI execution records, verification focuses on bundle integrity and node attestation.
                Canonical re-certification is not applicable for non-deterministic outputs.
              </p>
              <p className="text-muted-foreground italic text-xs">
                Re-certification does not modify the original record.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* CTA to Verification Log */}
      <Card className="border-2 border-verified/30 bg-gradient-to-br from-verified/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-verified" />
            Verification Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            View all imported records, their verification status, and access detailed reports.
          </p>

          <Button
            size="lg"
            className="w-full sm:w-auto h-auto py-3 px-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={() => navigate('/audit-log')}
          >
            <ScrollText className="w-5 h-5 mr-2" />
            Open Verification Log
          </Button>
        </CardContent>
      </Card>

      {/* Quick Start Checklist */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">1</span>
              <span>Enter an <strong>Execution ID</strong> or <strong>Certificate Hash</strong> above to look up a record</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">2</span>
              <span>Check that the verification status shows <strong>Verified</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">3</span>
              <span>Review the evidence layers to understand the execution</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Ecosystem links — internal linking for SEO */}
      <nav aria-label="NexArt ecosystem" className="pt-2 border-t border-border">
        <h2 className="text-sm font-medium mb-3">NexArt Ecosystem</h2>
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
          <Link to="/about" className="text-link hover:underline">
            What is verify.nexart.io?
          </Link>
        </div>
      </nav>
    </div>
  );
}
