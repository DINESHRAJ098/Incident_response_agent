/**
 * ============================================================================
 * INCIDENT AI — SERVER-SIDE AGENT RELAY
 * ============================================================================
 *
 * The console is a static SPA, so every call to the FastAPI agent service on
 * Render is a cross-origin browser request. The service answers `curl`
 * happily but only echoes `Access-Control-Allow-Origin` for origins on its
 * CORSMiddleware allow-list, so a browser can be refused even when the
 * service is healthy.
 *
 * A plain Vercel `rewrites` proxy is not enough here: rewrite destinations
 * normalize trailing slashes, and the agent's archive route
 * (`GET /api/incidents/`) is slash-sensitive. Dropping the slash makes
 * FastAPI answer `307` pointing at the cross-origin Render URL, which the
 * browser then follows into a CORS failure; with `source: "/api/:path*"` the
 * request instead falls through to the SPA's `index.html`. Both failure
 * modes were observed on the live deployment.
 *
 * This function avoids routing normalization entirely: it forwards the
 * incoming path verbatim and mirrors the upstream JSON back. It also sends
 * `Access-Control-Allow-Origin: *`, so hosts with no `/api` route of their
 * own (the Freebuff preview) can reach the agent service through this relay.
 *
 *   ANY /api/<path>?<query>  ->  https://<AGENT_ORIGIN>/api/<path>?<query>
 *
 * Render's free tier sleeps when idle, so the first call after a sleep can
 * take 30-50 seconds to wake; `maxDuration` is raised to the 60s plan cap.
 * ============================================================================
 */

const AGENT_ORIGIN = "https://hindsight-project-incident-agent.onrender.com";

/** Cold start (30-50s) plus LLM inference, kept under the 60s cap. */
const UPSTREAM_TIMEOUT_MS = 55_000;

/**
 * Minimal structural types for the Vercel Node handler, declared locally so
 * this file needs no `@vercel/node` dependency and stays lint-clean.
 */
interface RelayRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface RelayResponse {
  status(code: number): RelayResponse;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}

/** Vercel collapses repeated headers into an array; take the first value. */
function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Re-serialize whatever the runtime parsed into a body we can forward. */
function serializeBody(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  try {
    return JSON.stringify(body);
  } catch {
    return undefined;
  }
}

export const config = { maxDuration: 60 };

export default async function relay(req: RelayRequest, res: RelayResponse) {
  // Permissive CORS: the console is served from several origins (Vercel, the
  // Freebuff preview, localhost) and the relay holds no state of its own.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, accept");
  res.setHeader("access-control-max-age", "600");
  res.setHeader("cache-control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Forward the path exactly as received, trailing slash included, since the
  // agent's `/api/incidents/` route depends on it.
  const incoming = new URL(req.url ?? "/api", "http://relay.invalid");
  const forwarded = incoming.pathname.replace(/^\/api/, "") || "/";
  const target = `${AGENT_ORIGIN}/api${forwarded}${incoming.search}`;

  const method = req.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : serializeBody(req.body);

  const headers: Record<string, string> = { accept: "application/json" };
  const contentType = firstHeader(req.headers["content-type"]);
  if (body !== undefined && contentType) headers["content-type"] = contentType;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown transport error";
    res
      .status(504)
      .end(JSON.stringify({ detail: `The agent service did not respond: ${detail}` }));
    return;
  }

  const payload = await upstream.text();
  res.status(upstream.status);
  res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
  res.end(payload);
}
