import { BookOpen, Play, ShieldCheck, RotateCcw, FileCode, CheckCircle2, AlertTriangle, Zap, Trophy, DollarSign, ArrowRight, Stamp, FileSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import type { ClaimType } from "@/types/claimBundle";
import { AuditEntryPanel } from "./AuditEntryPanel";

interface HowItWorksPanelProps {
  onNavigate?: (view: string, example?: ClaimType) => void;
}

export function HowItWorksPanel({ onNavigate }: HowItWorksPanelProps) {
  const handleCreateExample = (type: ClaimType) => {
    if (onNavigate) {
      onNavigate('claim', type);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Start Here</h1>
        <p className="text-muted-foreground">
          Recanon seals real-world claims into cryptographically verifiable bundles.
          Anyone can independently check the result without trusting the author.
        </p>
      </div>

      {/* Audit Entry Panel */}
      <AuditEntryPanel />

      {/* What is Recanon - Brief */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            What Recanon Does
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Seal:</strong> Execute a claim through the Canonical Renderer to get a cryptographic hash.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Check:</strong> Re-run the same inputs to verify the hash matches. If it does, the claim is intact.
          </p>
        </CardContent>
      </Card>

      {/* 3-Step Flow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">3-Step Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch gap-4">
            <div className="flex-1 p-4 rounded-lg bg-muted/50 text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">1</div>
              <div className="font-medium mb-1">Create Claim</div>
              <p className="text-xs text-muted-foreground">
                Fill in details (sports result, P&L, or any statement)
              </p>
            </div>
            <div className="hidden sm:flex items-center">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-muted/50 text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">2</div>
              <div className="font-medium mb-1">Seal</div>
              <p className="text-xs text-muted-foreground">
                Execute via Canonical Renderer to get hash(es)
              </p>
            </div>
            <div className="hidden sm:flex items-center">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-muted/50 text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">3</div>
              <div className="font-medium mb-1">Check & Test</div>
              <p className="text-xs text-muted-foreground">
                Re-run to verify. Matching hash = VERIFIED
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start CTAs */}
      <Card className="border-2 border-verified/30 bg-gradient-to-br from-verified/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Stamp className="w-5 h-5 text-verified" />
            Quick Start — Create an Example Bundle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click a button below to jump to Claim Studio with all fields pre-filled. 
            Then just click "Seal Claim" to get your first verified bundle.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              size="lg"
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              onClick={() => handleCreateExample('sports')}
            >
              <Trophy className="w-6 h-6" />
              <div>
                <div className="font-semibold">Create Sports Example</div>
                <div className="text-xs font-normal opacity-80">UEFA Champions League result</div>
              </div>
            </Button>

            <Button
              size="lg"
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              onClick={() => handleCreateExample('pnl')}
            >
              <DollarSign className="w-6 h-6" />
              <div>
                <div className="font-semibold">Create P&L Example</div>
                <div className="text-xs font-normal opacity-80">Trading strategy returns</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Protocol Rules */}
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Protocol Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-warning font-bold mt-0.5">•</span>
              <span><strong className="text-foreground">Canvas is fixed</strong> — 1950×2400, provided by runtime. Never call <code className="font-mono text-xs bg-muted px-1 rounded">createCanvas()</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning font-bold mt-0.5">•</span>
              <span><strong className="text-foreground">Determinism via seed</strong> — <code className="font-mono text-xs bg-muted px-1 rounded">snapshot.seed</code> seeds <code className="font-mono text-xs bg-muted px-1 rounded">random()</code> / <code className="font-mono text-xs bg-muted px-1 rounded">noise()</code>. Same inputs = same output.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning font-bold mt-0.5">•</span>
              <span><strong className="text-foreground">Static = 1 hash</strong> — PNG output, single posterHash.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning font-bold mt-0.5">•</span>
              <span><strong className="text-foreground">Loop = 2 hashes</strong> — MP4 output, requires posterHash + animationHash.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* What Each Page Does */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Navigation Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <Stamp className="w-4 h-4 mt-0.5 text-primary" />
              <div>
                <span className="font-medium">Create Claim</span>
                <p className="text-sm text-muted-foreground">Build sports, P&L, or generic claims with a guided form. Seal to get hashes.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <RotateCcw className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Check & Test</span>
                <p className="text-sm text-muted-foreground">Paste any bundle JSON and re-verify. Test tamper detection live.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <FileCode className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Strategies</span>
                <p className="text-sm text-muted-foreground">Browse registered strategies with locked code and content hashes.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <Play className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Execute</span>
                <p className="text-sm text-muted-foreground">Run strategies in Draft (fast) or Sealed (deterministic) mode.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Sealed Results</span>
                <p className="text-sm text-muted-foreground">View and export saved sealed results.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Try This First */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            First-Time Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">1</span>
              <span>Click <strong>"Create Sports Example"</strong> above to jump to Claim Studio with prefilled data</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">2</span>
              <span>Click <strong>"Seal Claim"</strong> to execute and get your posterHash</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">3</span>
              <span>Click <strong>"Download JSON"</strong> to export your sealed bundle</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">4</span>
              <span>Go to <strong>Check & Test</strong> → paste the JSON → click <strong>"Check Result"</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-verified text-verified-foreground flex items-center justify-center text-xs font-medium shrink-0">✓</span>
              <span className="text-verified font-medium">You should see <strong>VERIFIED</strong> — congrats!</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
