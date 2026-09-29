/**
 * Transport layer: one `fetchJson` used by every endpoint.
 *
 * Tries three routes in order (same-origin /api, the public relay, the agent
 * directly), enforces a per-call timeout, and converts every failure into an
 * `ApiError` so the UI never has to interpret raw fetch errors.
 */

import { RELAY_URL } from "./config";
import { ApiError, CORS_HINT } from "./errors";

/**
 * The routes a request is tried over, most local first. `baseUrl` is empty in
 * dev, where the Vite proxy already answers same-origin.
 */
function candidateUrls(baseUrl: string, path: string): string[] {
  if (!baseUrl) return [path];
  return Array.from(new Set([path, `${RELAY_URL}${path}`, `${baseUrl}${path}`]));
}

export async function fetchJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  /** One transport attempt with its own deadline. */
  const attempt = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ApiError(
          "timeout",
          `No response after ${Math.round(timeoutMs / 1000)} seconds.`,
          "The instance may still be waking up. Retry in a moment — free-tier cold starts take 30–50 seconds.",
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const networkFailure = new ApiError(
    "network",
    "Could not reach the agent service.",
    CORS_HINT,
  );

  let response: Response | null = null;
  // A route that answers 5xx with an HTML error page is the site's own
  // gateway failing, not a CORS problem — remember it so the failure we
  // report is the real one.
  let gatewayFailure: Response | null = null;
  for (const url of candidateUrls(baseUrl, path)) {
    let candidate: Response;
    try {
      candidate = await attempt(url);
    } catch (error) {
      // A real timeout means the service itself is slow to answer; every
      // route reaches the same backend, so report it immediately.
      if (error instanceof ApiError) throw error;
      continue; // this transport is blocked or offline — try the next route
    }
    // A host without a relay answers /api with the SPA's index.html, which
    // never reaches the service — keep looking instead of parsing HTML.
    if (!(candidate.headers.get("content-type") ?? "").includes("json")) {
      if (candidate.status >= 500) gatewayFailure ??= candidate;
      continue;
    }
    response = candidate;
    break;
  }
  if (!response) {
    if (gatewayFailure) {
      throw new ApiError(
        "http",
        `The site's server answered HTTP ${gatewayFailure.status}.`,
        "The host in front of the agent service isn't serving the API right now — this is the site's own server, not the agent. Retry in a moment; if it persists the deployment is down.",
        gatewayFailure.status,
      );
    }
    throw networkFailure;
  }

  if (!response.ok) {
    const status = response.status;
    const hint =
      status === 404
        ? "That route doesn't exist on the agent service — the deployed API contract may have changed."
        : status === 502 || status === 503 || status === 504
          ? "The host in front of the agent service isn't answering (gateway error). That's the site's own server rather than the agent — retry shortly."
          : status >= 500
            ? "The agent service hit an internal error. Give it a moment and retry."
            : `The agent service rejected the request (HTTP ${status}).`;
    throw new ApiError("http", `Agent service responded with HTTP ${status}.`, hint, status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      "parse",
      "The agent service response was not valid JSON.",
      "This route must return `application/json` — the console cannot read an HTML page here.",
    );
  }
}
