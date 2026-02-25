/**
 * Certification Summary card — top of the report.
 */

import { ShieldCheck, AlertTriangle, XCircle, Download, Copy, Calendar, Globe, Layers, HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CertSummary } from './types';

interface Props {
  summary: CertSummary;
  bundleJson: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CertificationSummary({ summary, bundleJson }: Props) {
  const statusIcon = summary.status === 'pass'
    ? <ShieldCheck className="w-6 h-6 text-verified" />
    : summary.status === 'fail'
      ? <AlertTriangle className="w-6 h-6 text-destructive" />
      : <XCircle className="w-6 h-6 text-destructive" />;

  const statusLabel = summary.status === 'pass' ? 'PASSED' : summary.status === 'fail' ? 'FAILED' : 'ERROR';

  const handleCopyHash = () => {
    if (summary.certificateHash) {
      navigator.clipboard.writeText(summary.certificateHash);
      toast.success('Certificate hash copied');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([bundleJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cer-bundle.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn(
      "border-2",
      summary.status === 'pass' && "border-verified/40 bg-verified/5",
      summary.status === 'fail' && "border-destructive/40 bg-destructive/5",
      summary.status === 'error' && "border-destructive/40 bg-destructive/5",
    )}>
      <CardContent className="pt-6 space-y-4">
        {/* Status + Type */}
        <div className="flex items-center gap-3">
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-lg font-semibold font-mono",
                summary.status === 'pass' ? "text-verified" : "text-destructive",
              )}>
                {statusLabel}
              </span>
              <Badge variant="outline" className="text-xs font-mono">
                {summary.certType}
              </Badge>
            </div>
          </div>
        </div>

        {/* Metadata chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {summary.issuedAt && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3 h-3 shrink-0" />
              <span className="truncate">{new Date(summary.issuedAt).toLocaleString()}</span>
            </div>
          )}
          {summary.application && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate font-mono">{summary.application}</span>
            </div>
          )}
          {summary.sdkVersion && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="w-3 h-3 shrink-0" />
              <span className="font-mono">v{summary.sdkVersion}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <HardDrive className="w-3 h-3 shrink-0" />
            <span>{formatBytes(summary.bundleSizeBytes)}</span>
          </div>
        </div>

        {/* Explainer */}
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
          This record proves the contents below have not been modified since certification.
          It does not claim the output is correct—only that it matches what was recorded at certification time.
        </p>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Download CER JSON
          </Button>
          {summary.certificateHash && (
            <Button variant="outline" size="sm" onClick={handleCopyHash} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              Copy Certificate Hash
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
