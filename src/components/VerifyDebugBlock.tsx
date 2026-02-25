/**
 * Dev-only debug block for verification pipeline.
 * Collapsed by default. Only shown in development mode.
 */

import { useState } from 'react';
import { Bug, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BundleVerifyResult } from '@/lib/verifyBundle';

interface Props {
  bundleType: string;
  certificateHash?: string;
  verifyResult: BundleVerifyResult;
}

export function VerifyDebugBlock({ bundleType, certificateHash, verifyResult }: Props) {
  const [open, setOpen] = useState(false);

  // Only render in development
  if (import.meta.env.PROD) return null;

  return (
    <div className="border border-dashed border-border/50 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bug className="w-3 h-3" />
        <span className="font-mono">Debug</span>
        <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1 font-mono text-[11px]">
          <div><span className="text-muted-foreground">bundleType: </span>{bundleType}</div>
          <div><span className="text-muted-foreground">certificateHash: </span>{certificateHash || '(none)'}</div>
          <div>
            <span className="text-muted-foreground">verifyResult.ok: </span>
            <span className={verifyResult.ok ? 'text-verified' : 'text-destructive'}>
              {String(verifyResult.ok)}
            </span>
          </div>
          <div><span className="text-muted-foreground">verifyResult.code: </span>{verifyResult.code}</div>
          {verifyResult.details.length > 0 && (
            <div>
              <span className="text-muted-foreground">details: </span>
              {verifyResult.details.join('; ')}
            </div>
          )}
          {verifyResult.errors.length > 0 && (
            <div>
              <span className="text-muted-foreground">errors: </span>
              {verifyResult.errors.join('; ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
