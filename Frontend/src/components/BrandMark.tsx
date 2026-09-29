import { cn } from "@/lib/utils";

/**
 * BrandMark — the Incident AI identity: a dark tile with an ECG-style pulse
 * line (the "incident" signal) that doubles as an abstract "A".
 *
 * Used in the landing navbar, the console sidebar, and as the agent avatar
 * in chat so the same mark ties the whole product together.
 */
export function BrandMark({
  size = 28,
  className,
}: {
  /** Rendered pixel size of the square tile. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.55rem] border border-white/10 bg-[#0a0b0f]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        width={size * 0.72}
        height={size * 0.72}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4.5 17h4.4l2.6-7 4.2 12.8L18.4 17h9.1"
          stroke="#34d399"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Wordmark next to the mark: "Incident" in medium weight, "AI" in muted. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[15px] font-semibold tracking-tight", className)}>
      Incident<span className="text-muted-foreground"> AI</span>
    </span>
  );
}
