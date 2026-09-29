export { sendChat, sendFeedback, fetchIncidents } from "./client";
export type { ChatPayload, FeedbackScope } from "./client";
export { ApiError, toApiError } from "./errors";
export type { ApiErrorKind } from "./errors";
export { DEFAULT_BACKEND_URL, RELAY_URL, resolveBaseUrl } from "./config";
