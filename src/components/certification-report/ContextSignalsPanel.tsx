/**
 * Context Signals — displays execution context signals recorded in a CER bundle.
 *
 * Signals are raw contextual data (type, source, timestamp, optional actor)
 * recorded alongside the execution. NexArt does not interpret or enforce them.
 *
 * Hidden entirely when no signals are present.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContextSignal {
  type: string;
  source?: string;
  timestamp?: string;
  actor?: string;
  payload?: unknown;
  [key: string]: unknown;
}

interface ContextSignalsPanelProps {
  signals: ContextSignal[];
}

function SignalRow({ signal, index }: { signal: ContextSignal; index: number }) {
  const [expanded, setExpanded] = useState(false);

  // Collect the payload: everything except the four known display fields
  const knownKeys = new Set(['type', 'source', 'timestamp', 'actor']);
  const payloadEntries = Object.entries(signal).filter(([k]) => !knownKeys.has(k));
  const hasPayload = payloadEntries.length > 0 || signal.payload !== undefined;
  const payloadData = signal.payload !== undefined
    ? signal.payload
    : payloadEntries.length > 0
      ? Object.fromEntries(payloadEntries)
      : undefined;

  return (
    <div className="border border-border/40 rounded-md">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-[10px] text-muted-foreground/50 font-mono pt-0.5 shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-5 font-mono">
              {signal.type}
            </Badge>
            {signal.source && (
              <span className="text-[10px] text-muted-foreground">
                from <span className="font-mono text-foreground/80">{signal.source}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            {signal.timestamp && (
              <span className="font-mono">{signal.timestamp}</span>
            )}
            {signal.actor && (
              <span>
                actor: <span className="font-mono text-foreground/70">{signal.actor}</span>
              </span>
            )}
          </div>
        </div>
        {hasPayload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
      {hasPayload && expanded && (
        <div className="border-t border-border/30 px-4 py-3 bg-muted/20">
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-all text-foreground/80 max-h-48 overflow-auto">
            {JSON.stringify(payloadData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ContextSignalsPanel({ signals }: ContextSignalsPanelProps) {
  if (!signals || signals.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Signal className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Context Signals</h2>
        <Badge variant="secondary" className="text-[10px] h-5">
          {signals.length}
        </Badge>
      </div>

      <Card className="border border-border/60">
        <CardContent className="px-5 py-4 space-y-2">
          {signals.map((signal, i) => (
            <SignalRow key={i} signal={signal} index={i} />
          ))}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        Signals are recorded as part of the execution context. NexArt does not interpret or enforce them.
      </p>
    </div>
  );
}
