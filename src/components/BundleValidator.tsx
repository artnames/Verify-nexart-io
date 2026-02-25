import { useMemo } from "react";
import { AlertCircle, CheckCircle2, XCircle, HelpCircle, FileText } from "lucide-react";
import { Button } from "./ui/button";

export type BundleKind = 'code-mode' | 'ai-execution' | 'unknown';

interface ValidationResult {
  isValid: boolean;
  isEmpty: boolean;
  parseError: string | null;
  missingFields: string[];
  mode: 'static' | 'loop' | 'unknown';
  /** Detected bundle kind based on bundleType / snapshot structure */
  bundleKind: BundleKind;
  warnings: string[];
  // Extended info for debug panel
  resolvedHash?: {
    source: string;
    raw: string;
    normalized: string;
  };
  resolvedAnimationHash?: {
    source: string;
    raw: string;
    normalized: string;
  };
}

interface BundleValidatorProps {
  bundleJson: string;
  onLoadExample: () => void;
}

/**
 * Normalize a hash for comparison:
 * - Strip "sha256:" prefix if present
 * - Convert to lowercase
 * - Return 64-char hex string
 */
export function normalizeHash(hash: string | undefined | null): string {
  if (!hash || typeof hash !== 'string') return '';
  let normalized = hash.trim().toLowerCase();
  if (normalized.startsWith('sha256:')) {
    normalized = normalized.slice(7);
  }
  return normalized;
}

/**
 * Format hash for display (with sha256: prefix)
 */
export function formatHashForDisplay(hash: string): string {
  const normalized = normalizeHash(hash);
  if (!normalized) return '';
  return `sha256:${normalized}`;
}

/**
 * Resolve expected image/poster hash from bundle with priority:
 * 1. bundle.expectedImageHash
 * 2. bundle.baseline.posterHash
 * 3. bundle.baseline.imageHash
 * 4. bundle.poster_hash (db row format)
 * 5. bundle.posterHash
 * 6. bundle.verification?.imageHash (legacy)
 */
export function resolveExpectedHash(bundle: any): { source: string; raw: string; normalized: string } | null {
  const candidates: Array<{ path: string; value: any }> = [
    { path: 'expectedImageHash', value: bundle?.expectedImageHash },
    { path: 'baseline.posterHash', value: bundle?.baseline?.posterHash },
    { path: 'baseline.imageHash', value: bundle?.baseline?.imageHash },
    { path: 'poster_hash', value: bundle?.poster_hash },
    { path: 'posterHash', value: bundle?.posterHash },
    { path: 'verification.imageHash', value: bundle?.verification?.imageHash },
  ];

  for (const { path, value } of candidates) {
    if (value && typeof value === 'string' && value.trim()) {
      const normalized = normalizeHash(value);
      if (normalized.length === 64) {
        return { source: path, raw: value, normalized };
      }
    }
  }
  return null;
}

/**
 * Resolve expected animation hash from bundle with priority:
 * 1. bundle.expectedAnimationHash
 * 2. bundle.baseline.animationHash
 * 3. bundle.animation_hash (db row format)
 * 4. bundle.animationHash
 */
export function resolveExpectedAnimationHash(bundle: any): { source: string; raw: string; normalized: string } | null {
  const candidates: Array<{ path: string; value: any }> = [
    { path: 'expectedAnimationHash', value: bundle?.expectedAnimationHash },
    { path: 'baseline.animationHash', value: bundle?.baseline?.animationHash },
    { path: 'animation_hash', value: bundle?.animation_hash },
    { path: 'animationHash', value: bundle?.animationHash },
  ];

  for (const { path, value } of candidates) {
    if (value && typeof value === 'string' && value.trim()) {
      const normalized = normalizeHash(value);
      if (normalized.length === 64) {
        return { source: path, raw: value, normalized };
      }
    }
  }
  return null;
}

