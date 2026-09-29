/**
 * Where the agent lives and how long we wait for it.
 *
 * The URL is compiled into the client, so there is no connection screen.
 * Override the direct route at build time with `VITE_BACKEND_URL`.
 */

/**
 * The deployed Incident AI agent service. Compiled into the client so the
 * console connects immediately — no configuration screen, no URL entry.
 */
export const DEFAULT_BACKEND_URL =
  "https://hindsight-project-incident-agent.onrender.com";

/**
 * The public relay: the `api/[...path].ts` serverless function on the Vercel
 * deployment. It proxies to the agent service and answers with
 * `Access-Control-Allow-Origin: *`, so it can also serve hosts that have no
 * same-origin `/api` route of their own — such as the Freebuff preview.
 */
export const RELAY_URL = "https://incident-agent-o8vf.vercel.app";

/* ---------------------------------------------------------------------------
 * Base URL — hardcoded default, dev relay, optional build-time override.
 * ------------------------------------------------------------------------- */
export function resolveBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  // Dev/preview: same-origin "/api" is relayed by the Vite dev server to the
  // deployed service (see vite.config.ts), so the browser never hits CORS.
  // Production builds talk to the compiled-in URL directly.
  return import.meta.env.DEV ? "" : DEFAULT_BACKEND_URL;
}

/** Per-call deadlines (ms). Generous because of Render free-tier cold starts. */
export const TIMEOUT_MS = {
  analyze: 90_000, // Render cold start (30–50s) + LLM inference
  incidents: 70_000, // relay budget is 55s upstream, so stay above it
  feedback: 70_000, // no LLM, but the relay may still be waking Render
};
