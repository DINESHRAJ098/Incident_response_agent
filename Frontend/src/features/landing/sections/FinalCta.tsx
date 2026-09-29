import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { CONTAINER, fadeUp } from "../shared";

/* ==========================================================================
 * Final CTA + footer
 * ========================================================================== */

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-b border-border/70 py-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className={`${CONTAINER} relative text-center`}>
        <motion.div {...fadeUp}>
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Your team has already solved this outage.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Incident AI remembers every root cause and every runbook that worked — and puts
            them in front of whoever is on call when it happens again.
          </p>
          <Link
            to="/console"
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open the live console
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
