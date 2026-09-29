import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import type { FeedbackScope } from "@/services/agent";
import type { ChatMessage } from "@/domain/incident";
import { cn } from "@/lib/utils";

/**
 * ChatMessageItem — one row in the live transcript.
 *
 * User rows render raw pasted text (logs in monospace). Agent rows render
 * markdown, reveal progressively when they are the newest response, and end
 * with the evidence footer: confidence bars + the incidents recalled.
 */
export function ChatMessageItem({
  message,
  isLatestAgent,
  onFeedback,
}: {
  message: ChatMessage;
  /** True when this is the newest agent reply (drives the reveal animation). */
  isLatestAgent: boolean;
  /** Rate this response — persisted to the agent's feedback endpoint. */
  onFeedback: (helpful: boolean, scope: FeedbackScope) => Promise<boolean>;
}) {
  const [rating, setRating] = useState<FeedbackScope | null>(null);
  const [ratingFailed, setRatingFailed] = useState(false);

  const time = useMemo(
    () =>
      new Date(message.at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [message.at],
  );

  if (message.role === "user") {
    const multiline = message.text.includes("\n");
    return (
      <div className="flex gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-[11px] font-medium text-muted-foreground">
          You
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[12.5px] font-medium">On-call engineer</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">{time}</span>
          </div>
          <div
            className={cn(
              "whitespace-pre-wrap break-words rounded-lg border border-border/80 bg-card/70 px-3.5 py-3",
              multiline
                ? "overflow-x-auto font-mono text-[12px] leading-relaxed text-foreground/85"
                : "text-sm leading-relaxed",
            )}
          >
            {message.text}
          </div>
        </div>
      </div>
    );
  }

  const answer = message.answer;
  const memories = answer?.memories ?? [];

  const rate = async (helpful: boolean, scope: FeedbackScope) => {
    if (rating !== null || message.feedback !== undefined) return;
    setRating(scope);
    setRatingFailed(false);
    const stored = await onFeedback(helpful, scope);
    if (stored) return;
    // Not stored — release the buttons so the verdict can be sent again.
    setRating(null);
    setRatingFailed(true);
  };

  return (
    <div className="flex gap-3">
      <BrandMark size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-medium">Incident AI</span>
          <span className="rounded border border-border bg-muted/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
            agent
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground">{time}</span>
        </div>

        <div className="text-sm leading-relaxed text-foreground/90">
          {isLatestAgent && message.animate ? (
            <Typewriter text={message.text} />
          ) : (
            <Markdown text={message.text} />
          )}
        </div>

        {answer && (
          <div className="mt-4 space-y-3 rounded-lg border border-border/70 bg-card/50 p-3.5">
            <FeedbackToggle
              rated={message.feedback}
              pending={rating !== null}
              onRate={rate}
            />

            {ratingFailed && (
              <p className="text-[11px] text-amber-300/90">
                That verdict didn&apos;t reach the agent service — press a button to try
                again.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="font-mono text-[10.5px] text-muted-foreground">
                {memories.length > 0
                  ? `memory: ${memories.length} ${memories.length === 1 ? "record" : "records"} referenced`
                  : "memory: no match"}
              </span>

              {message.feedback !== undefined && (
                <span className="text-[11px] text-muted-foreground">
                  {message.feedback
                    ? "· saved as a good example — ranked up for future recall"
                    : "· saved as a counter-example — avoided next time"}
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(message.text);
                  toast.success("Reply copied");
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Copy className="size-3" />
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
 * Feedback controls
 *
 * "Rate the answer" writes to the agent's feedback endpoint, which stores the
 * verdict as memory: a helpful answer becomes a good example ranked up for
 * future recall, an unhelpful one becomes a counter-example. The verdict is
 * per response, so once it lands the pair locks to the chosen state.
 * ========================================================================== */

const FEEDBACK_BASE =
  "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-default";

function FeedbackToggle({
  rated,
  pending,
  onRate,
}: {
  rated: boolean | undefined;
  pending: boolean;
  onRate: (helpful: boolean, scope: FeedbackScope) => void;
}) {
  if (rated !== undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium",
          rated
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/40 bg-amber-500/10 text-amber-300",
        )}
      >
        {rated ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />}
        {rated ? "Helpful" : "Not helpful"}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2.5">
      <span className="text-[12px] text-muted-foreground">Was this useful?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => onRate(true, "top")}
        aria-label="Mark response as helpful"
        className={cn(
          FEEDBACK_BASE,
          "border-border text-muted-foreground hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-emerald-300",
        )}
      >
        <ThumbsUp className="size-4" />
        Helpful
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => onRate(false, "top")}
        aria-label="Mark response as not helpful"
        className={cn(
          FEEDBACK_BASE,
          "border-border text-muted-foreground hover:border-amber-400/60 hover:bg-amber-500/15 hover:text-amber-300",
        )}
      >
        <ThumbsDown className="size-4" />
        Not helpful
      </button>
    </span>
  );
}

/* ==========================================================================
 * Minimal markdown renderer
 *
 * Agent replies are markdown from the backend. This covers what the agent
 * actually emits — fenced code blocks, headings, bullets, numbered steps,
 * paragraphs, **bold** and `inline code` — without pulling in a parser lib.
 * ========================================================================== */

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={index}
          className="rounded border border-border bg-muted/70 px-1 py-px font-mono text-[12px] text-foreground/90"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border/80 bg-black/40 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-foreground/80">
      <code>{code}</code>
    </pre>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const segments = text.split(/```/);

  segments.forEach((segment, index) => {
    if (index % 2 === 1) {
      // Odd segments are fenced code (first line may be a language tag).
      const body = segment.replace(/^[^\n]*\n/, "");
      blocks.push(<CodeBlock key={`code-${index}`} code={body.replace(/\n+$/, "")} />);
      return;
    }
    if (!segment.trim()) return;

    const lines = segment.split("\n");
    let paragraph: string[] = [];
    let ordered: string[] = [];
    let bullet: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push(
          <p key={`p-${blocks.length}`} className="my-2 first:mt-0 last:mb-0">
            {renderInline(paragraph.join(" "))}
          </p>,
        );
        paragraph = [];
      }
    };
    const flushOrdered = () => {
      if (ordered.length) {
        blocks.push(
          <ol key={`ol-${blocks.length}`} className="my-2 space-y-1.5 pl-1">
            {ordered.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2.5">
                <span className="mt-px font-mono text-[11px] text-emerald-400/90">
                  {itemIndex + 1}.
                </span>
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ol>,
        );
        ordered = [];
      }
    };
    const flushBullet = () => {
      if (bullet.length) {
        blocks.push(
          <ul key={`ul-${blocks.length}`} className="my-2 space-y-1.5">
            {bullet.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2.5">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-emerald-400/80" />
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ul>,
        );
        bullet = [];
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        flushOrdered();
        flushBullet();
        flushParagraph();
        continue;
      }

      const orderedMatch = line.match(/^\d+[.)]\s+(.*)$/);
      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      const headingMatch = line.match(/^#{1,4}\s+(.*)$/);

      if (orderedMatch) {
        flushParagraph();
        flushBullet();
        ordered.push(orderedMatch[1]);
      } else if (bulletMatch) {
        flushParagraph();
        flushOrdered();
        bullet.push(bulletMatch[1]);
      } else if (headingMatch) {
        flushParagraph();
        flushOrdered();
        flushBullet();
        blocks.push(
          <h4
            key={`h-${blocks.length}`}
            className="mt-4 mb-1 text-[13px] font-semibold tracking-tight text-foreground first:mt-0"
          >
            {renderInline(headingMatch[1])}
          </h4>,
        );
      } else {
        flushOrdered();
        flushBullet();
        paragraph.push(line.trim());
      }
    }
    flushOrdered();
    flushBullet();
    flushParagraph();
  });

  return <>{blocks}</>;
}

/**
 * Typewriter — reveals the newest agent reply over ~1 second so a response
 * feels generated rather than stamped in. Respects reduced-motion settings
 * and snaps to the full text once complete.
 */
function Typewriter({ text }: { text: string }) {
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [shown, setShown] = useState(reducedMotion ? text.length : 0);

  const step = useMemo(() => Math.max(4, Math.ceil(text.length / 90)), [text.length]);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => {
      setShown((previous) => {
        if (previous >= text.length) {
          window.clearInterval(interval);
          return previous;
        }
        return previous + step;
      });
    }, 12);
    return () => window.clearInterval(interval);
  }, [text, step, reducedMotion]);

  if (shown >= text.length) return <Markdown text={text} />;

  return (
    <span>
      <Markdown text={text.slice(0, shown)} />
      <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-emerald-400/80" />
    </span>
  );
}
