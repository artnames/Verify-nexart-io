/**
 * Canonicalization utility for Certified Execution Records
 * 
 * Produces a deterministic JSON string from any object:
 * - Sorts object keys recursively (alphabetical)
 * - Preserves array order
 * - Normalizes money values (fields containing "amount" or ending with "_usd") to 2 decimals
 * - Outputs UTF-8 JSON with no whitespace
 */

/**
 * Check if a field name indicates a money/currency value
 */
function isMoneyField(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return lowerKey.includes('amount') || lowerKey.endsWith('_usd') || lowerKey.endsWith('_eur');
}

/**
 * Normalize a money value to 2 decimal places
 */
function normalizeMoneyValue(value: number): number {
  return Math.round(value * 100) / 100;
}

const MAX_CANONICALIZE_DEPTH = 100;

/**
 * Recursively process a value for canonicalization
 */
function processValue(value: unknown, parentKey?: string, depth: number = 0): unknown {
  if (depth > MAX_CANONICALIZE_DEPTH) {
    throw new Error(`Canonicalization aborted: nesting depth exceeds ${MAX_CANONICALIZE_DEPTH}`);
  }
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    // Normalize money fields to 2 decimal places
    if (parentKey && isMoneyField(parentKey)) {
      return normalizeMoneyValue(value);
    }
    // Handle special number cases
    if (!Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    // Preserve array order, process each element
    return value.map((item, index) => processValue(item, `[${index}]`, depth + 1));
  }

  if (typeof value === 'object') {
    // Sort keys alphabetically and process recursively
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    
    for (const key of sortedKeys) {
      const processedValue = processValue((value as Record<string, unknown>)[key], key, depth + 1);
      // Only include non-undefined values
      if (processedValue !== undefined) {
        result[key] = processedValue;
      }
    }
    
    return result;
  }

  // For other types (functions, symbols, etc.), exclude them
  return undefined;
}

/**
 * Canonicalize an object into a deterministic JSON string
 * 
 * @param obj - The object to canonicalize
 * @returns A deterministic JSON string with no whitespace
 */
export function canonicalize(obj: unknown): string {
  const processed = processValue(obj);
  return JSON.stringify(processed);
}

/**
 * Compute SHA-256 hash of a canonicalized object
 * 
 * @param obj - The object to hash
 * @returns The SHA-256 hash as a lowercase hex string (64 chars)
 */
export async function computeCertificateHash(obj: unknown): Promise<string> {
  const canonical = canonicalize(obj);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify that a hash matches the canonicalized object
 * 
 * @param obj - The object to verify
 * @param expectedHash - The expected SHA-256 hash (hex string, with or without sha256: prefix)
 * @returns Object with verification result and computed hash
 */
export async function verifyCertificateHash(
  obj: unknown, 
  expectedHash: string
): Promise<{ 
  verified: boolean; 
  computedHash: string; 
  expectedHash: string;
  canonicalJson: string;
}> {
  const canonicalJson = canonicalize(obj);
  const computedHash = await computeCertificateHash(obj);
  
  // Normalize expected hash (strip sha256: prefix if present, lowercase)
  const normalizedExpected = expectedHash.replace(/^sha256:/i, '').toLowerCase();
  
  return {
    verified: computedHash === normalizedExpected,
    computedHash,
    expectedHash: normalizedExpected,
    canonicalJson,
  };
}
