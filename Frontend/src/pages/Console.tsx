import { ConsoleProvider } from "@/features/console/ConsoleProvider";
import { ConsoleShell } from "@/features/console/ConsoleShell";

/**
 * Console — the product surface for Incident AI. No sign-in is required so a
 * demo can start instantly; the provider owns backend connection, chat turns,
 * and incident memory, while the shell owns navigation between the three
 * views (live chat, incident memory, simulated triage).
 */
export default function Console() {
  return (
    <ConsoleProvider>
      <ConsoleShell />
    </ConsoleProvider>
  );
}
