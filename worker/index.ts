/**
 * CBT.AI — Edge Worker Gateway
 * Routes /api/* to the secure remote backend.
 * Routes all other paths to static SPA assets.
 */

interface Env {
  ASSETS: {
    fetch: typeof fetch;
  };
  BACKEND_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── API Routing ──────────────────────────────────────────────────────────
    if (url.pathname.startsWith('/api/')) {
      const backendBase = env.BACKEND_API_URL || 'http://127.0.0.1:3001';

      try {
        const targetUrl = new URL(url.pathname + url.search, backendBase);
        const headers = new Headers(request.headers);
        headers.set('X-Forwarded-Host', url.host);
        headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

        const init: RequestInit & { duplex?: string } = {
          method: request.method,
          headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          duplex: 'half',
        };

        const backendResponse = await fetch(targetUrl.toString(), init as RequestInit);
        return backendResponse;
      } catch (err: any) {
        // Return structured JSON instead of HTML fallback when backend is reaching
        return new Response(
          JSON.stringify({
            status: 'unavailable',
            error: 'AI Examination engine is connecting. Please retry in a moment.',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // ── Static Asset & SPA Routing ───────────────────────────────────────────
    return env.ASSETS.fetch(request);
  },
};
