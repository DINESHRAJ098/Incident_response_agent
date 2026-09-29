import { CONTAINER } from "../shared";

/* ==========================================================================
 * Stats strip
 * ========================================================================== */

export function StatsStrip() {
  const items = [
    { k: "index", v: "9 incidents with root cause + runbook" },
    { k: "presets", v: "5 outages ready to fire" },
    { k: "recall", v: "ranked precedent on every answer" },
    { k: "confidence", v: "with memory vs. without, side by side" },
  ];

  return (
    <section className="border-b border-border/70 bg-sidebar/40">
      <div className={`${CONTAINER} grid gap-x-8 gap-y-3 py-5 sm:grid-cols-2 lg:grid-cols-4`}>
        {items.map((item) => (
          <div key={item.k} className="flex items-baseline gap-3 truncate">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-400/80">
              {item.k}
            </span>
            <span className="truncate text-[12.5px] text-muted-foreground">{item.v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
