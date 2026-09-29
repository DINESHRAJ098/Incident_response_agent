/**
 * ============================================================================
 * INCIDENT AI — BACKEND API CLIENT
 * ============================================================================
 *
 * Every network call the console makes lives here. The agent backend is the
 * FastAPI service deployed on Render ("Incident Resolution API"); this client
 * talks to it over plain `fetch`.
 *
 * ── BASE URL ─────────────────────────────────────────────────────────────────
 * The agent URL is compiled into the client: `DEFAULT_BACKEND_URL` below
 * points at the deployed Render service, so there is no URL input anywhere
 * in the UI. Requests are attempted over three routes, in order (see
 * `candidateUrls` below):
 *
 *   1. same-origin `/api/*` — the Vite dev proxy in dev (vite.config.ts)
 *      and the `api/[...path].ts` serverless relay in production;
 *   2. the public relay (`RELAY_URL`), which answers with permissive CORS
 *      headers so hosts without a same-origin route still work;
 *   3. the agent service directly, for deployments that allow the origin.
 *
 * Setting `VITE_BACKEND_URL` at build time replaces the direct route.
 *
 * ── ENDPOINT CONTRACT (the routes your FastAPI service actually exposes) ─────
 * Verified against /openapi.json on the live deployment:
 *
 *   GET  /
 *     Liveness probe → { "status": "ok", "llm_provider": "groq" }
 *
 *   POST /api/incidents/new?top_k=4
 *     The agent turn: analyze an incoming incident signal.
 *     Body (IncidentNew — required fields marked):
 *       { title: string ≥3,          "Short incident title"
 *         description: string ≥5,    "What happened / impact"
 *         logs?: string,             "Relevant log excerpt"
 *         severity?: "low"|"medium"|"high"|"critical" }
 *     → AnalyzeResponse:
 *       { incident_id: string,
 *         suggestions: [ { resolution: string, confidence: 0..1,
 *                          references: string[] } ],
 *         similar_incidents: [ { memory_id: string, text: string,
 *                                type?: string, document_id?: string|null } ] }
 *     `suggestions` become the recommended resolutions in the transcript;
 *     `similar_incidents` populate the memory context panel.
 *
 *   GET  /api/incidents/?q=&limit=20&offset=0
 *     Stored memory archive → { total: number, items: [
 *       { document_id: string, text: string, created_at: ISO,
 *         memory_count: number } ] }
 *     Document text is pipe/newline delimited:
 *       "incident-seed-010 | Title: … | Severity: … | Description: … |
 *        Logs: … | Resolution: …"
 *     (prefixes: `incident-` resolved fixes, `feedback-` user signals,
 *      `seed-` seeded samples)
 *
 *   GET  /api/incidents/{document_id}   full text of one stored document.
 *   POST /api/incidents/resolve         persist a resolved incident.
 *   POST /api/incidents/feedback        rate a suggestion helpful / not.
 *
 * ── CORS (required) ──────────────────────────────────────────────────────────
 * The browser enforces CORS on every response, so a server that answers
 * correctly to `curl` can still be unreachable from this console. The FastAPI
 * service must install the CORS middleware:
 *
 *   from fastapi.middleware.cors import CORSMiddleware
 *   app.add_middleware(CORSMiddleware, allow_origins=["*"],
 *                      allow_methods=["*"], allow_headers=["*"])
 *
 * Without it every request surfaces here as a `network` error.
 *
 * ── COLD STARTS ON RENDER FREE TIER ─────────────────────────────────────────
 * Free instances sleep after inactivity. The first request after a sleep can
 * take 30–50 seconds, so `fetchWithTimeout` uses a generous 90s chat timeout
 * and the UI flips to an explicit "Waking up your Render instance…" stage
 * after 4 seconds of waiting. Failures always surface a Retry action.
 * ============================================================================
 */


import type { AgentAnswer, IncidentPayload, IncidentRecord } from "@/domain/incident";
import { TIMEOUT_MS } from "./config";
import { fetchJson } from "./http";
import {
  isDict,
  normalizeAnalyzeResponse,
  normalizeIncident,
  toIncidentPayload,
  type RawAnalyzeResponse,
} from "./normalize";

export interface ChatPayload {
  sessionId?: string;
  message: string;
  history?: { role: "user" | "agent"; content: string }[];
}

export async function sendChat(
  baseUrl: string,
  payload: ChatPayload,
): Promise<AgentAnswer> {
  const message = payload.message.trim();
  const raw = await fetchJson<RawAnalyzeResponse>(
    baseUrl,
    "/api/incidents/new?top_k=4",
    {
      method: "POST",
      body: JSON.stringify(toIncidentPayload(message)),
    },
    TIMEOUT_MS.analyze,
  );
  const answer = normalizeAnalyzeResponse(raw);
  // Keep the analyzed text on the answer so the turn can be rated later.
  answer.incident = toIncidentPayload(message);
  return answer;
}

/* ---------------------------------------------------------------------------
 * POST /api/incidents/feedback — rate one answer
 *
 * The service stores ratings as new memory documents: helpful=True is kept as
 * a good example and ranked up for future recall, helpful=False is kept as a
 * counter-example to avoid. It holds no session state, so the full incident
 * text is resent here alongside the verdict.
 * ------------------------------------------------------------------------ */

/** Which suggestion a verdict applies to; `undefined` rates the whole answer. */
export type FeedbackScope = "top" | number;

export async function sendFeedback(
  baseUrl: string,
  incident: IncidentPayload,
  incidentId: string,
  helpful: boolean,
  scope: FeedbackScope = "top",
): Promise<void> {
  await fetchJson<Record<string, unknown>>(
    baseUrl,
    "/api/incidents/feedback",
    {
      method: "POST",
      body: JSON.stringify({
        incident_id: incidentId,
        title: incident.title,
        description: incident.description,
        logs: incident.logs,
        severity: incident.severity,
        helpful,
        suggestion_index: scope === "top" ? 0 : scope,
      }),
    },
    TIMEOUT_MS.feedback,
  );
}

/* ---------------------------------------------------------------------------
 * GET /api/incidents/ — the memory archive
 * ------------------------------------------------------------------------- */
export async function fetchIncidents(baseUrl: string): Promise<IncidentRecord[]> {
  const raw = await fetchJson<{ total?: unknown; items?: unknown }>(
    baseUrl,
    // Deliberately slashless: the route upstream is `/api/incidents/`, and a
    // trailing slash here is dropped by host routing (Vercel's `source:
    // "/api/:path*"` does not match it), which leaves the request answering
    // the SPA. The slashless form is matched by an exact rewrite rule that
    // puts the slash back on the upstream URL.
    "/api/incidents?limit=100",
    { method: "GET" },
    TIMEOUT_MS.incidents,
  );
  const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  return items
    .filter(isDict)
    .map((item, index) => normalizeIncident(item, index));
}
