import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { StrategiesPanel } from "@/components/StrategiesPanel";
import { BacktestExecutor } from "@/components/BacktestExecutor";
import { ArtifactsList } from "@/components/ArtifactsList";
import { CertifiedArtifact } from "@/components/CertifiedArtifact";
import { VerifyPanel } from "@/components/VerifyPanel";
import { DatasetsPage } from "@/components/DatasetsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { HowItWorksPanel } from "@/components/HowItWorksPanel";
import { ClaimBuilder } from "@/components/ClaimBuilder";
import { LibraryView } from "@/components/LibraryView";
import { DraftResultBanner } from "@/components/DraftResultBanner";
import { MetricCard } from "@/components/MetricCard";
import { EquityChart } from "@/components/EquityChart";
import { DrawdownChart } from "@/components/DrawdownChart";
import { mockStrategies, mockArtifacts } from "@/data/mockData";
import { 
  runCertifiedBacktest,
  runDraftBacktest,
  getCanonicalRendererInfo,
  getCanonicalUrl,
  type ExecutionMode, 
  type CertifiedExecutionResult,
  type DraftExecutionResult,
} from "@/certified/engine";
import type { BacktestConfig, ExecutionStep, CertifiedArtifact as ArtifactType } from "@/types/backtest";
import { XCircle, ShieldCheck, Download } from "lucide-react";
import { HashDisplay } from "@/components/HashDisplay";
import { Button } from "@/components/ui/button";
import { 
  createExportBundle, 
  downloadBundle 
} from "@/types/certifiedArtifact";
import type { ClaimType } from "@/types/claimBundle";

const STORAGE_KEY_VIEW = 'recanon_active_view';
const STORAGE_KEY_CLAIM_EXAMPLE = 'recanon_claim_example';

// Parse deep link params from URL
function parseDeepLink(): { claimId: string | null; hash: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    claimId: params.get('claim') || null,
    hash: params.get('hash') || null,
  };
}

