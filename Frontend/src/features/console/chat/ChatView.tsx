import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark } from "@/components/BrandMark";
import { ChatMessageItem } from "@/features/console/chat/ChatMessage";
import { MemoryPanel } from "@/features/console/memory/MemoryPanel";
import { useConsole, type Stage } from "@/features/console/ConsoleProvider";
import { MOCK_OUTAGES } from "@/data/mock-outages";
import type { MockOutage } from "@/domain/incident";

/**
 * View A — Live incident chat & agent workspace.
 *
 * Center: the transcript (paste logs, watch the agent answer). Right: the
 * memory context rail (xl and up; a sheet below that). Bottom: the composer
 * with a one-click "simulate outage" menu. Failures render inline with a
 * retry, and long-running requests surface the Render wake-up state.
 */
export function ChatView() {
  const {
    messages,
    isSending,
    stage,
    sendError,
    send,
    retryLast,
    clearChat,
    injectPreset,
    rate,
  } = useConsole();

  const [memoryOpen, setMemoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastAgentId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "agent") return messages[i].id;
    }
    return null;
  }, [messages]);

  // Keep the newest message in view as the transcript grows.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, stage]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    void send(text);
  };

  const showEmptyState = messages.length === 0 && !stage;

  return (
    <div className="flex h-full min-h-0">
      {/* ------------------------------------------------ transcript column */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 px-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight">Live incident chat</h1>
            <p className="hidden truncate text-[11.5px] text-muted-foreground sm:block">
              Paste a log, stack trace, or outage summary — the agent answers from incident
              memory.
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 xl:hidden"
              onClick={() => setMemoryOpen(true)}
            >
              <Brain className="size-3.5" />
              Memory
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={clearChat}
              disabled={isSending || messages.length === 0}
            >
              <RotateCcw className="size-3.5" />
              Clear
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-7">
            {showEmptyState && <EmptyTranscript onPick={injectPreset} />}

            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChatMessageItem
                  message={message}
                  isLatestAgent={message.id === lastAgentId}
                  onFeedback={(helpful, scope) => rate(message.id, helpful, scope)}
                />
              </motion.div>
            ))}

            {stage && <StageIndicator stage={stage} />}

            {sendError && !isSending && (
              <ErrorCard error={sendError} onRetry={() => void retryLast()} />
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ composer */}
        <div className="shrink-0 border-t border-border/70 bg-background/85 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card/70 p-2 transition-colors focus-within:border-emerald-500/40">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Paste an error log, stack trace, or describe the outage…"
                rows={2}
                className="max-h-44 min-h-[44px] flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 font-mono text-[12.5px] leading-relaxed shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              />

              <Button
                type="button"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={handleSend}
                disabled={!draft.trim() || isSending}
              >
                {isSending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Send
              </Button>
            </div>

            <p className="mt-1.5 hidden px-1 font-mono text-[10.5px] text-muted-foreground/70 sm:block">
              Enter to send · Shift + Enter for a new line
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- memory rail (xl+) */}
      <aside className="hidden w-[350px] shrink-0 border-l border-border/70 xl:block">
        <MemoryPanel />
      </aside>

      {/* -------------------------------------------- memory sheet (below xl) */}
      <Sheet open={memoryOpen} onOpenChange={setMemoryOpen}>
        <SheetContent
          side="right"
          className="w-[92vw] max-w-[380px] gap-0 border-l p-0"
        >
          <SheetTitle className="sr-only">Memory context</SheetTitle>
          <MemoryPanel onNavigate={() => setMemoryOpen(false)} inSheet />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ==========================================================================
 * Sub-blocks
 * ========================================================================== */

function StageIndicator({ stage }: { stage: Stage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/60 px-4 py-3"
    >
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-emerald-400" />
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{stage.label}</p>
        {stage.sub && (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            {stage.sub}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ErrorCard({
  error,
  onRetry,
}: {
  error: { message: string; hint: string };
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-4 py-3.5">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-rose-200">
            The agent didn&apos;t respond
          </p>
          <p className="mt-1 text-[12.5px] text-foreground/80">{error.message}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {error.hint}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" className="gap-1.5" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyTranscript({
  onPick,
}: {
  onPick: (preset: MockOutage) => Promise<void>;
}) {
  return (
    <div className="flex min-h-[46vh] flex-col items-center justify-center px-2 text-center">
      <BrandMark size={44} />
      <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.2em] text-emerald-400/85">
        agent ready
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Describe the outage.</h2>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
        Paste what production is doing — a stack trace, an alert payload, a wall of log
        lines. The agent recalls the closest stored incidents and answers with the runbook
        that worked last time.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          or fire a preset
        </span>
        {MOCK_OUTAGES.slice(0, 3).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => void onPick(preset)}
            className="rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-[12px] transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
