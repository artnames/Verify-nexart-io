/**
 * Reusable viewer for potentially sensitive fields.
 * Shows a placeholder when hidden, formatted content when revealed.
 */

import { useState } from 'react';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: unknown;
  defaultHidden?: boolean;
  className?: string;
}

export function SensitiveFieldViewer({ label, value, defaultHidden = true, className }: Props) {
  const [revealed, setRevealed] = useState(!defaultHidden);

  if (value === undefined || value === null) return null;

  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const isLong = rendered.length > 500;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRevealed(!revealed)}
          className="h-6 px-2 gap-1 text-xs text-muted-foreground"
        >
          {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {revealed ? 'Hide' : 'Show'}
        </Button>
      </div>
      {!revealed ? (
        <div className="p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground italic">
          Hidden (may contain confidential data).
        </div>
      ) : isLong ? (
        <Collapsible>
          <div className="bg-muted rounded-md border border-border">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3 max-h-48 overflow-auto">
              {rendered.slice(0, 500)}…
            </pre>
            <CollapsibleContent>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all px-3 pb-3">
                {rendered.slice(500)}
              </pre>
            </CollapsibleContent>
            <CollapsibleTrigger className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground border-t border-border">
              <ChevronDown className="w-3 h-3" />
              Expand full content
            </CollapsibleTrigger>
          </div>
        </Collapsible>
      ) : (
        <div className="bg-muted rounded-md border border-border p-3 max-h-48 overflow-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{rendered}</pre>
        </div>
      )}
    </div>
  );
}
