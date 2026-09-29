import { SEVERITY_STYLES, type Severity } from "@/domain/incident";
import { cn } from "@/lib/utils";

/** Semantic severity chip — colors are defined once in `SEVERITY_STYLES`. */
export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const meta = SEVERITY_STYLES[severity];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.06em]",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
