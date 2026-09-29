import { motion } from "framer-motion";
import { ArrowRight, Brain, Radio } from "lucide-react";
import { Link } from "react-router";
import { BrandMark } from "@/components/BrandMark";
import { CONTAINER } from "../shared";

/* ==========================================================================
 * Hero
 * ========================================================================== */

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/70">
      {/* engineering grid + signal glow */}
      <div className="bg-console-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />

      <div className={`${CONTAINER} relative pb-16 pt-16 sm:pt-24`}>
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-300"
          >
            <Radio className="size-3" />
            incident response · persistent memory
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06 }}
            className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Outages repeat.
            <br />
            <span className="text-muted-foreground">Your response time shouldn&apos;t.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14 }}
            className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base"
          >
            Incident AI is an incident response agent with persistent memory. Paste the
            signal — stack trace, alert payload, wall of log lines — and it recalls the past
            incidents, root causes, and runbooks that actually resolved it, then hands your
            on-call engineer a grounded recommendation with the confidence to back it up.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/console"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open the live console
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              See how recall works
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mx-auto mt-14 max-w-4xl"
        >
          <ProductPreview />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * ProductPreview — a static composition of the actual workspace: transcript,
 * recalled memories, and the confidence delta. Built from markup (not a
 * screenshot) so it stays crisp and on-theme at every size.
 */
function ProductPreview() {
  const previewMemories = [
    {
      id: "INC-389",
      match: 94,
      title: "API gateway returning 504s on a slow upstream",
      service: "api-gateway",
      minutes: 51,
    },
    {
      id: "INC-402",
      match: 71,
      title: "Database connection pool exhaustion during flash sale",
      service: "payments-api",
      minutes: 38,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/60 backdrop-blur">
      {/* window bar */}
      <div className="flex items-center gap-2.5 border-b border-border/70 bg-sidebar/60 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2 rounded-full bg-zinc-600" />
          <span className="size-2 rounded-full bg-zinc-600" />
          <span className="size-2 rounded-full bg-zinc-600" />
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          incident-ai · live session
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          memory: active
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_250px]">
        {/* transcript */}
        <div className="space-y-4 border-border/70 p-4 sm:p-5 lg:border-r">
          <div className="flex gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-[11px] font-medium text-muted-foreground">
              You
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-[12.5px] font-medium">
                On-call engineer <span className="ml-1 font-mono text-[10.5px] text-muted-foreground">09:12</span>
              </p>
              <pre className="overflow-x-auto whitespace-pre rounded-lg border border-border/80 bg-black/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground/75">
{`09:12:44Z ERROR api-gateway upstream timed out (110:Connection timed out)
09:12:44Z WARN  POST /v1/checkout 504 up_response_time=10.002s
09:12:45Z WARN  504 rate=41.2% window=60s upstream=payments-api p99=8740ms`}
              </pre>
            </div>
          </div>

          <div className="flex gap-3">
            <BrandMark size={28} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[12.5px] font-medium">
                Incident AI{" "}
                <span className="ml-1 rounded border border-border bg-muted/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                  agent
                </span>
              </p>
              <p className="text-[13px] leading-relaxed text-foreground/85">
                The gateway is timing out because <strong className="font-semibold">payments-api</strong>{" "}
                is stalling on an exhausted database pool — the same failure class as{" "}
                <span className="font-mono text-emerald-300">INC-389</span>. Enable the circuit
                breaker first to stop queueing onto a dead upstream, then drain the pool.
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {previewMemories.map((memory) => (
                  <span
                    key={memory.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200"
                  >
                    <span className="font-mono">{memory.id}</span>
                    <span className="text-emerald-400">{memory.match}%</span>
                  </span>
                ))}
              </div>

              <div className="mt-3.5 space-y-2 rounded-lg border border-border/70 bg-card/70 p-3">
                <PreviewBar label="with memory" value={91} tone="signal" delay={0.5} />
                <PreviewBar label="without memory" value={54} tone="muted" delay={0.7} />
              </div>
            </div>
          </div>
        </div>

        {/* memory rail */}
        <div className="border-t border-border/70 bg-sidebar/40 p-4 lg:border-t-0">
          <div className="flex items-center gap-2">
            <Brain className="size-3.5 text-emerald-400" />
            <span className="text-[12.5px] font-semibold tracking-tight">Memory context</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">2</span>
          </div>

          <div className="mt-3 space-y-2.5">
            {previewMemories.map((memory, index) => (
              <div
                key={memory.id}
                className="rounded-lg border border-border/70 bg-card/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {memory.id}
                  </span>
                  <span className="font-mono text-[10.5px] text-emerald-400">
                    {memory.match}%
                  </span>
                </div>
                <p className="mt-1 text-[12px] font-medium leading-snug">{memory.title}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {memory.service} · resolved in {memory.minutes} min
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-emerald-500/80"
                    initial={{ width: 0 }}
                    animate={{ width: `${memory.match}%` }}
                    transition={{ duration: 0.8, delay: 0.6 + index * 0.15 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* fake composer */}
      <div className="flex items-center gap-3 border-t border-border/70 bg-background/60 px-4 py-3">
        <span className="flex-1 truncate font-mono text-[12px] text-muted-foreground">
          Paste an error log, stack trace, or describe the outage…
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground">
          Send
          <ArrowRight className="size-3" />
        </span>
      </div>
    </div>
  );
}

function PreviewBar({
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
    <div className="grid grid-cols-[96px_1fr_32px] items-center gap-2">
      <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={
            tone === "signal"
              ? "h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
              : "h-full rounded-full bg-zinc-500/70"
          }
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, delay }}
        />
      </div>
      <span
        className={
          tone === "signal"
            ? "text-right font-mono text-[10px] text-emerald-300"
            : "text-right font-mono text-[10px] text-muted-foreground"
        }
      >
        {value}%
      </span>
    </div>
  );
}