export default function Index() {
  // Deep link state
  const [deepLink, setDeepLink] = useState<{ claimId: string | null; hash: string | null }>(() => parseDeepLink());
  
  // Load saved view from localStorage, default to 'guide' for new users
  // But if deep link exists, go to library
  const [activeView, setActiveView] = useState(() => {
    const dl = parseDeepLink();
    if (dl.claimId || dl.hash) return 'library';
    const saved = localStorage.getItem(STORAGE_KEY_VIEW);
    return saved || 'guide';
  });
  
  // Claim example to prefill (set when user clicks example CTA)
  const [claimExample, setClaimExample] = useState<ClaimType | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CLAIM_EXAMPLE);
    if (saved) {
      localStorage.removeItem(STORAGE_KEY_CLAIM_EXAMPLE); // Clear after reading
      return saved as ClaimType;
    }
    return null;
  });
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactType | null>(null);
  
  // Execution results
  const [lastExecutionMode, setLastExecutionMode] = useState<ExecutionMode | null>(null);
  const [certifiedResult, setCertifiedResult] = useState<CertifiedExecutionResult | null>(null);
  const [draftResult, setDraftResult] = useState<DraftExecutionResult | null>(null);
  const [lastConfig, setLastConfig] = useState<BacktestConfig | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Persist active view to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, activeView);
  }, [activeView]);

  // Clear deep link params from URL after initial load (to avoid re-triggering)
  useEffect(() => {
    if (deepLink.claimId || deepLink.hash) {
      // Replace URL without query params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [deepLink]);

  // Handle navigation with optional claim example prefill
  const handleViewChange = useCallback((view: string, example?: ClaimType) => {
    if (example) {
      setClaimExample(example);
    }
    // Clear deep link when navigating away from library
    if (view !== 'library') {
      setDeepLink({ claimId: null, hash: null });
    }
    setActiveView(view);
  }, []);

  // Clear claim example after it's consumed
  const clearClaimExample = useCallback(() => {
    setClaimExample(null);
  }, []);

  const handleExecute = useCallback(async (config: BacktestConfig, mode: ExecutionMode) => {
    setIsExecuting(true);
    setLastExecutionMode(mode);
    setCertifiedResult(null);
    setDraftResult(null);
    setLastConfig(config);
    setExecutionError(null);
    
    const strategy = mockStrategies.find(s => s.id === config.strategyId);
    if (!strategy) return;

    const steps: ExecutionStep[] = mode === 'certified' 
      ? [
          { id: '1', label: 'Validating Parameters', status: 'active' },
          { id: '2', label: 'Building Snapshot', status: 'pending' },
          { id: '3', label: 'Connecting to Canonical Renderer', status: 'pending' },
          { id: '4', label: 'Executing via Canonical Renderer', status: 'pending' },
          { id: '5', label: 'Computing Output Hash', status: 'pending' },
          { id: '6', label: 'Sealing Result', status: 'pending' },
        ]
      : [
          { id: '1', label: 'Loading Strategy', status: 'active' },
          { id: '2', label: 'Loading Dataset', status: 'pending' },
          { id: '3', label: 'Executing Backtest (Mock)', status: 'pending' },
          { id: '4', label: 'Computing Metrics', status: 'pending' },
        ];
    
    setExecutionSteps(steps);

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, mode === 'certified' ? 600 : 400));
      setExecutionSteps(prev => prev.map((step, idx) => {
        if (idx === i) {
          return { ...step, status: 'completed', timestamp: new Date().toLocaleTimeString() };
        }
        if (idx === i + 1) {
          return { ...step, status: 'active' };
        }
        return step;
      }));
    }

    if (mode === 'certified') {
      try {
        const result = await runCertifiedBacktest({
          seed: config.seed,
          strategyId: config.strategyId,
          strategyHash: strategy.codeHash,
          datasetId: config.dataset,
        });
        setCertifiedResult(result);
        console.log('[Canonical Renderer] Certified execution completed:', result.canonicalMetadata);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Certified execution failed:', errorMessage);
        setExecutionError(errorMessage);
      }
    } else {
      try {
        const result = await runDraftBacktest(config.seed, config.startDate, config.endDate);
        setDraftResult(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Draft execution failed:', errorMessage);
        setExecutionError(errorMessage);
      }
    }

    setIsExecuting(false);
  }, []);

  const handleExportBundle = () => {
    if (!certifiedResult) return;
    
    const bundle = createExportBundle(
      {
        runtime: 'nexart-canonical-renderer',
        artifactId: certifiedResult.artifactId,
        snapshot: certifiedResult.snapshot,
        imageHash: certifiedResult.imageHash,
        animationHash: certifiedResult.animationHash,
        outputBase64: certifiedResult.outputBase64,
        animationBase64: certifiedResult.animationBase64,
        mimeType: certifiedResult.mimeType,
        nodeMetadata: {
          ...certifiedResult.canonicalMetadata,
        },
        sealed: true,
        createdAt: certifiedResult.canonicalMetadata.timestamp,
      },
      getCanonicalUrl(),
      true
    );
    downloadBundle(bundle, certifiedResult.artifactId);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'strategies':
        return <StrategiesPanel strategies={mockStrategies} />;
      
      case 'execute':
        return (
          <div className="space-y-6">
            <BacktestExecutor
              strategies={mockStrategies}
              onExecute={handleExecute}
              isExecuting={isExecuting}
              executionSteps={executionSteps}
            />

            {/* Error State */}
            {executionError && !isExecuting && (
              <div className="p-4 rounded-md border border-destructive bg-destructive/10">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-destructive">Sealed Execution Blocked</h3>
                    <p className="text-sm text-muted-foreground mt-1">This request violates execution rules.</p>
                    <p className="text-sm text-destructive/80 mt-2">{executionError}</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Fix: Ensure the Result includes valid execution code, or create a Result using "Start Here".
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Draft Results */}
            {lastExecutionMode === 'draft' && draftResult && !isExecuting && !executionError && (
              <div className="pt-6 border-t border-border space-y-6">
                <h2 className="text-xl font-semibold">Execution Results</h2>
                <DraftResultBanner />
                
                <div>
                  <h3 className="section-header">Performance Metrics (Draft)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard label="Total Return" value={`${draftResult.metrics.totalReturn >= 0 ? '+' : ''}${draftResult.metrics.totalReturn.toFixed(2)}`} suffix="%" />
                    <MetricCard label="Sharpe Ratio" value={draftResult.metrics.sharpeRatio.toFixed(2)} />
                    <MetricCard label="Max Drawdown" value={draftResult.metrics.maxDrawdown.toFixed(2)} suffix="%" />
                    <MetricCard label="Win Rate" value={draftResult.metrics.winRate.toFixed(1)} suffix="%" />
                  </div>
                </div>

                <div>
                  <h3 className="section-header">Equity Curve (Draft)</h3>
                  <div className="p-4 rounded-md border border-border bg-card">
                    <EquityChart data={draftResult.equityCurve} />
                  </div>
                </div>
              </div>
            )}

            {/* Sealed Results */}
            {lastExecutionMode === 'certified' && certifiedResult && !isExecuting && !executionError && (
              <div className="pt-6 border-t border-border space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-verified" />
                    <div>
                      <h2 className="text-xl font-semibold">Sealed Result</h2>
                      <p className="text-sm text-muted-foreground font-mono">{certifiedResult.artifactId}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleExportBundle}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Bundle
                  </Button>
                </div>

                {/* Image Output */}
                <div className="p-4 rounded-md border border-border bg-card">
                  <h3 className="section-header mb-3">Rendered Output</h3>
                  <img 
                    src={`data:${certifiedResult.mimeType};base64,${certifiedResult.outputBase64}`}
                    alt="Certified backtest visualization"
                    className="w-full rounded-md border border-border"
                  />
                </div>

                {/* Hash Display */}
                <div className="p-4 rounded-md border border-border bg-card space-y-3">
                  <h3 className="section-header">Image Hash (SHA-256)</h3>
                  <HashDisplay hash={certifiedResult.imageHash} truncate={false} />
                  <p className="text-xs text-muted-foreground">
                    This hash uniquely identifies the rendered output. Any change to inputs produces a different hash.
                  </p>
                </div>

                {/* Sealed Result - No computed metrics since renderer doesn't provide them */}
                <div>
                  <h3 className="section-header">Execution Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MetricCard label="Mode" value={certifiedResult.mode === 'loop' ? 'Loop' : 'Static'} />
                    <MetricCard label="Seed" value={certifiedResult.snapshot.seed.toString()} />
                    <MetricCard label="Vars Count" value={certifiedResult.snapshot.vars?.length?.toString() ?? '0'} />
                  </div>
                </div>

                {/* Node Metadata */}
                <div className="p-4 rounded-md border border-border bg-card">
                  <h3 className="section-header mb-3">Node Metadata</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Protocol:</div>
                    <div className="font-mono">{certifiedResult.canonicalMetadata.protocol} v{certifiedResult.canonicalMetadata.protocolVersion}</div>
                    <div className="text-muted-foreground">SDK Version:</div>
                    <div className="font-mono">{certifiedResult.canonicalMetadata.sdkVersion}</div>
                    <div className="text-muted-foreground">Node Version:</div>
                    <div className="font-mono">{certifiedResult.canonicalMetadata.nodeVersion}</div>
                    <div className="text-muted-foreground">Renderer:</div>
                    <div className="font-mono">{certifiedResult.canonicalMetadata.rendererVersion}</div>
                    <div className="text-muted-foreground">Deterministic:</div>
                    <div className="text-verified font-mono">Yes</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      
      case 'artifacts':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Sealed Results</h2>
              <ArtifactsList artifacts={mockArtifacts} onSelect={setSelectedArtifact} selectedId={selectedArtifact?.id} />
            </div>
            <div className="lg:col-span-2">
              {selectedArtifact ? (
                <CertifiedArtifact artifact={selectedArtifact} />
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p className="text-sm">Select an artifact to view details</p>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'guide':
        return <HowItWorksPanel onNavigate={handleViewChange} />;
      
      case 'claim':
        return (
          <ClaimBuilder 
            prefillExample={claimExample} 
            onExampleConsumed={clearClaimExample}
            onNavigateToLibrary={(claimId) => {
              setDeepLink({ claimId, hash: null });
              handleViewChange('library');
            }}
          />
        );
      
      case 'library':
        return (
          <LibraryView 
            initialClaimId={deepLink.claimId}
            initialHash={deepLink.hash}
            onNavigateToCreate={() => handleViewChange('claim')}
          />
        );
      
      case 'verify':
        return <VerifyPanel />;
      
      case 'datasets':
        return <DatasetsPage />;
      
      case 'settings':
        return <SettingsPage />;
      
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <MobileHeader activeView={activeView} onViewChange={handleViewChange} />
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
