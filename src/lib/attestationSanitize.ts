/**
 * Attestation payload sanitization helpers.
 *
 * These ensure no `undefined` values leak into JSON payloads sent to the
 * canonical node, which rejects them with "Unsupported type for canonical JSON: undefined".
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
 * Deep-clone a bundle and strip sensitive fields for attestation.
 * Uses `delete` (not assignment to `undefined`) so keys are truly absent.
 * Preserves hashes, parameters, and all other metadata.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripSensitiveForAttestation(bundle: any): any {
  const clone = structuredClone(bundle);

  if (clone.snapshot && typeof clone.snapshot === 'object') {
    delete clone.snapshot.input;
    delete clone.snapshot.output;
    delete clone.snapshot.prompt;
    // inputHash, outputHash, parameters, etc. are preserved
  }

  return removeUndefinedDeep(clone);
}

/**
 * Full sanitization pipeline for canonical node attestation.
 * 1. Deep-clone & strip sensitive fields (input/output/prompt)
 * 2. removeUndefinedDeep
 * 3. Validate zero undefined paths remain
 *
 * Returns { payload, undefinedPaths }.  If undefinedPaths.length > 0 the
 * payload MUST NOT be sent to the node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeForNode(bundle: any): { payload: any; undefinedPaths: string[] } {
  const stripped = stripSensitiveForAttestation(bundle); // clone + delete + removeUndefinedDeep
  const paths = findUndefinedPaths(stripped);
  return { payload: stripped, undefinedPaths: paths };
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
