/**
 * ProvenanceSection — explicit artifact identity card for redacted reseals.
 *
 * Renders ONLY when the bundle is detected as a public redacted reseal,
 * or when a requested hash differs from the returned artifact's hash.
 *
 * Purely additive UI: never alters verification logic.
 */

import { useState } from 'react';
import { GitBranch, Copy, ChevronDown, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ProvenanceInfo {
  /** Detected as a public redacted reseal */
  isReseal: boolean;
  /** The hash on the artifact actually being verified (public artifact in the reseal case) */
  publicHash?: string;
  /** Original artifact's certificate hash, from provenance */
  originalHash?: string;
  /** Hash the user originally requested (URL/input) — may equal publicHash or originalHash */
  requestedHash?: string;
  /** Optional redaction reason */
  redactionReason?: string;
  /** Optional redaction policy reference */
  redactionPolicy?: string;
}

interface Props {
  info: ProvenanceInfo;
}

function normalizeHash(h?: string): string | undefined {
  if (!h) return undefined;
  const trimmed = h.trim().toLowerCase();
  if (trimmed.startsWith('sha256:')) return trimmed;
  if (/^[a-f0-9]{64}$/.test(trimmed)) return `sha256:${trimmed}`;
  return trimmed;
}

function HashRow({ label, value, emphasized = false }: { label: string; value?: string; emphasized?: boolean }) {
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <button
        onClick={handleCopy}
        className={cn(
          'group flex items-center gap-1.5 text-right font-mono text-[11px] hover:text-primary transition-colors break-all',
          emphasized ? 'text-foreground font-medium' : 'text-muted-foreground',
        )}
        title={`Copy ${label}`}
      >
        <span className="break-all">{value}</span>
        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
      </button>
    </div>
  );
}

export function ProvenanceSection({ info }: Props) {
  const [expanded, setExpanded] = useState(true);

  const publicHash = normalizeHash(info.publicHash);
  const originalHash = normalizeHash(info.originalHash);
  const requestedHash = normalizeHash(info.requestedHash);

  // Determine if requested differs from what was returned
  const requestedMatchesPublic = requestedHash && publicHash && requestedHash === publicHash;
  const requestedMatchesOriginal = requestedHash && originalHash && requestedHash === originalHash;
  const showRequested = requestedHash && !requestedMatchesPublic;

  if (!info.isReseal && !showRequested) return null;

  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span>Artifact Identity</span>
          </div>
          {info.isReseal && (
            <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">
              Public Redacted Reseal
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {info.isReseal && (
          <div className="rounded-md bg-muted/20 border border-border/50 p-3 text-xs text-muted-foreground leading-relaxed">
            <p className="text-foreground font-medium mb-1">This is a public redacted reseal.</p>
            <p>
              Sensitive fields were removed from the original Certified Execution Record before public re-sealing.
              The public artifact has its own certificate hash, computed over the redacted content.
              The original certificate hash is preserved in provenance for cross-reference.
            </p>
          </div>
        )}

        {showRequested && requestedMatchesOriginal && (
          <div className="rounded-md bg-muted/30 border border-border/50 p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="text-foreground font-medium mb-0.5">You requested the original certificate hash.</p>
              <p>
                The returned artifact is the public redacted reseal of that record.
                Verification applies to the public artifact shown below.
              </p>
            </div>
          </div>
        )}

        {showRequested && !requestedMatchesOriginal && (
          <div className="rounded-md bg-muted/30 border border-border/50 p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="text-foreground font-medium mb-0.5">Requested hash differs from returned artifact.</p>
              <p>The certificate hash you requested does not match the artifact's own hash. See details below.</p>
            </div>
          </div>
        )}

        <div className="rounded-md border border-border/40 bg-background/40 px-3">
          <HashRow
            label={info.isReseal ? 'Public certificate hash' : 'Certificate hash'}
            value={publicHash}
            emphasized
          />
          <HashRow label="Original certificate hash" value={originalHash} />
          {showRequested && <HashRow label="Requested hash" value={requestedHash} />}
        </div>

        {(info.redactionReason || info.redactionPolicy) && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
              <span>Redaction details</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {info.redactionReason && (
                <p>
                  <span className="text-foreground font-medium">Reason:</span> {info.redactionReason}
                </p>
              )}
              {info.redactionPolicy && (
                <p>
                  <span className="text-foreground font-medium">Policy:</span>{' '}
                  <code className="font-mono text-[11px]">{info.redactionPolicy}</code>
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex items-start gap-2 text-[11px] text-muted-foreground/80 pt-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <p>
            Verification applies to the public artifact: its certificate hash is recomputed and matched against the
            redacted content. The original hash is shown for cross-reference only and is not re-verified here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
