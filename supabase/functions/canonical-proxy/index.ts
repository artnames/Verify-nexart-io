import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// SECURITY CONFIGURATION
// ============================================================

// Allowlisted routes - ONLY these endpoints are proxied
const ALLOWED_ROUTES = new Set(['/health', '/render', '/verify', '', '/']);

// Maximum payload size (1MB for render requests with code)
const MAX_PAYLOAD_SIZE = 1024 * 1024;

// Rate limiting configuration
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

// In-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getClientIP(req: Request): string {
  // Try various headers that might contain the client IP
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  // Fallback to a generic identifier
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_WINDOW_MS };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetIn: record.resetTime - now };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000); // Clean every minute

function createErrorResponse(
  status: number, 
  error: string, 
  message: string, 
  rateRemaining?: number,
  extra?: Record<string, unknown>
): Response {
  const body = JSON.stringify({ error, message, ...extra });
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };
  
  if (rateRemaining !== undefined) {
    headers['X-RateLimit-Remaining'] = String(rateRemaining);
  }
  
  return new Response(body, { status, headers });
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/canonical-proxy', '');

  // ========== SECURITY: Route allowlist ==========
  if (!ALLOWED_ROUTES.has(path)) {
    console.warn(`[canonical-proxy] Blocked unknown route: ${path}`);
    return createErrorResponse(
      404,
      'Not found',
      `Unknown endpoint: ${path}. Only /health, /render, and /verify are allowed.`
    );
  }

  // Get the canonical renderer URL from secrets
  const CANONICAL_RENDERER_URL = Deno.env.get('CANONICAL_RENDERER_URL');
  
  if (!CANONICAL_RENDERER_URL) {
    console.error('[canonical-proxy] CANONICAL_RENDERER_URL secret not configured');
    return createErrorResponse(
      500,
      'Proxy not configured',
      'Missing CANONICAL_RENDERER_URL secret. Contact administrator.'
    );
  }

  // ========== SECURITY: Rate limiting ==========
  const clientIP = getClientIP(req);
  const rateCheck = checkRateLimit(clientIP);
  
  if (!rateCheck.allowed) {
    console.warn(`[canonical-proxy] Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ 
        error: 'Rate limit exceeded',
        message: `Too many requests. Please wait ${Math.ceil(rateCheck.resetIn / 1000)} seconds before retrying.`,
        retryAfter: Math.ceil(rateCheck.resetIn / 1000)
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateCheck.resetIn / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateCheck.resetIn / 1000))
        } 
      }
    );
  }

  // Get API key for authenticated endpoints
  const CANONICAL_RENDERER_API_KEY = Deno.env.get('CANONICAL_RENDERER_API_KEY');

  // Route handling
  let targetPath: string;
  let method = req.method;
  let body: string | null = null;
  let requiresAuth = false;
  let expectsBinaryResponse = false;

  if (path === '/health' || path === '' || path === '/') {
    targetPath = '/health';
    method = 'GET';
  } else if (path === '/render') {
    if (method !== 'POST') {
      return createErrorResponse(405, 'Method not allowed', 'POST required for /render', rateCheck.remaining);
    }
    // Use authenticated /api/render endpoint
    targetPath = '/api/render';
    requiresAuth = true;
    expectsBinaryResponse = true; // NexArt returns PNG binary
    
    // ========== SECURITY: Payload size limit ==========
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      console.warn(`[canonical-proxy] Payload too large: ${contentLength} bytes`);
      return createErrorResponse(
        413, 
        'Payload too large', 
        `Request body exceeds maximum size of ${MAX_PAYLOAD_SIZE / 1024}KB`,
        rateCheck.remaining
      );
    }
    
    const rawBody = await req.text();
    
    // Double-check actual body size
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      console.warn(`[canonical-proxy] Payload too large after read: ${rawBody.length} bytes`);
      return createErrorResponse(
        413, 
        'Payload too large', 
        `Request body exceeds maximum size of ${MAX_PAYLOAD_SIZE / 1024}KB`,
        rateCheck.remaining
      );
    }
    
    // ========== SECURITY: Basic payload validation ==========
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed.code || typeof parsed.code !== 'string') {
        return createErrorResponse(
          400,
          'Invalid request',
          'Missing or invalid "code" field. Snapshot must include a code string.',
          rateCheck.remaining
        );
      }
      
      // Transform payload to NexArt API format
      const nexartPayload = {
        code: parsed.code,
        seed: String(parsed.seed ?? 0), // NexArt expects string seed
        VAR: parsed.vars || parsed.VAR || [0,0,0,0,0,0,0,0,0,0], // NexArt uses VAR not vars
        protocolVersion: "1.2.0",
      };
      
      body = JSON.stringify(nexartPayload);
      console.log(`[canonical-proxy] Transformed payload: seed=${nexartPayload.seed}, VAR length=${nexartPayload.VAR.length}`);
      
    } catch {
      return createErrorResponse(
        400,
        'Invalid JSON',
        'Request body must be valid JSON.',
        rateCheck.remaining
      );
    }
  } else if (path === '/verify') {
    if (method !== 'POST') {
      return createErrorResponse(405, 'Method not allowed', 'POST required for /verify', rateCheck.remaining);
    }
    
    // Payload size limit for verify
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return createErrorResponse(
        413, 
        'Payload too large', 
        `Request body exceeds maximum size of ${MAX_PAYLOAD_SIZE / 1024}KB`,
        rateCheck.remaining
      );
    }
    
    const verifyBody = await req.text();
    
    if (verifyBody.length > MAX_PAYLOAD_SIZE) {
      return createErrorResponse(
        413, 
        'Payload too large', 
        `Request body exceeds maximum size of ${MAX_PAYLOAD_SIZE / 1024}KB`,
        rateCheck.remaining
      );
    }

    // Parse verify request and handle verification locally by re-rendering
    try {
      const parsed = JSON.parse(verifyBody);
      const snapshot = parsed.snapshot || parsed;
      // Support multiple hash field names from different client versions
      const expectedHash = parsed.expectedHash || parsed.expectedImageHash || parsed.expectedPosterHash || parsed.posterHash;
      
      if (!snapshot.code || typeof snapshot.code !== 'string') {
        return createErrorResponse(400, 'Invalid request', 'Missing snapshot.code for verification', rateCheck.remaining);
      }
      if (!expectedHash) {
        return createErrorResponse(400, 'Invalid request', 'Missing expectedImageHash for verification', rateCheck.remaining);
      }

      // Check API key
      if (!CANONICAL_RENDERER_API_KEY) {
        return createErrorResponse(500, 'Proxy not configured', 'Missing CANONICAL_RENDERER_API_KEY secret.', rateCheck.remaining);
      }

      // Re-render the snapshot to verify
      const nexartPayload = {
        code: snapshot.code,
        seed: String(snapshot.seed ?? 0),
        VAR: snapshot.vars || snapshot.VAR || [0,0,0,0,0,0,0,0,0,0],
        protocolVersion: "1.2.0",
      };

      console.log(`[canonical-proxy] Verify: re-rendering to compare with expected hash ${expectedHash.substring(0, 16)}...`);

      const renderResponse = await fetch(`${CANONICAL_RENDERER_URL}/api/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'image/png',
          'Authorization': `Bearer ${CANONICAL_RENDERER_API_KEY}`,
          'Cache-Control': 'no-store',
          'X-Request-Id': crypto.randomUUID(),
        },
        body: JSON.stringify(nexartPayload),
      });

      if (!renderResponse.ok) {
        const errorText = await renderResponse.text();
        console.error(`[canonical-proxy] Verify render failed: ${renderResponse.status} — ${errorText.substring(0, 500)}`);
        return new Response(
          JSON.stringify({
            verified: false,
            error: 'Render failed during verification',
            upstreamStatus: renderResponse.status,
            requestId: crypto.randomUUID(),
          }),
          { 
            status: 200, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-Request-Id': crypto.randomUUID(),
            } 
          }
        );
      }

      // Compute hash of re-rendered PNG
      const pngBuffer = await renderResponse.arrayBuffer();
      const pngBytes = new Uint8Array(pngBuffer);
      const hashBuffer = await crypto.subtle.digest('SHA-256', pngBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Normalize hashes for comparison (strip sha256: prefix, lowercase)
      const normalizeHash = (h: string) => h.replace(/^sha256:/i, '').toLowerCase();
      const expectedNorm = normalizeHash(expectedHash);
      const computedNorm = normalizeHash(computedHash);
      const verified = expectedNorm === computedNorm;

      console.log(`[canonical-proxy] Verify result: ${verified ? 'PASSED' : 'FAILED'} (expected=${expectedNorm.substring(0,16)}, computed=${computedNorm.substring(0,16)})`);

      const requestId = crypto.randomUUID();
      return new Response(
        JSON.stringify({
          verified,
          expectedHash: expectedNorm,
          computedHash: computedNorm,
          match: verified,
          pngByteLength: pngBytes.length,
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateCheck.remaining),
            'X-Request-Id': requestId,
          } 
        }
      );

    } catch (err) {
      console.error(`[canonical-proxy] Verify error:`, err);
      return createErrorResponse(400, 'Invalid request', 'Failed to process verification request', rateCheck.remaining);
    }
  } else {
    // This shouldn't happen due to allowlist check above, but just in case
    return createErrorResponse(404, 'Not found', `Unknown endpoint: ${path}`);
  }

  // Proxy the request
  const targetUrl = `${CANONICAL_RENDERER_URL}${targetPath}`;
  console.log(`[canonical-proxy] Proxying ${method} ${path} -> ${targetUrl}`);

  // Check if API key is required but not configured
  if (requiresAuth && !CANONICAL_RENDERER_API_KEY) {
    console.error('[canonical-proxy] CANONICAL_RENDERER_API_KEY secret not configured for authenticated endpoint');
    return createErrorResponse(
      500,
      'Proxy not configured',
      'Missing CANONICAL_RENDERER_API_KEY secret. Contact administrator.'
    );
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Request-Id': crypto.randomUUID(),
    };

    // Add API key for authenticated endpoints
    if (requiresAuth && CANONICAL_RENDERER_API_KEY) {
      headers['Authorization'] = `Bearer ${CANONICAL_RENDERER_API_KEY}`;
    }

    // Request PNG binary for render endpoint
    if (expectsBinaryResponse) {
      headers['Accept'] = 'image/png';
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      fetchOptions.body = body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[canonical-proxy] Upstream error: ${response.status} — ${errorText.substring(0, 500)}`);
      
      // Return 502 for upstream server errors — no raw details to client
      if (response.status >= 500) {
        return new Response(
          JSON.stringify({ 
            error: 'Bad Gateway', 
            message: 'Canonical renderer returned an error. Please try again later.',
            upstreamStatus: response.status,
          }),
          { 
            status: 502, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-RateLimit-Remaining': String(rateCheck.remaining)
            } 
          }
        );
      }

      // Forward client errors as-is (400-499)
      return new Response(
        errorText,
        { 
          status: response.status, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateCheck.remaining)
          } 
        }
      );
    }

    console.log(`[canonical-proxy] Success: ${method} ${path}`);

    // Handle binary PNG response from render endpoint
    if (expectsBinaryResponse) {
      const pngBuffer = await response.arrayBuffer();
      const pngBytes = new Uint8Array(pngBuffer);
      
      // Compute SHA-256 hash of PNG bytes
      const hashBuffer = await crypto.subtle.digest('SHA-256', pngBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Convert to base64 using chunked approach to avoid stack overflow
      let base64 = '';
      const chunkSize = 32768; // Process 32KB at a time
      for (let i = 0; i < pngBytes.length; i += chunkSize) {
        const chunk = pngBytes.subarray(i, Math.min(i + chunkSize, pngBytes.length));
        base64 += String.fromCharCode.apply(null, Array.from(chunk));
      }
      base64 = btoa(base64);
      
      console.log(`[canonical-proxy] PNG response: ${pngBytes.length} bytes, hash=${imageHash.substring(0, 16)}...`);
      
      // Return JSON with base64 PNG and computed hash
      return new Response(
        JSON.stringify({
          type: 'static',
          mime: 'image/png',
          imageHash: imageHash,
          imageBase64: base64,
          debug: {
            pngByteLength: pngBytes.length,
            hashSource: 'sha256(pngBytes)',
          }
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateCheck.remaining),
            'X-Proxy': 'canonical-proxy'
          },
        }
      );
    }

    // Handle JSON response for other endpoints
    const data = await response.text();
    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(rateCheck.remaining),
        'X-Proxy': 'canonical-proxy'
      },
    });

  } catch (error) {
    console.error(`[canonical-proxy] Fetch error:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Bad Gateway', 
        message: 'Failed to reach canonical renderer. Please try again later.',
      }),
      { 
        status: 502, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(rateCheck.remaining)
        } 
      }
    );
  }
});
