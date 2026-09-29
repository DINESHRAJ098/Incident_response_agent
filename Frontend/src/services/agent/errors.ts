/** Normalized errors: every failure the UI shows carries a retry-friendly hint. */

export type ApiErrorKind = "timeout" | "network" | "http" | "parse";

/** Normalized error the UI renders with a retry affordance. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** One-line, user-facing explanation of what to check next. */
  readonly hint: string;

  constructor(kind: ApiErrorKind, message: string, hint: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.hint = hint;
    this.status = status;
  }
}

/** Coerce anything thrown inside the client into a renderable `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return new ApiError("network", message, "The agent service didn't respond — try again.");
}

export const CORS_HINT =
  "Every route was tried — the console's own relay, the public relay, and the agent service directly. The service answers outside the browser but not from this page, so set allow_origins to [\"*\"] on it (with allow_credentials off) and retry.";
