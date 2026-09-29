import { motion } from "framer-motion";
import { ArrowRight, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/SeverityBadge";
import { useConsole } from "@/features/console/ConsoleProvider";
import { MOCK_OUTAGES } from "@/data/mock-outages";

/**
 * View C — Simulated live incident triage (the judges' demo).
 *
 * Each card is a realistic production failure. Firing one pastes its log into
 * the live chat and runs an agent turn immediately, so the full loop — signal
 * in, memory recalled, confidence climb, runbook out — plays inside a minute.
 */
export function TriageView() {
  const { injectPreset, isSending } = useConsole();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border/70 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight">Simulated triage</h1>
            <p className="text-[11.5px] text-muted-foreground">
              One click drops a realistic production failure into the live chat and runs the
              agent against it.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 font-mono text-[10.5px] text-emerald-300">
            <Timer className="size-3" />
            full demo in 60 seconds
          </span>
        </div>

        {/* demo path — three steps a judge can follow without narration */}
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            "Fire a preset below",
            "Watch the memory rail fill",
            "Read the confidence climb",
          ].map((step, index) => (
            <li
              key={step}
              className="flex items-center gap-2 rounded-md border border-border/70 bg-card/50 px-3 py-2"
            >
              <span className="font-mono text-[10.5px] text-emerald-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[12px] text-foreground/80">{step}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MOCK_OUTAGES.map((preset, index) => (
              <motion.article
                key={preset.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col rounded-xl border border-border/80 bg-card/60 p-4 transition-colors hover:border-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <SeverityBadge severity={preset.severity} />
                  <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                    {preset.service} · {preset.errorCode}
                  </span>
                </div>

                <h2 className="mt-3 text-[14px] font-semibold tracking-tight">{preset.name}</h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {preset.summary}
                </p>

                {/* log preview */}
                <div className="relative mt-3 overflow-hidden rounded-md border border-border/70 bg-black/40">
                  <pre className="max-h-32 overflow-hidden whitespace-pre px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-foreground/60">
                    {preset.log.split("\n").slice(0, 6).join("\n")}
                  </pre>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent" />
                </div>

                <Button
                  type="button"
                  className="mt-4 w-full gap-1.5"
                  size="sm"
                  disabled={isSending}
                  onClick={() => void injectPreset(preset)}
                >
                  <Zap className="size-3.5" />
                  Load into live chat
                  <ArrowRight className="size-3.5" />
                </Button>
              </motion.article>
            ))}
          </div>

          <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
            presets paste a realistic log into View A — the agent recalls matching incidents
            and answers with the runbook that resolved them
          </p>
        </div>
      </div>
    </div>
  );
}
