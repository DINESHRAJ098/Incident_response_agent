import { motion } from "framer-motion";
import { Brain, Gauge, Terminal } from "lucide-react";
import { CONTAINER, fadeUp } from "../shared";

/* ==========================================================================
 * How it works
 * ========================================================================== */

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: Terminal,
      title: "Capture the signal",
      body: "Paste the stack trace, the alert payload, or the half-finished observation from the war room. The agent reduces it to a failure signature it can look up.",
    },
    {
      n: "02",
      icon: Brain,
      title: "Recall the precedent",
      body: "Every closed incident becomes durable memory — service, error code, root cause, runbook, time to resolve. The closest matches return ranked by similarity.",
    },
    {
      n: "03",
      icon: Gauge,
      title: "Resolve with evidence",
      body: "The answer names the incident it came from, quotes the runbook step that worked, and shows confidence with and without memory — so you can judge it in seconds.",
    },
  ];

  return (
    <section id="how" className="scroll-mt-20 border-b border-border/70 py-16 sm:py-20">
      <div className={CONTAINER}>
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400/85">
            how it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From raw signal to runbook in one turn.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            The agent does not improvise from nothing. It looks up what your team already
            fixed, says so plainly, and shows you how much that experience is contributing.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.n}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: index * 0.08 }}
                className="rounded-xl border border-border/70 bg-card/50 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-emerald-400">{step.n}</span>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
