/**
 * DOMAIN MODEL — the shared vocabulary of the whole frontend.
 *
 * Pure types plus the one severity style table. Nothing here does I/O; the
 * services layer (`src/services/agent`) produces these shapes from the API
 * and the feature components consume them.
 */

export type Severity = "critical" | "high" | "medium" | "low";

/** One closed incident stored in the agent's long-term memory. */
export interface IncidentRecord {
  /** Stable identifier, e.g. `INC-402`. */
  id: string;
  title: string;
  /** Owning service, e.g. `payments-api`. */
  service: string;
  severity: Severity;
  /** Error / signal code the incident was filed under, e.g. `PG-53300`. */
  errorCode: string;
  /** Why it broke — written when the incident was closed. */
  rootCause: string;
  /** One-line summary of the fix that ended the outage. */
  resolution: string;
  /** Runbook identifier, e.g. `RB-014`. */
  runbook: string;
  /** Runbook title, used in chat recommendations. */
  runbookTitle: string;
  /** Ordered steps from the runbook that worked last time. */
  runbookSteps: string[];
  /** Minutes from first alert to resolved. */
  resolutionMinutes: number;
  /** ISO date the incident occurred. */
  occurredAt: string;
  /** Matching hints used by the demo-mode recall engine. */
  keywords: string[];
  /** The single piece of evidence that would confirm this hypothesis fast. */
  nextEvidence: string;
  /** Raw stored document text (backend records) shown in the detail drawer. */
  rawText?: string;
}

/** An incident the agent pulled back out of memory while answering. */
export interface RecalledMemory {
  incidentId: string;
  title: string;
  service: string;
  severity: Severity;
  /** 0..1 match between the incoming signal and the stored incident. */
  similarity: number;
  rootCause: string;
  resolution: string;
  runbook: string;
  resolutionMinutes: number;
}

/**
 * The incident text sent to the agent for one turn. The service keeps no state
 * between requests, so feedback has to resend this alongside the rating.
 */
export interface IncidentPayload {
  title: string;
  description: string;
  logs: string;
  severity: Severity;
}

/** One agent turn: the reply plus the evidence behind it. */
export interface AgentAnswer {
  /** Markdown response rendered in the transcript. */
  reply: string;
  /** 0..1 confidence *with* recalled memory applied. */
  confidence: number;
  /** 0..1 confidence the same answer would carry *without* memory. */
  baseConfidence: number;
  /** Incidents recalled for this turn (empty when nothing matched). */
  memories: RecalledMemory[];
  /** Incident id assigned by the backend for this analysis. */
  incidentId?: string;
  /** What was analyzed, kept so this turn can be rated later. */
  incident?: IncidentPayload;
}

/** A chat entry in the live workspace. */
export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  /** Epoch ms. */
  at: number;
  /** Present on agent messages. */
  answer?: AgentAnswer;
  /** True only for the most recent agent reply — drives the reveal animation. */
  animate?: boolean;
  /** Set once the user rates this response; the buttons lock to that verdict. */
  feedback?: boolean;
}

/** A preset outage in the Simulated Triage view. */
export interface MockOutage {
  id: string;
  name: string;
  service: string;
  severity: Severity;
  errorCode: string;
  summary: string;
  /** Realistic log/stack trace pasted into the chat when the preset fires. */
  log: string;
}

/** Semantic styling for severity — the one place severity colors are defined. */
export const SEVERITY_STYLES: Record<
  Severity,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
  high: {
    label: "High",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  medium: {
    label: "Medium",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
  low: {
    label: "Low",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  },
};
