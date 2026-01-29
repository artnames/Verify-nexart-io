import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// SECURITY CONFIGURATION
// ============================================================

// Allowlisted domains for fetching bundles (demo list)
const ALLOWED_DOMAINS = [
  'preview--decision-certifier.lovable.app',
  '.supabase.co',
  '.supabase.in',
  'recanon.lovable.app',
  'localhost',
];

// Request timeout in milliseconds
const FETCH_TIMEOUT_MS = 10000;

// Maximum response size (1MB)
const MAX_RESPONSE_SIZE = 1024 * 1024;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isDomainAllowed(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  
  for (const allowed of ALLOWED_DOMAINS) {
    if (allowed.startsWith('.')) {
      // Wildcard domain (e.g., ".supabase.co" matches "xyz.supabase.co")
      if (hostname.endsWith(allowed) || hostname === allowed.slice(1)) {
        return true;
      }
    } else {
      // Exact match
      if (hostname === allowed) {
        return true;
      }
    }
  }
  
  return false;
}

function createErrorResponse(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
): Response {
  const requestId = crypto.randomUUID();
  return new Response(
    JSON.stringify({ 
      ok: false, 
      error, 
      message, 
      requestId,
      ...extra 
    }),
    { 
      status, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
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
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return createErrorResponse(405, 'Method not allowed', 'Only GET requests are supported');
  }

  const reqUrl = new URL(req.url);
  const targetUrl = reqUrl.searchParams.get('url');

  // Validate URL parameter
  if (!targetUrl) {
    return createErrorResponse(400, 'Missing URL', 'The "url" query parameter is required');
  }

  // Parse and validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return createErrorResponse(400, 'Invalid URL', 'The provided URL is not valid');
  }

  // Enforce HTTPS
  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
    return createErrorResponse(
      400, 
      'HTTPS required', 
      'Only HTTPS URLs are allowed (except localhost for development)'
    );
  }

  // Check domain allowlist
  if (!isDomainAllowed(parsedUrl)) {
    console.warn(`[fetch-bundle] Blocked domain: ${parsedUrl.hostname}`);
    return createErrorResponse(
      403, 
      'Domain not allowed', 
      `The domain "${parsedUrl.hostname}" is not in the allowlist. Allowed: ${ALLOWED_DOMAINS.join(', ')}`
    );
  }

  console.log(`[fetch-bundle] Fetching: ${targetUrl}`);

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Recanon-Bundle-Fetcher/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const finalUrl = response.url;
    const upstreamStatus = response.status;

    console.log(`[fetch-bundle] Response: ${upstreamStatus} from ${finalUrl}`);

    // Check response status
    if (!response.ok) {
      const bodyPreview = await response.text().then(t => t.slice(0, 300));
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Upstream error',
          message: `The server returned status ${upstreamStatus}`,
          upstreamStatus,
          fetchedFrom: finalUrl,
          bodyPreview,
          requestId,
        }),
        { 
          status: 502, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Request-Id': requestId,
          } 
        }
      );
    }

    // Check content-type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const bodyPreview = await response.text().then(t => t.slice(0, 300));
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Invalid content type',
          message: `Expected application/json but received "${contentType}"`,
          upstreamStatus,
          fetchedFrom: finalUrl,
          bodyPreview,
          requestId,
        }),
        { 
          status: 422, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Request-Id': requestId,
          } 
        }
      );
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return createErrorResponse(
        413, 
        'Response too large', 
        `Response size ${contentLength} exceeds maximum of ${MAX_RESPONSE_SIZE} bytes`,
        { upstreamStatus, fetchedFrom: finalUrl }
      );
    }

    // Read and parse response
    const text = await response.text();
    
    if (text.length > MAX_RESPONSE_SIZE) {
      return createErrorResponse(
        413, 
        'Response too large', 
        `Response size ${text.length} exceeds maximum of ${MAX_RESPONSE_SIZE} bytes`,
        { upstreamStatus, fetchedFrom: finalUrl }
      );
    }

    let bundle: unknown;
    try {
      bundle = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Invalid JSON',
          message: 'The response body is not valid JSON',
          upstreamStatus,
          fetchedFrom: finalUrl,
          bodyPreview: text.slice(0, 300),
          requestId,
        }),
        { 
          status: 422, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Request-Id': requestId,
          } 
        }
      );
    }

    console.log(`[fetch-bundle] Success: parsed JSON bundle from ${finalUrl}`);

    // Return successful response
    return new Response(
      JSON.stringify({
        ok: true,
        bundle,
        fetchedFrom: finalUrl,
        upstreamStatus,
        requestId,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        } 
      }
    );

  } catch (error) {
    console.error(`[fetch-bundle] Fetch error:`, error);
    
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    
    return new Response(
      JSON.stringify({
        ok: false,
        error: isTimeout ? 'Request timeout' : 'Network error',
        message: isTimeout 
          ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds`
          : (error instanceof Error ? error.message : 'Unknown network error'),
        requestId,
      }),
      { 
        status: 504, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        } 
      }
    );
  }
});
