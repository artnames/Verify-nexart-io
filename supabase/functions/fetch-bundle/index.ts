import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// SECURITY CONFIGURATION
// ============================================================

// Decision Certifier public certificate endpoint base URL
// This is the Supabase project hosting the public-certificate edge function
const DECISION_CERTIFIER_SUPABASE_PROJECT = 'nxjkrwcxyhftoaenyztu';
const DECISION_CERTIFIER_PUBLIC_BASE = `https://${DECISION_CERTIFIER_SUPABASE_PROJECT}.supabase.co/functions/v1/public-certificate`;

// Allowlisted domains for fetching bundles
const ALLOWED_DOMAINS = [
  // Decision Certifier domains
  'preview--decision-certifier.lovable.app',
  `${DECISION_CERTIFIER_SUPABASE_PROJECT}.supabase.co`,
  // Supabase wildcards
  '.supabase.co',
  '.supabase.in',
  // Recânon domains
  'recanon.lovable.app',
  'recanon.xyz',
  // Development
  'localhost',
];

// Allowed path patterns for public certificate endpoints
const PUBLIC_CERTIFICATE_PATHS = [
  '/functions/v1/public-certificate',
  '/api/public/certificates',
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

/**
 * Check if a URL is a public certificate endpoint (should never require auth)
 */
function isPublicCertificateEndpoint(url: URL): boolean {
  const pathname = url.pathname.toLowerCase();
  return PUBLIC_CERTIFICATE_PATHS.some(pattern => pathname.includes(pattern));
}

/**
 * Detect if a redirect Location header points to an auth page
 */
function isAuthRedirectLocation(locationHeader: string | null): boolean {
  if (!locationHeader) return false;
  
  try {
    const url = new URL(locationHeader);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    
    // Lovable auth-bridge detection
    if (hostname === 'lovable.dev' || hostname.endsWith('.lovable.dev')) {
      return true;
    }
    
    if (pathname.includes('/auth-bridge') || pathname.includes('/auth/')) {
      return true;
    }
    
    return false;
  } catch {
    // If URL parsing fails, check for patterns in the raw string
    return locationHeader.includes('lovable.dev') || 
           locationHeader.includes('auth-bridge') ||
           locationHeader.includes('/auth/');
  }
}

/**
 * Detect if the final URL is an auth redirect (e.g., Lovable auth-bridge)
 */
function isAuthRedirect(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  
  // Lovable auth-bridge detection
  if (hostname === 'lovable.dev' || hostname.endsWith('.lovable.dev')) {
    return true;
  }
  
  if (pathname.includes('/auth-bridge') || pathname.includes('/auth/')) {
    return true;
  }
  
  return false;
}

/**
 * Normalize a certificate hash to sha256:<lowercase-hex> format
 */
function normalizeHash(input: string): string | null {
  let hash = input.trim().toLowerCase();
  
  // Strip sha256: prefix if present
  if (hash.startsWith('sha256:')) {
    hash = hash.slice(7);
  }
  
  // Validate 64-char hex format
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return null;
  }
  
  return `sha256:${hash}`;
}

/**
 * Check if input looks like a certificate hash (not a URL)
 */
