import { useState, useEffect, useCallback } from "react";
import { Settings, Server, ShieldCheck, Info, Copy, Check, RefreshCw, Circle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { checkCanonicalHealth, isProxyConfigured } from "@/certified/canonicalClient";

const APP_VERSION = 'nexart-verify v0.1.0';

interface HealthData {
  status: 'idle' | 'checking' | 'healthy' | 'unreachable';
  latency?: number;
  error?: string;
  metadata?: {
    nodeVersion?: string;
    sdkVersion?: string;
    protocolVersion?: string;
    canvasWidth?: number;
    canvasHeight?: number;
    timestamp?: string;
  };
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
      {label || 'Copy'}
    </Button>
  );
}

export function SettingsPage() {
  const [health, setHealth] = useState<HealthData>({ status: 'idle' });

  const testConnection = useCallback(async () => {
    setHealth({ status: 'checking' });
    const start = performance.now();

    try {
      const result = await checkCanonicalHealth();
      const latency = Math.round(performance.now() - start);

      if (result.available && result.healthData) {
        setHealth({
          status: 'healthy',
          latency,
          metadata: {
            nodeVersion: result.healthData.version,
            sdkVersion: result.healthData.sdk_version,
            protocolVersion: result.healthData.protocol_version,
            canvasWidth: result.healthData.canvas?.width,
            canvasHeight: result.healthData.canvas?.height,
            timestamp: result.healthData.timestamp,
          },
        });
      } else {
        setHealth({
          status: 'unreachable',
          error: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      setHealth({
        status: 'unreachable',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, []);

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  const getDebugInfo = () => {
    return JSON.stringify({
      appVersion: APP_VERSION,
      proxyConfigured: isProxyConfigured(),
      renderer: 'Protected Proxy (hidden)',
      health: {
        status: health.status,
        latency: health.latency,
        error: health.error,
      },
      metadata: health.metadata,
      timestamp: new Date().toISOString(),
    }, null, 2);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration and transparency.
        </p>
      </div>

      {/* Canonical Renderer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="w-4 h-4" />
            Canonical Renderer
          </CardTitle>
          <CardDescription>
            The authoritative server for all certified executions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Protected Proxy Display */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Endpoint</label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-verified/20 text-verified font-medium">
                PROTECTED
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 font-mono text-xs bg-muted px-3 py-2 rounded">
                <ShieldCheck className="w-4 h-4 text-verified" />
                <span>Protected Proxy</span>
                <span className="text-muted-foreground">(Renderer: hidden)</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The actual renderer URL is kept secret. All requests go through the secure proxy with rate limiting.
            </p>
          </div>

          {/* Health Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Status</label>
              <Button variant="outline" size="sm" onClick={testConnection}>
                <RefreshCw className={cn("w-3 h-3 mr-2", health.status === 'checking' && "animate-spin")} />
                Test Connection
              </Button>
            </div>
            <div className="p-3 rounded-md bg-muted space-y-2">
              <div className="flex items-center gap-2">
                <Circle 
                  className={cn(
                    "w-3 h-3",
                    health.status === 'checking' && "text-muted-foreground animate-pulse",
                    health.status === 'healthy' && "text-verified fill-verified",
                    health.status === 'unreachable' && "text-destructive fill-destructive",
                    health.status === 'idle' && "text-muted-foreground"
                  )}
                />
                <span className={cn(
                  "text-sm font-medium",
                  health.status === 'healthy' && "text-verified",
                  health.status === 'unreachable' && "text-destructive",
                )}>
                  {health.status === 'idle' && 'Not tested'}
                  {health.status === 'checking' && 'Checking...'}
                  {health.status === 'healthy' && `Healthy${health.latency ? ` (${health.latency}ms)` : ''}`}
                  {health.status === 'unreachable' && 'Unreachable'}
                </span>
              </div>
              {health.error && (
                <p className="text-xs text-destructive">{health.error}</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          {health.metadata && health.status === 'healthy' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Renderer Metadata</label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-md bg-muted text-sm">
                <div className="text-muted-foreground">Node Version</div>
                <div className="font-mono">{health.metadata.nodeVersion || '-'}</div>
                <div className="text-muted-foreground">SDK Version</div>
                <div className="font-mono">{health.metadata.sdkVersion || '-'}</div>
                <div className="text-muted-foreground">Protocol Version</div>
                <div className="font-mono">{health.metadata.protocolVersion || '-'}</div>
                <div className="text-muted-foreground">Canvas Size</div>
                <div className="font-mono">
                  {health.metadata.canvasWidth && health.metadata.canvasHeight 
                    ? `${health.metadata.canvasWidth}×${health.metadata.canvasHeight}` 
                    : '-'}
                </div>
                <div className="text-muted-foreground">Timestamp</div>
                <div className="font-mono text-xs">
                  {health.metadata.timestamp 
                    ? new Date(health.metadata.timestamp).toLocaleString() 
                    : '-'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4" />
            Verification Policy
          </CardTitle>
          <CardDescription>
            Strict rules for deterministic verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-md bg-muted space-y-3">
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-background">STATIC</span>
                <span>Single image hash required (SHA-256 of PNG bytes)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-background">LOOP</span>
                <span>Both poster hash + animation hash required (PNG + MP4)</span>
              </div>
            </div>
            <div className="p-3 rounded-md border border-border space-y-2">
              <p><strong>No fallback:</strong> If the proxy is unreachable, execution fails. No local mock.</p>
              <p><strong>No client-side verification:</strong> All hash comparisons happen on the authoritative server.</p>
              <p><strong>Any mismatch = FAILED:</strong> Even a single bit difference results in verification failure.</p>
              <p><strong>Rate limited:</strong> 30 requests per minute per IP to prevent abuse.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="w-4 h-4" />
            App Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Version</div>
            <div className="font-mono">{APP_VERSION}</div>
            <div className="text-muted-foreground">Proxy Configured</div>
            <div className="font-mono">{isProxyConfigured() ? 'Yes' : 'No'}</div>
          </div>
          <div className="pt-2">
            <CopyButton text={getDebugInfo()} label="Copy Debug Info" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
