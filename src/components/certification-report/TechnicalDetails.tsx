/**
 * Technical Details — accordion for hashes, raw JSON, reason codes.
 * Collapsed by default. For power users.
 */

import { useState } from 'react';
import { Copy, ChevronDown, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import type { HashEvidence } from './types';

interface Props {
  evidence: HashEvidence;
  bundleJson: string;
  verifyCode?: string;
  verifyDetails?: string[];
}

function HashItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap text-xs">{label}</td>
      <td className="py-2 text-xs font-mono break-all pr-2">{value}</td>
      <td className="py-2">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopy}>
          <Copy className="w-3 h-3" />
        </Button>
      </td>
    </tr>
  );
}

export function TechnicalDetails({ evidence, bundleJson, verifyCode, verifyDetails }: Props) {
  const formatted = (() => {
    try { return JSON.stringify(JSON.parse(bundleJson), null, 2); }
    catch { return bundleJson; }
  })();

  const handleCopyJson = () => {
    navigator.clipboard.writeText(formatted);
    toast.success('JSON copied');
  };

  return (
    <Accordion type="single" collapsible className="border border-border rounded-lg overflow-hidden">
      <AccordionItem value="technical" className="border-0">
        <AccordionTrigger className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:no-underline">
          Technical details
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-4">
          {/* Hashes table */}
          <table className="w-full">
            <tbody>
              <HashItem label="Certificate hash" value={evidence.certificateHash} />
              <HashItem label="Input hash" value={evidence.inputHash} />
              <HashItem label="Output hash" value={evidence.outputHash} />
              <HashItem label="Image hash" value={evidence.expectedImageHash} />
              <HashItem label="Animation hash" value={evidence.expectedAnimationHash} />
            </tbody>
          </table>

          {/* Bundle info */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            {evidence.bundleType && (
              <span>Type: <code className="font-mono">{evidence.bundleType}</code></span>
            )}
            {evidence.bundleVersion && (
              <span>Version: <code className="font-mono">{evidence.bundleVersion}</code></span>
            )}
          </div>

          {/* Failure details */}
          {verifyCode && (
            <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
              <p className="text-xs font-mono text-destructive">{verifyCode}</p>
              {verifyDetails && verifyDetails.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
                  {verifyDetails.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Independent validation callout */}
          <div className="p-3 rounded-md bg-muted/20 border border-border/50">
            <p className="text-xs font-medium text-foreground mb-1">Independent validation available</p>
            <p className="text-xs text-muted-foreground">
              You can verify this record independently by re-computing the SHA-256 hash of the canonicalized bundle content (JCS) and comparing it to the certificate hash above. No authentication or API key is required.
            </p>
          </div>

          {/* Raw JSON */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <Code2 className="w-3.5 h-3.5" />
              <span>Full record JSON</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-md overflow-hidden">
                <div className="flex justify-end p-2 border-b border-border bg-muted/10">
                  <Button variant="ghost" size="sm" onClick={handleCopyJson} className="h-6 gap-1 text-xs">
                    <Copy className="w-3 h-3" />
                    Copy
                  </Button>
                </div>
                <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-80 overflow-auto bg-muted/10">
                  {formatted}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
