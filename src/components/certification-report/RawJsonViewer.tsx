/**
 * Raw JSON viewer — collapsed by default, for power users.
 */

import { useState } from 'react';
import { Code2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface Props {
  bundleJson: string;
}

export function RawJsonViewer({ bundleJson }: Props) {
  const [open, setOpen] = useState(false);

  const formatted = (() => {
    try {
      return JSON.stringify(JSON.parse(bundleJson), null, 2);
    } catch {
      return bundleJson;
    }
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    toast.success('JSON copied to clipboard');
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code2 className="w-4 h-4" />
            <span>View full CER bundle JSON</span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="flex justify-end p-2 border-b border-border">
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1.5 text-xs">
                <Copy className="w-3 h-3" />
                Copy JSON
              </Button>
            </div>
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all max-h-96 overflow-auto bg-muted/20">
              {formatted}
            </pre>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