// Example static bundle that works without network (for instant loading)
// NOTE: Canvas is provided by Canonical Renderer - do NOT call createCanvas()
// Seed is provided via snapshot.seed - random() is seeded automatically
export const EXAMPLE_STATIC_BUNDLE = {
  runtime: "nexart-canonical-renderer",
  artifactId: "example-static-001",
  snapshot: {
    code: `
// Deterministic Static Proof Program
// Canvas: 1950x2400 (provided by runtime)
// Seed is provided via snapshot.seed - random() is seeded automatically
function setup() {
  // Canvas is provided by the Canonical Renderer
  noLoop();
}

function draw() {
  background(20, 24, 30);
  
  const cols = 8;
  const rows = 6;
  const cellW = width / cols;
  const cellH = height / rows;
  
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * cellW + cellW / 2;
      const y = j * cellH + cellH / 2;
      const size = map(VAR[0], 0, 100, 20, 80);
      const hue = map(VAR[1], 0, 100, 120, 200);
      
      fill(hue, 180, 200);
      noStroke();
      ellipse(x, y, size, size);
    }
  }
}
`,
    seed: 42,
    vars: [50, 55, 30, 20, 10, 15, 5, 25, 40, 60],
    execution: {
      frames: 1,
      loop: false
    }
  },
  expectedImageHash: "example_hash_must_be_replaced",
  verificationRequirements: "static-single-hash",
  _note: "Example bundle - create a real result using 'Create Result' buttons above"
};

/**
 * Detect bundle kind from parsed JSON
 */
export function detectBundleKind(bundle: any): BundleKind {
  if (
    bundle?.bundleType === 'cer.ai.execution.v1' ||
    (bundle?.snapshot && typeof bundle.snapshot === 'object' && bundle.snapshot.type === 'ai.execution.v1')
  ) {
    return 'ai-execution';
  }
  // Code Mode bundles have snapshot.code
  if (bundle?.snapshot && typeof bundle.snapshot.code === 'string') {
    return 'code-mode';
  }
  return 'unknown';
}

export function validateBundle(bundleJson: string): ValidationResult {
  // Check empty
  if (!bundleJson.trim()) {
    return {
      isValid: false,
      isEmpty: true,
      parseError: null,
      missingFields: [],
      mode: 'unknown',
      bundleKind: 'unknown',
      warnings: [],
    };
  }

  // Try parse
  let bundle: any;
  try {
    bundle = JSON.parse(bundleJson);
  } catch (e) {
    return {
      isValid: false,
      isEmpty: false,
      parseError: e instanceof Error ? e.message : 'Invalid JSON',
      missingFields: [],
      mode: 'unknown',
      bundleKind: 'unknown',
      warnings: [],
    };
  }

  const bundleKind = detectBundleKind(bundle);

  // ── AI Execution CER: validate with simpler rules ──
  if (bundleKind === 'ai-execution') {
    const missingFields: string[] = [];
    const warnings: string[] = [];

    if (!bundle.certificateHash) missingFields.push('certificateHash');
    if (!bundle.snapshot) {
      missingFields.push('snapshot');
    } else {
      if (!bundle.snapshot.provider) missingFields.push('snapshot.provider');
      if (!bundle.snapshot.model) missingFields.push('snapshot.model');
      if (!bundle.snapshot.executionId) missingFields.push('snapshot.executionId');
    }
    if (!bundle.version && !bundle.bundleVersion) warnings.push('Missing version field');

    return {
      isValid: missingFields.length === 0,
      isEmpty: false,
      parseError: null,
      missingFields,
      mode: 'static',
      bundleKind,
      warnings,
    };
  }

  // ── Code Mode validation (existing logic) ──
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Check snapshot
  if (!bundle.snapshot) {
    missingFields.push('snapshot');
  } else {
    if (!bundle.snapshot.code || typeof bundle.snapshot.code !== 'string' || !bundle.snapshot.code.trim()) {
      missingFields.push('snapshot.code');
    }
    if (bundle.snapshot.seed === undefined || bundle.snapshot.seed === null) {
      missingFields.push('snapshot.seed');
    }
    if (!bundle.snapshot.vars || !Array.isArray(bundle.snapshot.vars) || bundle.snapshot.vars.length !== 10) {
      missingFields.push('snapshot.vars (array of 10)');
    }
  }

  // Determine mode
  const isLoop = bundle.snapshot?.execution?.loop === true || 
                 (bundle.snapshot?.execution?.frames && bundle.snapshot.execution.frames > 1);
  const mode: 'static' | 'loop' | 'unknown' = bundle.snapshot ? (isLoop ? 'loop' : 'static') : 'unknown';

  // Resolve hashes using multi-source priority
  const resolvedHash = resolveExpectedHash(bundle);
  const resolvedAnimationHash = resolveExpectedAnimationHash(bundle);

  // Check hashes based on mode
  if (mode === 'loop') {
    if (!resolvedHash) {
      missingFields.push('expectedImageHash, baseline.posterHash, or posterHash (poster hash for loop mode)');
    }
    if (!resolvedAnimationHash) {
      missingFields.push('expectedAnimationHash or baseline.animationHash (required for loop mode)');
    }
  } else if (mode === 'static') {
    if (!resolvedHash) {
      missingFields.push('expectedImageHash, baseline.posterHash, or posterHash');
    }
  }

  // Warnings
  if (bundle._tampered) {
    warnings.push('This bundle is marked as tampered — check is expected to fail');
  }
  if (bundle._note) {
    warnings.push('This is an example bundle — hashes may not be valid');
  }
  
  // Add info about resolved hash source
  if (resolvedHash && resolvedHash.source !== 'expectedImageHash') {
    warnings.push(`Using hash from ${resolvedHash.source} (recanon.event.v1 format)`);
  }

  return {
    isValid: missingFields.length === 0,
    isEmpty: false,
    parseError: null,
    missingFields,
    mode,
    bundleKind,
    warnings,
    resolvedHash: resolvedHash || undefined,
    resolvedAnimationHash: resolvedAnimationHash || undefined,
  };
}

