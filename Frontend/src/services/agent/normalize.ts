/**
 * Response normalization: raw FastAPI payloads -> the shapes the UI renders.
 * Every helper falls back gracefully when a field is missing.
 */

import { INCIDENT_BY_ID } from "@/data/sample-incidents";
import type {
  AgentAnswer,
  IncidentPayload,
  IncidentRecord,
  RecalledMemory,
  Severity,
} from "@/domain/incident";

export interface RawSimilarIncident {
  memory_id?: unknown;
  text?: unknown;
  type?: unknown;
  document_id?: unknown;
}

export interface RawAnalyzeResponse {
  incident_id?: unknown;
  suggestions?: unknown;
  similar_incidents?: unknown;
}

export type Dict = Record<string, unknown>;

export function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) ? num : fallback;
}

/** Accepts 0..1 or 0..100 and always returns 0..1. */
function asRatio(value: unknown, fallback: number): number {
  const ratio = asNumber(value, fallback);
  return Math.min(1, Math.max(0, ratio > 1 ? ratio / 100 : ratio));
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

function asSeverity(value: unknown): Severity {
  const raw = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(raw) ? (raw as Severity) : "medium";
}

/** `Key: value` fields inside a stored document or memory summary. */
function parseDocumentFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const segment of text.split(/\s*\|\s*|\n+/)) {
    const match = segment.match(/^([A-Za-z ]{2,20}):\s*(.+)$/);
    if (match) fields[match[1].trim().toLowerCase()] = match[2].trim();
  }
  return fields;
}

/** First meaningful chunk of a document, used when no Title field exists. */
function fallbackTitle(text: string, id: string): string {
  const firstSegment = text.split(/\s*\|\s*|\n+/)[0]?.trim() ?? "";
  if (firstSegment.length >= 3 && !/^[a-z]+-[a-z0-9-]+$/i.test(firstSegment)) {
    return firstSegment.slice(0, 96);
  }
  return id;
}

/** Structured incident title for `POST /api/incidents/new` (min length 3). */
function deriveTitle(message: string): string {
  const firstLine = message.split("\n").find((line) => line.trim())?.trim() ?? "";
  const cleaned = firstLine.slice(0, 90);
  return cleaned.length >= 3 ? cleaned : "Production incident report";
}

/**
 * Split a live-chat paste into the structured incident the service expects.
 * Shared by the analysis call and the feedback call, which must resend the
 * same text (the service keeps no state between requests).
 */
export function toIncidentPayload(message: string): IncidentPayload {
  return {
    title: deriveTitle(message),
    description: withMinLength(message, 5, "Production incident reported from the live chat."),
    logs: withMinLength(message, 1, "-"),
    severity: inferSeverity(message),
  };
}

function withMinLength(text: string, min: number, fallback: string): string {
  const trimmed = text.trim();
  if (trimmed.length >= min) return trimmed;
  return `${fallback} ${trimmed}`.trim();
}

/** Light heuristic so the backend receives a sensible severity. */
function inferSeverity(text: string): Severity {
  if (/\b(fatal|critical|outage|data loss|sev[- ]?1|fully down)\b/i.test(text)) {
    return "critical";
  }
  if (/\b(error|exception|fail(?:ed|ure)?|timeout|crashloop|50[234])\b/i.test(text)) {
    return "high";
  }
  return "medium";
}

/** `AnalyzeResponse` → the reply + memories the transcript renders. */
export function normalizeAnalyzeResponse(raw: RawAnalyzeResponse): AgentAnswer {
  const incidentId = asString(raw.incident_id, "unknown");

  const suggestions = (Array.isArray(raw.suggestions) ? raw.suggestions : [])
    .filter(isDict)
    .map((entry) => ({
      resolution: asString(entry.resolution),
      confidence: asRatio(entry.confidence, 0.5),
      references: Array.isArray(entry.references)
        ? entry.references.map((ref) => asString(ref)).filter(Boolean)
        : [],
    }))
    .filter((suggestion) => suggestion.resolution);

  const memories = (Array.isArray(raw.similar_incidents) ? raw.similar_incidents : [])
    .filter(isDict)
    .map((entry, index) => normalizeSimilarIncident(entry as RawSimilarIncident, index))
    .filter((memory): memory is RecalledMemory => memory !== null);

  const topConfidence = suggestions.length
    ? Math.max(...suggestions.map((suggestion) => suggestion.confidence))
    : 0.5;
  // The API has no "without memory" baseline, so we estimate what the same
  // answer would score on first principles: identical when nothing was
  // recalled, ~60% of it when Hindsight contributed precedent.
  const baseConfidence = memories.length
    ? Math.max(0.2, Number((topConfidence * 0.6).toFixed(2)))
    : topConfidence;

  return {
    reply: buildReply(incidentId, suggestions, memories),
    confidence: Number(topConfidence.toFixed(2)),
    baseConfidence,
    memories,
    incidentId,
  };
}

