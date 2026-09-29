import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * ConfidenceMeter — the visual proof that memory improves the agent.
 *
 * Two stacked bars: the answer's confidence *with* recalled incidents (emerald)
 * against what it would be *without* them (grey), plus a delta chip. Rendered
 * under every agent response and summarized in the memory panel.
 */
export function ConfidenceMeter({
  confidence,
  baseConfidence,
  className,
}: {
  /** 0..1, with memory applied. */
  confidence: number;
  /** 0..1, the same answer without precedent. */
  baseConfidence: number;
  className?: string;
}) {
  const pct = Math.round(confidence * 100);
  const basePct = Math.round(baseConfidence * 100);
  const delta = Math.max(0, pct - basePct);

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-foreground">Confidence</span>
        {delta > 0 ? (
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
            +{delta} pts from memory
          </span>
        ) : (
          <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            no precedent used
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <BarRow label="with memory" value={pct} tone="signal" delay={0.05} />
        <BarRow label="without memory" value={basePct} tone="muted" delay={0.15} />
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  tone,
  delay,
}: {
  label: string;
  value: number;
  tone: "signal" | "muted";
  delay: number;
}) {
  return (
    <div className="grid grid-cols-[92px_1fr_34px] items-center gap-2">
      <span className="truncate font-mono text-[10.5px] text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn(
            "h-full rounded-full",
            tone === "signal"
              ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
              : "bg-zinc-500/70",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span
        className={cn(
          "text-right font-mono text-[10.5px]",
          tone === "signal" ? "text-emerald-300" : "text-muted-foreground",
        )}
      >
        {value}%
      </span>
    </div>
  );
}