export function BundleValidator({ bundleJson, onLoadExample }: BundleValidatorProps) {
  const validation = useMemo(() => validateBundle(bundleJson), [bundleJson]);

  // Empty state
  if (validation.isEmpty) {
    return (
      <div className="p-4 rounded-md border border-muted bg-muted/30">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>What do I paste here?</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Paste the entire exported bundle JSON from Sealed Results, or use the <strong>Create Result</strong> buttons above to create a valid bundle.
            </p>
            <Button variant="outline" size="sm" onClick={onLoadExample} className="mt-2">
              <FileText className="w-4 h-4 mr-2" />
              Load Example Bundle
            </Button>
            <p className="text-xs text-muted-foreground italic mt-1">
              Example bundles have placeholder hashes — checking will fail until you create a real result.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Parse error
  if (validation.parseError) {
    return (
      <div className="p-4 rounded-md border border-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Invalid JSON</p>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {validation.parseError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Missing fields
  if (validation.missingFields.length > 0) {
    return (
      <div className="p-4 rounded-md border border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-warning">
              Bundle is missing required fields
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {validation.missingFields.map((field) => (
                <li key={field} className="flex items-center gap-2">
                  <XCircle className="w-3 h-3 text-destructive" />
                  <code className="font-mono text-xs">{field}</code>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Accepted hash fields: <code className="font-mono">expectedImageHash</code>, <code className="font-mono">baseline.posterHash</code>, <code className="font-mono">posterHash</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Or use the <strong>Create Result</strong> buttons above to create a complete bundle.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Valid with warnings
  if (validation.warnings.length > 0) {
    const kindLabel = validation.bundleKind === 'ai-execution' ? 'AI Execution CER' 
      : validation.bundleKind === 'code-mode' ? `Code Mode (${validation.mode})` 
      : validation.mode;
    return (
      <div className="p-4 rounded-md border border-verified/30 bg-verified/5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-verified mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-verified">
              Bundle is valid — {kindLabel}
            </p>
            {validation.warnings.map((warning, i) => (
              <p key={i} className="text-xs text-warning flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {warning}
              </p>
            ))}
            {validation.resolvedHash && (
              <div className="text-xs text-muted-foreground font-mono mt-1 p-2 bg-muted/50 rounded">
                <span className="text-foreground/70">Hash source:</span> {validation.resolvedHash.source}
                <br />
                <span className="text-foreground/70">Normalized:</span> {validation.resolvedHash.normalized.slice(0, 16)}…
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fully valid
  const kindLabel = validation.bundleKind === 'ai-execution' ? 'AI Execution CER' 
    : validation.bundleKind === 'code-mode' ? `Code Mode (${validation.mode})` 
    : validation.mode;
  return (
    <div className="p-3 rounded-md border border-verified/30 bg-verified/5">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-verified mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm text-verified">
            Bundle is valid — {kindLabel} — ready to check
          </p>
          {validation.resolvedHash && (
            <p className="text-xs text-muted-foreground font-mono">
              Hash from <code className="text-foreground/80">{validation.resolvedHash.source}</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
