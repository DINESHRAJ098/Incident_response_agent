import { AnimatePresence, motion } from "framer-motion";
import { Brain, MessageSquare, Zap } from "lucide-react";
import { Link } from "react-router";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { ChatView } from "@/features/console/chat/ChatView";
import { MemoryExplorerView } from "@/features/console/memory/MemoryExplorerView";
import { TriageView } from "@/features/console/triage/TriageView";
import { useConsole } from "@/features/console/ConsoleProvider";
import { cn } from "@/lib/utils";

const NAV = [
  {
    id: "chat",
    label: "Live chat",
    hint: "Incident workspace",
    icon: MessageSquare,
  },
  {
    id: "memory",
    label: "Incident memory",
    hint: "History & runbooks",
    icon: Brain,
  },
  {
    id: "triage",
    label: "Simulated triage",
    hint: "One-click demo",
    icon: Zap,
  },
] as const;

/**
 * ConsoleShell — persistent chrome around the three views: a sidebar on
 * wide screens, a compact top bar with pill navigation on mobile, and
 * animated view switching.
 */
export function ConsoleShell() {
  const { view, setView } = useConsole();

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* ------------------------------------------------- sidebar (lg+) */}
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-border/70 bg-sidebar lg:flex">
        <Link
          to="/"
          className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border/70 px-4 transition-opacity hover:opacity-80"
        >
          <BrandMark size={26} />
          <BrandWordmark />
          <span className="ml-auto rounded border border-border px-1.5 py-px font-mono text-[9.5px] text-muted-foreground">
            v1
          </span>
        </Link>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-emerald-400" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{item.label}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">
                    {item.hint}
                  </span>
                </span>
                {active && <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border/70 p-3">
          <p className="truncate font-mono text-[10.5px] text-muted-foreground">
            incident-ai · live agent session
          </p>
        </div>
      </aside>

      {/* ------------------------------------------------ main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 px-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <BrandMark size={24} />
            <BrandWordmark />
          </Link>
        </header>

        {/* mobile nav pills */}
        <nav className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border/70 px-3 py-2 lg:hidden">
          {NAV.map((item) => {
            const active = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-3.5", active && "text-emerald-400")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <main className="min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="h-full"
            >
              {view === "chat" ? (
                <ChatView />
              ) : view === "memory" ? (
                <MemoryExplorerView />
              ) : (
                <TriageView />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
