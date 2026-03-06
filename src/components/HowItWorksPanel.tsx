import { ShieldCheck, CheckCircle2, Zap, ArrowRight, ScrollText, FileSearch, Link, Upload, Lock, Fingerprint, Eye, FileCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AuditEntryPanel } from "./AuditEntryPanel";
import { useNavigate } from "react-router-dom";

export function HowItWorksPanel() {
  const navigate = useNavigate();

  const handleGoToVerificationLog = () => {
    navigate('/audit-log');
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold mb-2">NexArt Verification Portal</h1>
        <p className="text-muted-foreground">
          Verify Certified Execution Records (CERs). Upload a bundle, validate integrity,
          check node signatures, and inspect execution evidence.
        </p>
      </div>

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
              <div className="font-medium mb-1">Import a Record</div>
              <p className="text-xs text-muted-foreground">
                Paste a URL, enter a hash, or upload a JSON bundle
              </p>
            </div>
            <div className="hidden sm:flex items-center">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-muted/50 text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">2</div>
              <div className="font-medium mb-1">Verify & Validate</div>
              <p className="text-xs text-muted-foreground">
                Certificate hash is validated; node signature and receipt consistency are checked
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

      {/* Quick Import Panel */}
      <AuditEntryPanel />

      {/* Optional Canonical Verification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            Optional Canonical Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            For deterministic execution records, canonical re-run may be available where supported.
          </p>
          <p className="text-muted-foreground">
            For AI execution records, verification focuses on bundle integrity and node attestation.
          </p>
          <p className="text-muted-foreground italic">
            Verification does not modify the original record.
          </p>
        </CardContent>
      </Card>

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
            onClick={handleGoToVerificationLog}
          >
            <ScrollText className="w-5 h-5 mr-2" />
            Open Verification Log
          </Button>
        </CardContent>
      </Card>

      {/* Entry Methods Explained */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Import Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <Link className="w-4 h-4 mt-0.5 text-primary" />
              <div>
                <span className="font-medium">Verify by URL</span>
                <p className="text-sm text-muted-foreground">
                  Fetch a CER from a remote endpoint. The bundle is validated, stored locally, 
                  and optionally verified against the NexArt Canonical Renderer.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <FileSearch className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Open by Hash</span>
                <p className="text-sm text-muted-foreground">Look up an existing record by its SHA-256 certificate hash.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <Upload className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Upload Bundle</span>
                <p className="text-sm text-muted-foreground">Import a .json bundle file directly from your device.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Checklist */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Quick Start Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">1</span>
              <span>Use <strong>"Verify by URL"</strong> above to import a CER from an external system</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">2</span>
              <span>Check that the certificate status shows <strong>VERIFIED</strong> or <strong>SEALED</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">3</span>
              <span>Click on a record in the <strong>Verification Log</strong> to view the full report</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-verified text-verified-foreground flex items-center justify-center text-xs font-medium shrink-0">✓</span>
              <span className="text-verified font-medium">Review the evidence layers to understand the execution</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
