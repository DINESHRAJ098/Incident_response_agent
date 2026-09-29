import { motion } from "framer-motion";
import { Brain, Gauge, Radio, ScrollText, Server, Zap } from "lucide-react";
import { CONTAINER, fadeUp } from "../shared";

/* ==========================================================================
 * Features
 * ========================================================================== */

export function Features() {
  const features = [
    {
      icon: Brain,
      title: "Persistent memory",
      body: "Closed incidents become the agent's long-term memory: failure signatures, root causes, and the exact runbook steps that ended each outage.",
    },
    {
      icon: ScrollText,
      title: "Precedent-linked answers",
      body: "Every recommendation cites the incident it drew from, with a similarity score you can sanity-check at a glance.",
    },
    {
      icon: Gauge,
      title: "Auditable confidence",
      body: "Each response shows confidence with and without memory, so the value of experience is a number rather than a claim.",
    },
    {
      icon: Zap,
      title: "Runbooks, not advice",
      body: "Recalled runbooks arrive as ordered steps — the sequence that worked last time — ready to paste into the incident channel.",
    },
    {
      icon: Radio,
      title: "Memory explorer",
      body: "Search the full archive by service, severity, error code, or free text, then open the complete postmortem behind any match.",
    },
    {
      icon: Server,
      title: "Zero-setup console",
      body: "No agents to install, no pipeline to wire. Paste the failing signal into the live console and get a grounded answer in one turn.",
    },
  ];

  return (
    <section id="features" className="scroll-mt-20 border-b border-border/70 py-16 sm:py-20">
      <div className={CONTAINER}>
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400/85">
            capabilities
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the people holding the pager.
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (index % 3) * 0.07 }}
                className="group rounded-xl border border-border/70 bg-card/40 p-5 transition-colors hover:border-border"
              >
                <span className="flex size-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                  <Icon className="size-4 text-emerald-400" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
