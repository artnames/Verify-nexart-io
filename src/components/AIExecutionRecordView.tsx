/**
 * AI Execution Record View
 * 
 * Dedicated audit view for cer.ai.execution.v1 bundles.
 * Shows provider, model, hashes, and parameters.
 * Sensitive fields (input/output) are hidden by default.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  Copy,
  Hash,
  Server,
  Clock,
  Shield,
  Brain,
  FileCheck,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { truncateHash, formatHashForDisplay, normalizeHash } from '@/lib/hashResolver';
import { verifyCertificateHash } from '@/lib/canonicalize';
import type { AICERBundle } from '@/types/aiCerBundle';

interface AIExecutionRecordViewProps {
  bundle: AICERBundle;
  storedCertificateHash: string;
}

export function AIExecutionRecordView({ bundle, storedCertificateHash }: AIExecutionRecordViewProps) {
  const [showSensitive, setShowSensitive] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{
    verified: boolean;
    computedHash: string;
    expectedHash: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const snapshot = bundle.snapshot;
  const hasSensitiveData = snapshot.input !== undefined || snapshot.output !== undefined;

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const verifyIntegrity = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyCertificateHash(bundle, storedCertificateHash);
      setIntegrityResult(result);
    } catch {
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-verify on mount
  useState(() => {
    verifyIntegrity();
  });

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">AI Execution Record</CardTitle>
          </div>
          <CardDescription className="text-sm leading-relaxed mt-2">
            This record certifies a specific AI model execution. It proves that a particular
            input was processed by a specific model version, producing a specific output,
            and that the result has not been altered since certification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Provider</p>
              <p className="text-sm font-mono font-medium">{snapshot.provider}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Model</p>
              <p className="text-sm font-mono font-medium">{snapshot.model}</p>
              {snapshot.modelVersion && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">v{snapshot.modelVersion}</p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Execution ID</p>
              <p className="text-xs font-mono break-all">{snapshot.executionId}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Timestamp</p>
              <p className="text-sm font-mono">
                {new Date(snapshot.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {snapshot.appId && (
            <div className="p-3 bg-muted/30 rounded-lg border text-sm">
              <span className="text-muted-foreground">Application: </span>
              <span className="font-mono">{snapshot.appId}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Integrity */}
      <Card className={cn(
        "border",
        integrityResult?.verified && "border-verified/30 bg-verified/5",
        integrityResult && !integrityResult.verified && "border-destructive/30 bg-destructive/5",
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              <span>Record Integrity</span>
            </div>
            {integrityResult ? (
              integrityResult.verified ? (
                <Badge className="bg-verified text-verified-foreground">PASS</Badge>
              ) : (
                <Badge variant="destructive">FAIL</Badge>
              )
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrityResult?.verified ? (
            <p className="text-sm text-verified">
              The certificate hash matches the canonicalized bundle content. This record has not been modified since certification.
            </p>
          ) : integrityResult ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                The computed certificate hash does not match the stored value. This record may have been altered.
              </p>
              <div className="text-xs space-y-1 font-mono">
                <div>
                  <span className="text-muted-foreground">Expected: </span>
                  <span>{truncateHash(integrityResult.expectedHash, 12, 12)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Computed: </span>
                  <span className="text-destructive">{truncateHash(integrityResult.computedHash, 12, 12)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Hash Evidence */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
            <div>
              <CardTitle className="text-base">Cryptographic Evidence</CardTitle>
              <CardDescription className="text-xs">Hashes linking input, output, and certification.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Certificate Hash', value: bundle.certificateHash, icon: Shield },
            { label: 'Input Hash', value: snapshot.inputHash, icon: Hash },
            { label: 'Output Hash', value: snapshot.outputHash, icon: Hash },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                  <code className="text-xs font-mono break-all block">
                    {value ? formatHashForDisplay(value) : '(not provided)'}
                  </code>
                </div>
                {value && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => handleCopy(value, label)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Execution Parameters */}
      {snapshot.parameters && Object.keys(snapshot.parameters).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
              <div>
                <CardTitle className="text-base">Execution Parameters</CardTitle>
                <CardDescription className="text-xs">Configuration used for this AI execution.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(snapshot.parameters).map(([key, value]) => (
                    <tr key={key} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{key}</td>
                      <td className="py-2 font-mono text-sm">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sensitive Fields */}
      {hasSensitiveData && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <CardTitle className="text-base">Sensitive Fields</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="show-sensitive" className="text-xs text-muted-foreground">
                  {showSensitive ? 'Visible' : 'Hidden'}
                </Label>
                <Switch
                  id="show-sensitive"
                  checked={showSensitive}
                  onCheckedChange={setShowSensitive}
                />
              </div>
            </div>
            <CardDescription className="text-xs mt-1">
              Raw prompt/input and model output may contain confidential or personally identifiable information. 
              Exercise caution before revealing these fields.
            </CardDescription>
          </CardHeader>
          {showSensitive && (
            <CardContent className="space-y-4">
              {snapshot.input !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Input / Prompt</p>
                  <div className="bg-muted rounded-lg p-3 max-h-48 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {typeof snapshot.input === 'string'
                        ? snapshot.input
                        : JSON.stringify(snapshot.input, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              {snapshot.output !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Output / Response</p>
                  <div className="bg-muted rounded-lg p-3 max-h-48 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {typeof snapshot.output === 'string'
                        ? snapshot.output
                        : JSON.stringify(snapshot.output, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
