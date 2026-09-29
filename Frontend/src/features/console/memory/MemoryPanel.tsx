import { motion } from "framer-motion";
import { ArrowRight, Brain, Radio } from "lucide-react";
import { SeverityBadge } from "@/components/SeverityBadge";
import { useConsole } from "@/features/console/ConsoleProvider";
import { cn } from "@/lib/utils";

/**
 * MemoryPanel — the "what the agent is remembering right now" rail.
 *
 * Shows the incidents recalled for the focused response (by default the
 * newest one), each with its similarity score, root cause, and the runbook
 * that resolved it — plus the confidence delta memory contributed. Appears
 * as a persistent rail on wide screens and as a sheet below `xl`.
 */
export function MemoryPanel({
  onNavigate,
  inSheet = false,
}: {
  onNavigate?: () => void;
  /** True when rendered inside a sheet — keeps the header clear of its close button. */
  inSheet?: boolean;
}) {
  const {
    activeAnswer,
    activeMessageId,
    focusMemory,
    incidents,
    openIncident,
    setView,
    messages,
  } = useConsole();

  const agentMessages = messages.filter((message) => message.role === "agent");
  const latestAgentId = agentMessages.length
    ? agentMessages[agentMessages.length - 1].id
    : null;
  const isLatest = !activeMessageId || activeMessageId === latestAgentId;

  const memories = activeAnswer?.memories ?? [];
  const confidence = activeAnswer ? Math.round(activeAnswer.confidence * 100) : 0;
  const baseConfidence = activeAnswer ? Math.round(activeAnswer.baseConfidence * 100) : 0;
  const delta = Math.max(0, confidence - baseConfidence);

  const browseArchive = () => {
    setView("memory");
    onNavigate?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar/40">
      <header
        className={cn(
          "flex shrink-0 items-start gap-2.5 border-b border-border/70 px-4 py-3.5",
          inSheet && "pr-12",
        )}
      >
        <span className="mt-0.5 flex size-6 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10">
          <Brain className="size-3.5 text-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold tracking-tight">Memory context</h2>
          <p className="text-[11px] leading-snug text-muted-foreground">
            What the agent is recalling for this response
          </p>
        </div>
        <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {memories.length}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!activeAnswer ? (
          <EmptyState
            title="Memory idle"
            body={`Send an error log and the agent searches all ${incidents.length} stored incidents for a matching failure signature.`}
          />
        ) : memories.length === 0 ? (
          <EmptyState
            title="No match in memory"
            body={`The agent answered without precedent — ${incidents.length} records stored, none sharing this signal. Matches need a common error code, service name, or failure keyword.`}
          />
        ) : (
          <>
            {/* Confidence contribution of this recall */}
            <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11.5px] text-emerald-200/90">
                  Confidence with recall
                </span>
                <span className="font-mono text-[15px] font-medium text-emerald-300">
                  {confidence}%
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
                {baseConfidence}% without memory ·{" "}
                <span className="text-emerald-400">+{delta} pts from recall</span>
              </p>
            </div>

            {!isLatest && latestAgentId && (
              <button
                type="button"
                onClick={() => focusMemory(latestAgentId)}
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Radio className="size-3" />
                Showing an earlier response — return to latest
              </button>
            )}

            <div className="space-y-3">
              {memories.map((memory, index) => (
                <motion.article
                  key={memory.incidentId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: index * 0.07 }}
                  className="rounded-lg border border-border/80 bg-card/60 p-3.5 transition-colors hover:border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {memory.incidentId}
                    </span>
                    <span className="font-mono text-[11px] font-medium text-emerald-400">
                      {Math.round(memory.similarity * 100)}% match
                    </span>
                  </div>

                  <h3 className="mt-1.5 text-[13px] font-medium leading-snug">
                    {memory.title}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <SeverityBadge severity={memory.severity} />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {memory.service}
                    </span>
                    {memory.resolutionMinutes > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        · resolved in {memory.resolutionMinutes} min
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2.5">
                    <Field label="Root cause" body={memory.rootCause} />
                    <Field label="What fixed it" body={memory.resolution} />
                  </div>

                  {/* similarity bar */}
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-emerald-500/80"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(memory.similarity * 100)}%` }}
                      transition={{ duration: 0.6, delay: 0.1 + index * 0.07 }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                    {memory.runbook ? (
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        runbook {memory.runbook}
                      </span>
                    ) : (
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        recalled {memory.similarity >= 0.8 ? "strongly" : "partially"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        openIncident(memory.incidentId);
                        onNavigate?.();
                      }}
                      className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-emerald-400 transition-colors hover:text-emerald-300"
                    >
                      Open record
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-border/70 px-4 py-3">
        <button
          type="button"
          onClick={browseArchive}
          className="flex w-full items-center justify-between rounded-md border border-border/80 bg-card/60 px-3 py-2 text-[12.5px] transition-colors hover:border-border hover:bg-card"
        >
          <span>Browse the incident archive</span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
            {incidents.length} records
            <ArrowRight className="size-3" />
          </span>
        </button>
      </footer>
    </div>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <p className="mb-0.5 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/80">
        {label}
      </p>
      <p className="line-clamp-3 text-[12px] leading-relaxed text-foreground/75">{body}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-2 text-center">
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50">
        <Brain className="size-4 text-muted-foreground" />
      </span>
      <p
        className={cn(
          "mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground",
        )}
      >
        {title}
      </p>
      <p className="mt-2 max-w-[260px] text-[12.5px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
