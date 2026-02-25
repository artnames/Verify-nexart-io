/**
 * Evidence section — cryptographic hashes and verification details.
 */

import { useState } from 'react';
import { Hash, Copy, Shield, ChevronDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { HashEvidence } from './types';

interface Props {
  evidence: HashEvidence;
  verifyCode?: string;
  verifyDetails?: string[];
  verifyStatus: 'pass' | 'fail' | 'error';
}

function HashRow({ label, value, icon: Icon = Hash }: { label: string; value?: string; icon?: typeof Hash }) {
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };
  return (
    <div className="p-3 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          <code className="text-xs font-mono break-all block">{value}</code>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={handleCopy}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function EvidenceSection({ evidence, verifyCode, verifyDetails, verifyStatus }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              Cryptographic Evidence
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Hashes and identifiers for independent verification.
            </CardDescription>
          </div>
          {evidence.bundleType && (
            <Badge variant="outline" className="font-mono text-xs">{evidence.bundleType}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <HashRow label="Certificate Hash" value={evidence.certificateHash} icon={Shield} />
        <HashRow label="Input Hash" value={evidence.inputHash} />
        <HashRow label="Output Hash" value={evidence.outputHash} />
        <HashRow label="Expected Image Hash" value={evidence.expectedImageHash} />
        <HashRow label="Expected Animation Hash" value={evidence.expectedAnimationHash} />

        {evidence.bundleVersion && (
          <div className="text-xs text-muted-foreground pt-2">
            Bundle version: <code className="font-mono">{evidence.bundleVersion}</code>
          </div>
        )}

        {/* Failure details */}
        {verifyStatus !== 'pass' && verifyCode && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 mt-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-sm font-medium text-destructive font-mono">{verifyCode}</span>
            </div>
            {verifyDetails && verifyDetails.length > 0 && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1">
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showDetails && "rotate-180")} />
                  Details ({verifyDetails.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-0.5 text-xs font-mono">
                  {verifyDetails.map((d, i) => (
                    <div key={i} className="text-muted-foreground">{d}</div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Independent verification callout */}
        <div className="p-3 rounded-md bg-muted/30 border border-border mt-3 text-xs text-muted-foreground">
          <strong>Verify independently:</strong> You can verify this certificate by re-computing the SHA-256 hash
          of the canonicalized bundle content and comparing it to the certificate hash above.
        </div>
      </CardContent>
    </Card>
  );
}
