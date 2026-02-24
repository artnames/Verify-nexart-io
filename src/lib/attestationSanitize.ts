/**
 * Attestation payload sanitization helpers.
 *
 * These ensure no `undefined` values leak into JSON payloads sent to the
 * canonical node, which rejects them with "Unsupported type for canonical JSON: undefined".
 *
 * IMPORTANT: For AI CER attestation, the canonical node needs the FULL bundle
 * (including snapshot.input, snapshot.output, snapshot.prompt) to recompute hashes.
 * Stripping those fields causes attestation to fail.
 *
 * Use `sanitizeForNode()` when preparing payloads for the canonical node — it does
 * NOT strip sensitive fields.
 *
 * Use `redactForDisplay()` or `redactForStorage()` when showing payloads to auditors
 * or persisting to the database — these DO strip sensitive fields.
 */

/**
 * Recursively removes keys whose value is `undefined`.
 * - Leaves `null` intact.
 * - Converts `undefined` array elements to `null` to preserve index order.
 */
export function removeUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item === undefined) return null;
      return removeUndefinedDeep(item);
    }) as T;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) {
      result[key] = removeUndefinedDeep(v);
    }
  }
  return result as T;
}

/**
 * Redact sensitive fields for DISPLAY purposes only.
 * Deep-clones, deletes snapshot.input/output/prompt, then removes undefined.
 *
 * ⚠️ DO NOT use this for payloads sent to the canonical node — the node
 * needs these fields to recompute hashes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function redactForDisplay(bundle: any): any {
  const clone = structuredClone(bundle);

  if (clone.snapshot && typeof clone.snapshot === 'object') {
    delete clone.snapshot.input;
    delete clone.snapshot.output;
    delete clone.snapshot.prompt;
  }

  return removeUndefinedDeep(clone);
}

/**
 * Redact sensitive fields for STORAGE purposes (e.g. upstream_body in DB).
 * Same as redactForDisplay — strips input/output/prompt.
 *
 * ⚠️ DO NOT use this for payloads sent to the canonical node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function redactForStorage(bundle: any): any {
  return redactForDisplay(bundle);
}

/**
 * @deprecated Use `redactForDisplay()` instead. This function strips sensitive
 * fields which breaks canonical node attestation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripSensitiveForAttestation(bundle: any): any {
  return redactForDisplay(bundle);
}

/**
 * Full sanitization pipeline for canonical node attestation.
 *
 * 1. Deep-clone the bundle (preserving ALL fields including input/output/prompt)
 * 2. removeUndefinedDeep
 * 3. Validate zero undefined paths remain
 *
 * Returns { payload, undefinedPaths }.  If undefinedPaths.length > 0 the
 * payload MUST NOT be sent to the node.
 *
 * ⚠️ This does NOT strip sensitive fields — the canonical node needs them
 * to recompute hashes for attestation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeForNode(bundle: any): { payload: any; undefinedPaths: string[] } {
  // JSON-safe roundtrip guarantees no non-JSON values survive serialization.
  // This also mirrors exactly what will be sent over the wire.
  const jsonSafe = JSON.parse(JSON.stringify(bundle));
  const cleaned = removeUndefinedDeep(jsonSafe);
  const paths = findUndefinedPaths(cleaned);
  return { payload: cleaned, undefinedPaths: paths };
}

/**
 * Walk an object tree and return dot-paths where a value is `undefined`.
 * Useful for preflight validation before sending to a node that rejects undefined.
 */
export function findUndefinedPaths(
  obj: unknown,
  prefix = '',
  paths: string[] = [],
): string[] {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return paths;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      const currentPath = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
      if (item === undefined) {
        paths.push(currentPath);
      } else {
        findUndefinedPaths(item, currentPath, paths);
      }
    });
    return paths;
  }

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const val = (obj as Record<string, unknown>)[key];
    if (val === undefined) {
      paths.push(currentPath);
    } else {
      findUndefinedPaths(val, currentPath, paths);
    }
  }
  return paths;
}