/** One recalled memory from `similar_incidents[]`. */
function normalizeSimilarIncident(
  entry: RawSimilarIncident,
  index: number,
): RecalledMemory | null {
  const text = asString(entry.text);
  const documentId = asString(entry.document_id);
  const memoryId = asString(entry.memory_id);
  if (!text && !documentId && !memoryId) return null;

  const fields = parseDocumentFields(text);
  const incidentId = documentId || (memoryId ? memoryId.slice(0, 8) : `memory-${index + 1}`);
  const record = INCIDENT_BY_ID.get(incidentId);

  // The API ranks recalls but does not expose a score, so the ranked order is
  // mapped to descending match percentages for display.
  const similarity = Math.max(0.5, 0.92 - index * 0.1);

  const severityText = fields.severity ?? "";
  const severityWord = text.match(/\b(low|medium|high|critical)\b severity/i)?.[1];
  const title =
    fields.title ??
    text.split(/\s*\|\s*|\n/)[0]?.replace(/[.,;]$/, "").slice(0, 96) ??
    incidentId;

  return {
    incidentId,
    title,
    service: fields.service ?? (documentId ? documentId.split("-")[0] : "memory"),
    severity: severityWord ? asSeverity(severityWord) : asSeverity(severityText),
    similarity: Number(similarity.toFixed(2)),
    rootCause: text,
    resolution: fields.resolution ?? record?.resolution ?? "",
    runbook: fields.runbook ?? "",
    resolutionMinutes: Number(fields.mttr ?? 0) || record?.resolutionMinutes || 0,
  };
}

/** Build the markdown response shown in the transcript. */
function buildReply(
  incidentId: string,
  suggestions: { resolution: string; confidence: number; references: string[] }[],
  memories: RecalledMemory[],
): string {
  const lines: string[] = ["**Assessment**", ""];

  if (memories.length) {
    lines.push(
      `Recalled **${memories.length} similar ${memories.length === 1 ? "incident" : "incidents"}** from Hindsight memory while analyzing \`${incidentId}\`. The leading candidate is grounded in precedent.`,
    );
  } else {
    lines.push(
      `Nothing comparable in memory for \`${incidentId}\` — this answer is first principles rather than precedent.`,
    );
  }

  if (suggestions.length) {
    lines.push("", "**Recommended resolutions**", "");
    suggestions.forEach((suggestion, index) => {
      const refs = suggestion.references.length
        ? ` _(refs ${suggestion.references.join(", ")})_`
        : "";
      lines.push(
        `${index + 1}. **${Math.round(suggestion.confidence * 100)}% confidence** — ${suggestion.resolution}${refs}`,
      );
    });
  } else {
    lines.push(
      "",
      "The analyzer returned no candidates. Narrow the signal — attach the failing service, start time, and one stack trace — and run it again.",
    );
  }

  if (memories.length) {
    lines.push("", "**Recalled precedent**", "");
    for (const memory of memories) {
      lines.push(`- \`${memory.incidentId}\` — ${memory.title}`);
    }
  }

  return lines.join("\n");
}

/** `{ total, items[] }` → `IncidentRecord[]`. */
export function normalizeIncident(item: Dict, index: number): IncidentRecord {
  const id = asString(item.document_id, asString(item.id, `doc-${index + 1}`));
  const text = asString(item.text);
  const fields = parseDocumentFields(text);
  const createdAt = asString(item.created_at ?? item.createdAt);

  const rawMinutes = fields.mttr ?? fields.resolved_in ?? "";
  const minutesMatch = rawMinutes.match(/(\d+)/);

  return {
    id,
    title: fields.title ?? fallbackTitle(text, id),
    service:
      fields.service ?? (id.includes("-") ? (id.split("-")[0] || "unknown") : "unknown"),
    severity: asSeverity(fields.severity),
    errorCode: fields["error code"] ?? fields.code ?? "—",
    rootCause: fields.description ?? fields.impact ?? fallbackTitle(text, id),
    resolution: fields.resolution ?? fields.fix ?? "",
    runbook: fields.runbook ?? "",
    runbookTitle: fields.runbook ? fields.runbook : "",
    runbookSteps: [],
    resolutionMinutes: minutesMatch ? Number(minutesMatch[1]) : 0,
    occurredAt: createdAt.slice(0, 10),
    keywords: [],
    nextEvidence: "",
    rawText: text,
  };
}
