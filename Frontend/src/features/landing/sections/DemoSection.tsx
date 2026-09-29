import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { CONTAINER, fadeUp } from "../shared";

/* ==========================================================================
 * 60-second demo
 * ========================================================================== */

export function DemoSection() {
  const steps = [
    "Open the simulated triage view",
    "Fire a preset outage — a realistic log lands in the chat",
    "Watch the memory rail fill and confidence climb",
  ];

  return (
    <section className="border-b border-border/70 py-16 sm:py-20">
      <div className={CONTAINER}>
        <motion.div
          {...fadeUp}
          className="grid gap-8 rounded-2xl border border-border/70 bg-card/50 p-6 sm:p-8 lg:grid-cols-2 lg:items-center"
        >
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400/85">
              the demo
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              See it work in 60 seconds.
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              No setup, no waiting on a real outage. The console ships with realistic
              production failures you can fire on demand — useful for judges, reviewers, and
              your own team&apos;s first walkthrough.
            </p>
            <Link
              to="/console"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Run the demo now
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/50 px-4 py-3.5"
              >
                <span className="mt-px font-mono text-[11px] text-emerald-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[13.5px] leading-relaxed text-foreground/85">{step}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}
