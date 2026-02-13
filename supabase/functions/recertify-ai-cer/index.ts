import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ATTEST_TIMEOUT_MS = 30000;

function createErrorResponse(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
): Response {
  const requestId = crypto.randomUUID();
  return new Response(
    JSON.stringify({ ok: false, status: 'error', error, message, requestId, ...extra }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    }
  );
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST requests are supported');
  }

  const CANONICAL_RENDERER_URL = Deno.env.get('CANONICAL_RENDERER_URL');
  const CANONICAL_RENDERER_API_KEY = Deno.env.get('CANONICAL_RENDERER_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!CANONICAL_RENDERER_URL || !CANONICAL_RENDERER_API_KEY) {
    console.error('[recertify-ai-cer] Missing renderer configuration');
    return createErrorResponse(500, 'CONFIG_ERROR', 'Canonical node not configured');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[recertify-ai-cer] Missing Supabase configuration');
    return createErrorResponse(500, 'CONFIG_ERROR', 'Database not configured');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: { recordId?: string; bundle?: Record<string, unknown> };

  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }

  const { recordId, bundle } = body;

  if (!bundle) {
    return createErrorResponse(400, 'MISSING_FIELDS', 'bundle is required');
  }

  // Validate this is an AI CER bundle
  if (bundle.bundleType !== 'cer.ai.execution.v1') {
    return createErrorResponse(400, 'INVALID_BUNDLE_TYPE', 'Bundle must be of type cer.ai.execution.v1');
  }

  const snapshot = bundle.snapshot as Record<string, unknown> | undefined;
  if (!snapshot || snapshot.type !== 'ai.execution.v1') {
    return createErrorResponse(400, 'INVALID_SNAPSHOT', 'Snapshot must be of type ai.execution.v1');
  }

  // Validate required snapshot fields
  if (!snapshot.provider || !snapshot.model || !snapshot.executionId) {
    return createErrorResponse(400, 'INCOMPLETE_SNAPSHOT', 'Snapshot missing required fields: provider, model, executionId');
  }

  const certificateHash = bundle.certificateHash as string;
  if (!certificateHash) {
    // Store skip result
    if (recordId) {
      await supabase.from('recertification_runs').insert({
        record_id: recordId,
        node_endpoint: CANONICAL_RENDERER_URL,
        status: 'skipped',
        error_code: 'NO_CERTIFICATE_HASH',
        error_message: 'Bundle does not contain a certificateHash',
        duration_ms: Date.now() - startTime,
      } as never);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'skipped',
        reason: 'NO_CERTIFICATE_HASH',
        errorMessage: 'Bundle does not contain a certificateHash for attestation',
        requestId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': requestId } }
    );
  }

  console.log(`[recertify-ai-cer] Starting attestation for record ${recordId || 'direct'}, cert: ${certificateHash.substring(0, 16)}...`);

  // Call canonical node attestation endpoint
  let status: 'pass' | 'fail' | 'error' = 'error';
  let attestationHash: string | null = null;
  let canonicalRuntimeHash: string | null = null;
  let canonicalProtocolVersion: string | null = null;
  let httpStatus: number = 0;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let upstreamBody: string | null = null;
  let nodeRequestId: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ATTEST_TIMEOUT_MS);

    // Prepare attestation payload — strip sensitive input/output
    const attestPayload = {
      bundleType: bundle.bundleType,
      certificateHash,
      snapshot: {
        type: snapshot.type,
        provider: snapshot.provider,
        model: snapshot.model,
        modelVersion: snapshot.modelVersion,
        executionId: snapshot.executionId,
        timestamp: snapshot.timestamp,
        appId: snapshot.appId,
        parameters: snapshot.parameters,
        inputHash: snapshot.inputHash,
        outputHash: snapshot.outputHash,
      },
      createdAt: bundle.createdAt,
    };

    const attestResponse = await fetch(`${CANONICAL_RENDERER_URL}/api/attest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CANONICAL_RENDERER_API_KEY}`,
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify(attestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    httpStatus = attestResponse.status;

    // Capture node request ID from response headers
    nodeRequestId = attestResponse.headers.get('x-railway-request-id')
      || attestResponse.headers.get('x-request-id')
      || null;

    // Always read body as text first
    const rawBody = await attestResponse.text();
    // Truncate to 2000 chars for storage
    upstreamBody = rawBody.length > 2000 ? rawBody.substring(0, 2000) : rawBody;

    console.log(`[recertify-ai-cer] Canonical node response: ${httpStatus}`);

    if (!attestResponse.ok) {
      // Non-200: always an ERROR, never a "mismatch"
      // Mismatch requires a 200 response with ok:false from the node
      if (httpStatus === 429) {
        errorCode = 'QUOTA_EXCEEDED';
        errorMessage = 'Canonical node quota exceeded';
      } else if (httpStatus === 401 || httpStatus === 403) {
        errorCode = 'UNAUTHORIZED';
        errorMessage = 'Invalid credentials for canonical node';
      } else if (httpStatus === 400) {
        errorCode = 'INVALID_BUNDLE';
        errorMessage = 'Canonical node rejected the request payload';
      } else if (httpStatus >= 500) {
        errorCode = 'NODE_ERROR';
        errorMessage = 'Canonical node returned a server error';
      } else {
        errorCode = 'ATTEST_FAILED';
        errorMessage = `Canonical node returned status ${httpStatus}`;
      }

      // All non-200 responses are errors, not mismatches
      status = 'error';

      // Try to extract structured error details from body
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed.error) {
          errorMessage = `${errorMessage}: ${parsed.error}`;
        }
        if (parsed.message) {
          errorMessage = `${errorMessage} — ${parsed.message}`;
        }
      } catch {
        // Body is not JSON, that's fine
      }

      console.error(`[recertify-ai-cer] Attestation error: ${httpStatus} - ${errorCode}`);
    } else {
      // 200 response — parse JSON for attestation result
      let result: Record<string, unknown> = {};
      try {
        result = JSON.parse(rawBody);
      } catch {
        status = 'error';
        errorCode = 'INVALID_RESPONSE';
        errorMessage = 'Canonical node returned non-JSON 200 response';
      }

      if (result.ok) {
        status = 'pass';
        attestationHash = (result.attestationHash as string) || null;
        canonicalRuntimeHash = (result.canonicalRuntimeHash as string) || null;
        canonicalProtocolVersion = (result.canonicalProtocolVersion as string) || null;
        console.log(`[recertify-ai-cer] PASS: attestation confirmed`);
      } else if (errorCode !== 'INVALID_RESPONSE') {
        // 200 with ok:false means a genuine mismatch
        status = 'fail';
        errorMessage = (result.reason as string) || (result.message as string) || 'Attestation rejected';
        console.log(`[recertify-ai-cer] FAIL: ${errorMessage}`);
      }
    }
  } catch (error) {
    console.error('[recertify-ai-cer] Attestation request failed:', error);
    httpStatus = 0;
    status = 'error';

    if (error instanceof Error && error.name === 'AbortError') {
      errorCode = 'TIMEOUT';
      errorMessage = `Request timed out after ${ATTEST_TIMEOUT_MS / 1000} seconds`;
    } else {
      errorCode = 'NETWORK_ERROR';
      errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    }
  }

  const durationMs = Date.now() - startTime;

  // Persist to recertification_runs
  if (recordId) {
    const runResult = {
      record_id: recordId,
      node_endpoint: CANONICAL_RENDERER_URL,
      protocol_version: canonicalProtocolVersion,
      runtime_hash: canonicalRuntimeHash,
      output_hash: attestationHash,
      expected_hash: certificateHash,
      status,
      http_status: httpStatus,
      error_code: errorCode,
      error_message: errorMessage,
      duration_ms: durationMs,
      request_fingerprint: requestId,
      upstream_body: upstreamBody,
      node_request_id: nodeRequestId,
    };

    const { error: insertError } = await supabase
      .from('recertification_runs')
      .insert(runResult as never);

    if (insertError) {
      console.error('[recertify-ai-cer] Failed to store run result:', insertError);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      status,
      attestationHash,
      canonicalRuntimeHash,
      canonicalProtocolVersion,
      httpStatus,
      errorCode,
      errorMessage,
      durationMs,
      requestId,
      upstreamBody,
      nodeRequestId,
      reason: status === 'fail' ? errorMessage : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    }
  );
});