function looksLikeHash(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  
  // Check for sha256: prefix
  if (trimmed.startsWith('sha256:')) {
    const hex = trimmed.slice(7);
    return /^[a-f0-9]{64}$/.test(hex);
  }
  
  // Check for raw 64-char hex
  if (/^[a-f0-9]{64}$/.test(trimmed)) {
    return true;
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
  let targetUrl = reqUrl.searchParams.get('url');
  const hashParam = reqUrl.searchParams.get('hash');

  // If hash is provided (or URL looks like a hash), construct the Decision Certifier URL
  if (hashParam || (targetUrl && looksLikeHash(targetUrl))) {
    const hashInput = hashParam || targetUrl!;
    const normalizedHash = normalizeHash(hashInput);
    
    if (!normalizedHash) {
      return createErrorResponse(
        400, 
        'INVALID_HASH', 
        'Invalid hash format. Expected sha256:<64-hex-chars> or raw 64-char hex.',
        { providedInput: hashInput }
      );
    }
    
    // Construct the public certificate URL
    targetUrl = `${DECISION_CERTIFIER_PUBLIC_BASE}/${encodeURIComponent(normalizedHash)}`;
    console.log(`[fetch-bundle] Constructed URL from hash: ${targetUrl}`);
  }

  // Validate URL parameter
  if (!targetUrl) {
    return createErrorResponse(400, 'Missing URL', 'The "url" or "hash" query parameter is required');
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

  const isPublicEndpoint = isPublicCertificateEndpoint(parsedUrl);
  console.log(`[fetch-bundle] Fetching: ${targetUrl} (public endpoint: ${isPublicEndpoint})`);

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Use redirect: 'manual' to catch auth redirects before they happen
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Recanon-Bundle-Fetcher/1.0',
      },
      redirect: 'manual', // Don't follow redirects automatically
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const upstreamStatus = response.status;

    // Check for redirect responses (3xx)
    if (upstreamStatus >= 300 && upstreamStatus < 400) {
      const locationHeader = response.headers.get('location');
      console.log(`[fetch-bundle] Redirect ${upstreamStatus} -> ${locationHeader}`);
      
      // Check if it's an auth redirect
      if (isAuthRedirectLocation(locationHeader)) {
        console.warn(`[fetch-bundle] Detected auth redirect to: ${locationHeader}`);
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'AUTH_REDIRECT',
            message: 'The provided URL redirects to an auth page. The endpoint requires authentication. Use the public-certificate endpoint or Supabase REST URL.',
            upstreamStatus,
            redirectTo: locationHeader,
            requestId,
            suggestion: isPublicEndpoint 
              ? 'The public endpoint should not require auth. Check that the edge function is deployed correctly.'
              : `Try using the public certificate endpoint: ${DECISION_CERTIFIER_PUBLIC_BASE}/<hash>`,
          }),
          { 
            status: 403, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              'X-Request-Id': requestId,
            } 
          }
        );
      }
      
      // For non-auth redirects, follow them manually (one level only)
      if (locationHeader) {
        console.log(`[fetch-bundle] Following redirect to: ${locationHeader}`);
        
        // Validate redirect URL is also in allowlist
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(locationHeader, targetUrl);
        } catch {
          return createErrorResponse(400, 'Invalid redirect', 'The redirect URL is invalid');
        }
        
        if (!isDomainAllowed(redirectUrl)) {
          return createErrorResponse(
            403, 
            'Redirect domain not allowed', 
            `Redirect to "${redirectUrl.hostname}" is not in the allowlist`
          );
        }
        
        // Follow the redirect
        const redirectResponse = await fetch(redirectUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Recanon-Bundle-Fetcher/1.0',
          },
          redirect: 'manual',
          signal: controller.signal,
        });
        
        // Process the redirect response
        return await processResponse(redirectResponse, redirectUrl.toString(), requestId);
      }
    }

    return await processResponse(response, targetUrl, requestId);

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

/**
 * Process a fetch response and return the appropriate bundle or error
 */
async function processResponse(response: Response, fetchedFrom: string, requestId: string): Promise<Response> {
  const upstreamStatus = response.status;

  // Check if we landed on an auth page after redirects
  try {
    const finalUrl = new URL(fetchedFrom);
    if (isAuthRedirect(finalUrl)) {
      console.warn(`[fetch-bundle] Detected auth redirect to: ${fetchedFrom}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'AUTH_REDIRECT',
          message: 'The provided URL redirects to an auth page. Use a public JSON endpoint.',
          upstreamStatus,
          fetchedFrom,
          requestId,
          suggestion: `Try using the public certificate endpoint: ${DECISION_CERTIFIER_PUBLIC_BASE}/<hash>`,
        }),
        { 
          status: 403, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Request-Id': requestId,
          } 
        }
      );
    }
  } catch {
    // URL parsing failed, continue with response processing
  }

  // Check response status
  if (!response.ok) {
    const bodyPreview = await response.text().then(t => t.slice(0, 300));
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Upstream error',
        message: `The server returned status ${upstreamStatus}`,
        upstreamStatus,
        fetchedFrom,
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

  // Check content-type - MUST be application/json
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const bodyPreview = await response.text().then(t => t.slice(0, 300));
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Invalid content type',
        message: `Expected application/json but received "${contentType}"`,
        upstreamStatus,
        fetchedFrom,
        bodyPreview,
        requestId,
        suggestion: 'The endpoint must return application/json. HTML responses indicate auth redirects or incorrect endpoint.',
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
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Response too large',
        message: `Response size ${contentLength} exceeds maximum of ${MAX_RESPONSE_SIZE} bytes`,
        upstreamStatus,
        fetchedFrom,
        requestId,
      }),
      { 
        status: 413, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        } 
      }
    );
  }

  // Read and parse response
  const text = await response.text();
  
  if (text.length > MAX_RESPONSE_SIZE) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Response too large',
        message: `Response size ${text.length} exceeds maximum of ${MAX_RESPONSE_SIZE} bytes`,
        upstreamStatus,
        fetchedFrom,
        requestId,
      }),
      { 
        status: 413, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        } 
      }
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
        fetchedFrom,
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

  console.log(`[fetch-bundle] Success: parsed JSON bundle from ${fetchedFrom}`);

  // Return successful response
  return new Response(
    JSON.stringify({
      ok: true,
      bundle,
      fetchedFrom,
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
}
