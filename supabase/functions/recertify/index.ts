import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// SECURITY CONFIGURATION
// ============================================================

// Allowlisted domains for recertification (source URL must match)
const RECERTIFICATION_ALLOWED_DOMAINS = [
  'velocity.recanon.xyz',
  'preview--decision-certifier.lovable.app',
  'nxjkrwcxyhftoaenyztu.supabase.co', // Decision Certifier Supabase
  'ckxiujrvzhvhaubkrjsn.supabase.co', // Decision Certifier alt
];

// Maximum time for canonical renderer request
const RENDER_TIMEOUT_MS = 30000;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isSourceDomainAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    for (const allowed of RECERTIFICATION_ALLOWED_DOMAINS) {
      if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function normalizeHash(hash: string): string {
  let normalized = hash.trim().toLowerCase();
  if (normalized.startsWith('sha256:')) {
    normalized = normalized.slice(7);
  }
  return normalized;
}

function createErrorResponse(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
): Response {
  const requestId = crypto.randomUUID();
  return new Response(
    JSON.stringify({ ok: false, error, message, requestId, ...extra }),
    { 
      status, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      } 
    }
  );
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST requests are supported');
  }

  // Get environment variables
  const CANONICAL_RENDERER_URL = Deno.env.get('CANONICAL_RENDERER_URL');
  const CANONICAL_RENDERER_API_KEY = Deno.env.get('CANONICAL_RENDERER_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!CANONICAL_RENDERER_URL || !CANONICAL_RENDERER_API_KEY) {
    console.error('[recertify] Missing renderer configuration');
    return createErrorResponse(500, 'CONFIG_ERROR', 'Canonical renderer not configured');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[recertify] Missing Supabase configuration');
    return createErrorResponse(500, 'CONFIG_ERROR', 'Database not configured');
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Parse request body
  let body: {
    recordId: string;
    bundle: Record<string, unknown>;
    sourceUrl?: string;
    expectedHash?: string;
  };

  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }

  const { recordId, bundle, sourceUrl, expectedHash } = body;

  if (!recordId || !bundle) {
    return createErrorResponse(400, 'MISSING_FIELDS', 'recordId and bundle are required');
  }

  // Check domain allowlist for source URL
  if (sourceUrl && !isSourceDomainAllowed(sourceUrl)) {
    console.log(`[recertify] Source URL domain not allowed: ${sourceUrl}`);
    
    // Still store a "skipped" result for traceability
    const skipResult = {
      record_id: recordId,
      node_endpoint: CANONICAL_RENDERER_URL,
      status: 'skipped',
      error_code: 'DOMAIN_NOT_ALLOWED',
      error_message: `URL domain not allowed for recertification. Allowed: ${RECERTIFICATION_ALLOWED_DOMAINS.join(', ')}`,
      duration_ms: Date.now() - startTime,
    };

    const { error: insertError } = await supabase
      .from('recertification_runs')
      .insert(skipResult as never);

    if (insertError) {
      console.error('[recertify] Failed to store skip result:', insertError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'skipped',
        reason: 'DOMAIN_NOT_ALLOWED',
        message: `URL domain not allowed for recertification. Allowed: ${RECERTIFICATION_ALLOWED_DOMAINS.join(', ')}`,
        requestId,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        } 
      }
    );
  }

  // Extract snapshot from bundle
  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;
  
  if (!snapshot || typeof snapshot.code !== 'string') {
    console.log('[recertify] Bundle has no renderable snapshot');
    
    // Store a "skipped" result
    const skipResult = {
      record_id: recordId,
      node_endpoint: CANONICAL_RENDERER_URL,
      status: 'skipped',
      error_code: 'NO_SNAPSHOT',
      error_message: 'Bundle does not contain a renderable snapshot (code/seed/vars)',
      duration_ms: Date.now() - startTime,
    };

    const { error: insertError } = await supabase
      .from('recertification_runs')
      .insert(skipResult as never);

    if (insertError) {
      console.error('[recertify] Failed to store skip result:', insertError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'skipped',
        reason: 'NO_SNAPSHOT',
        message: 'Bundle does not contain a renderable snapshot',
        requestId,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        } 
      }
    );
  }

  // Extract expected hash from bundle or parameter
  let expected = expectedHash;
  if (!expected) {
    // Try to find expected hash in bundle
    expected = (bundle.expectedImageHash as string) ||
               (bundle.expectedPosterHash as string) ||
               ((bundle.baseline as Record<string, unknown>)?.posterHash as string) ||
               ((bundle.baseline as Record<string, unknown>)?.imageHash as string);
  }

  if (!expected) {
    console.log('[recertify] No expected hash found in bundle');
    
    const skipResult = {
      record_id: recordId,
      node_endpoint: CANONICAL_RENDERER_URL,
      status: 'skipped',
      error_code: 'NO_EXPECTED_HASH',
      error_message: 'Bundle does not contain an expected poster hash for comparison',
      duration_ms: Date.now() - startTime,
    };

    const { error: insertError } = await supabase
      .from('recertification_runs')
      .insert(skipResult as never);

    if (insertError) {
      console.error('[recertify] Failed to store skip result:', insertError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'skipped',
        reason: 'NO_EXPECTED_HASH',
        message: 'Bundle does not contain an expected poster hash for comparison',
        requestId,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        } 
      }
    );
  }

  // Compute request fingerprint (hash of snapshot inputs)
  const fingerprintData = JSON.stringify({
    code: snapshot.code,
    seed: snapshot.seed,
    vars: snapshot.vars || snapshot.VAR,
  });
  const fingerprintBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprintData)
  );
  const requestFingerprint = Array.from(new Uint8Array(fingerprintBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  console.log(`[recertify] Starting recertification for record ${recordId}, fingerprint: ${requestFingerprint.substring(0, 16)}...`);

  // Prepare render payload for NexArt API
  const renderPayload = {
    code: snapshot.code,
    seed: String(snapshot.seed ?? 0),
    VAR: snapshot.vars || snapshot.VAR || [0,0,0,0,0,0,0,0,0,0],
    protocolVersion: "1.2.0",
  };

  let renderResponse: Response;
  let httpStatus: number;
  let outputHash: string | null = null;
  let protocolVersion: string | null = null;
  let protocolDefaulted = false;
  let runtimeHash: string | null = null;
  let status: 'pass' | 'fail' | 'error' = 'error';
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);

    renderResponse = await fetch(`${CANONICAL_RENDERER_URL}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'image/png',
        'Authorization': `Bearer ${CANONICAL_RENDERER_API_KEY}`,
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify(renderPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    httpStatus = renderResponse.status;

    // Extract headers
    protocolVersion = renderResponse.headers.get('x-protocol-version') || '1.2.0';
    protocolDefaulted = renderResponse.headers.get('x-protocol-defaulted') === 'true';
    runtimeHash = renderResponse.headers.get('x-runtime-hash');

    console.log(`[recertify] Renderer response: ${httpStatus}, protocol: ${protocolVersion}`);

    if (!renderResponse.ok) {
      // Handle error responses
      const errorText = await renderResponse.text();
      
      if (httpStatus === 429) {
        errorCode = 'QUOTA_EXCEEDED';
        errorMessage = 'NexArt renderer quota exceeded';
      } else if (httpStatus === 401 || httpStatus === 403) {
        errorCode = 'UNAUTHORIZED';
        errorMessage = 'Invalid API credentials';
      } else {
        errorCode = 'RENDER_FAILED';
        errorMessage = errorText.substring(0, 500);
      }

      console.error(`[recertify] Render error: ${httpStatus} - ${errorCode}`);
      status = 'error';
    } else {
      // Success - compute hash of PNG bytes
      const pngBuffer = await renderResponse.arrayBuffer();
      const pngBytes = new Uint8Array(pngBuffer);
      const hashBuffer = await crypto.subtle.digest('SHA-256', pngBytes);
      outputHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Compare hashes
      const expectedNorm = normalizeHash(expected);
      const computedNorm = normalizeHash(outputHash);

      if (expectedNorm === computedNorm) {
        status = 'pass';
        console.log(`[recertify] PASS: hashes match (${computedNorm.substring(0, 16)}...)`);
      } else {
        status = 'fail';
        errorMessage = `Hash mismatch: expected ${expectedNorm.substring(0, 16)}..., got ${computedNorm.substring(0, 16)}...`;
        console.log(`[recertify] FAIL: ${errorMessage}`);
      }
    }

  } catch (error) {
    console.error('[recertify] Render request failed:', error);
    
    httpStatus = 0;
    status = 'error';
    
    if (error instanceof Error && error.name === 'AbortError') {
      errorCode = 'TIMEOUT';
      errorMessage = `Request timed out after ${RENDER_TIMEOUT_MS / 1000} seconds`;
    } else {
      errorCode = 'NETWORK_ERROR';
      errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    }
  }

  const durationMs = Date.now() - startTime;

  // Store the recertification result
  const runResult = {
    record_id: recordId,
    node_endpoint: CANONICAL_RENDERER_URL,
    protocol_version: protocolVersion,
    protocol_defaulted: protocolDefaulted,
    runtime_hash: runtimeHash,
    output_hash: outputHash,
    expected_hash: normalizeHash(expected),
    status,
    http_status: httpStatus,
    error_code: errorCode,
    error_message: errorMessage,
    duration_ms: durationMs,
    request_fingerprint: requestFingerprint,
  };

  const { error: insertError } = await supabase
    .from('recertification_runs')
    .insert(runResult as never);

  if (insertError) {
    console.error('[recertify] Failed to store run result:', insertError);
  }

  // Return the result
  return new Response(
    JSON.stringify({
      ok: true,
      status,
      outputHash,
      expectedHash: normalizeHash(expected),
      match: status === 'pass',
      protocolVersion,
      protocolDefaulted,
      runtimeHash,
      httpStatus,
      errorCode,
      errorMessage,
      durationMs,
      requestFingerprint,
      requestId,
    }),
    { 
      status: 200, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      } 
    }
  );
});
