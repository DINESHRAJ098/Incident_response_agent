import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Brain, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge } from "@/components/SeverityBadge";
import { useConsole } from "@/features/console/ConsoleProvider";
import type { IncidentRecord } from "@/domain/incident";
import { cn } from "@/lib/utils";

const ALL = "all";

/**
 * View B — Incident history & hindsight memory explorer.
 *
 * The archive the agent recalls from, made searchable: full-text query plus
 * service / severity / error-code filters, and a detail drawer holding the
 * root cause, resolution, and runbook steps recorded when the incident closed.
 * Data comes from `GET /api/incidents` when a backend is configured, otherwise
 * from the bundled sample archive.
 */
export function MemoryExplorerView() {
  const {
    incidents,
    incidentsStatus,
    incidentsError,
    reloadIncidents,
    selectedIncidentId,
    openIncident,
    closeIncident,
    askAboutIncident,
  } = useConsole();

  const [query, setQuery] = useState("");
  const [service, setService] = useState(ALL);
  const [severity, setSeverity] = useState(ALL);
  const [errorCode, setErrorCode] = useState(ALL);

  const services = useMemo(
    () => [...new Set(incidents.map((incident) => incident.service))].sort(),
    [incidents],
  );
  const errorCodes = useMemo(
    () => [...new Set(incidents.map((incident) => incident.errorCode))].sort(),
    [incidents],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (service !== ALL && incident.service !== service) return false;
      if (severity !== ALL && incident.severity !== severity) return false;
      if (errorCode !== ALL && incident.errorCode !== errorCode) return false;
      if (!needle) return true;
      return [incident.id, incident.title, incident.rootCause, incident.resolution, incident.service, incident.errorCode]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [incidents, query, service, severity, errorCode]);

  const hasActiveFilters =
    Boolean(query.trim()) || service !== ALL || severity !== ALL || errorCode !== ALL;

  const clearFilters = () => {
    setQuery("");
    setService(ALL);
    setSeverity(ALL);
    setErrorCode(ALL);
  };

  const selected = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* -------------------------------------------------------- header */}
      <header className="shrink-0 border-b border-border/70 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight">Incident memory</h1>
            <p className="text-[11.5px] text-muted-foreground">
              Every closed incident the agent can recall — root causes, runbooks, and time
              to resolve.
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {incidentsStatus === "ready"
                ? `${filtered.length}/${incidents.length} records`
                : `${incidents.length} records`}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void reloadIncidents()}
              disabled={incidentsStatus === "loading"}
            >
              {incidentsStatus === "loading" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* ------------------------------------------------------ filters */}
        <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, root cause, service…"
              className="h-9 pl-9 text-[13px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="h-9 w-[150px] text-[13px]">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All services</SelectItem>
                {services.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-9 w-[135px] text-[13px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={errorCode} onValueChange={setErrorCode}>
              <SelectTrigger className="h-9 w-[160px] text-[13px]">
                <SelectValue placeholder="Error code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All error codes</SelectItem>
                {errorCodes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {incidentsStatus === "loading" && incidents.length === 0 ? (
          <LoadingRow label="Loading incident memory…" />
        ) : incidentsStatus === "error" ? (
          <ErrorState
            message={incidentsError?.message ?? "Could not load incidents."}
            hint={incidentsError?.hint ?? ""}
            onRetry={() => void reloadIncidents()}
          />
        ) : filtered.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <Search className="size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No incidents match these filters</p>
            <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
              Try a broader search, or clear the filters to browse the full archive.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="px-4 py-5 sm:px-6">
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[230px]">Incident</TableHead>
                    <TableHead className="w-[130px]">Service</TableHead>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead className="w-[120px]">Error code</TableHead>
                    <TableHead>Root cause</TableHead>
                    <TableHead className="w-[90px] text-right">Resolved</TableHead>
                    <TableHead className="w-[105px] text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((incident, index) => (
                    <motion.tr
                      key={incident.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.24) }}
                      onClick={() => openIncident(incident.id)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {incident.id}
                          </span>
                          <span className="text-[13px] font-medium leading-snug">
                            {incident.title}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-foreground/80">
                        {incident.service}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={incident.severity} />
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {incident.errorCode}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <span className="line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                          {incident.rootCause}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12px]">
                        {incident.resolutionMinutes > 0
                          ? `${incident.resolutionMinutes} min`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12px] text-muted-foreground">
                        {incident.occurredAt}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="mt-3 font-mono text-[10.5px] text-muted-foreground">
              archive: incident memory · {incidents.length} records
            </p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- detail drawer */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) closeIncident();
        }}
      >
        <SheetContent
          side="right"
          className="w-[94vw] sm:max-w-[540px] gap-0 overflow-y-auto border-l p-0"
        >
          <SheetTitle className="sr-only">Incident detail</SheetTitle>
          {selected && (
            <IncidentDetail
              incident={selected}
              onClose={closeIncident}
              onRecall={() => {
                void askAboutIncident(selected);
                closeIncident();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ==========================================================================
 * Detail drawer contents
 * ========================================================================== */

function IncidentDetail({
  incident,
  onClose,
  onRecall,
}: {
  incident: IncidentRecord;
  onClose: () => void;
  onRecall: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="shrink-0 border-b border-border/70 px-5 py-4 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11.5px] text-muted-foreground">{incident.id}</span>
          <SeverityBadge severity={incident.severity} />
        </div>
        <h2 className="mt-1.5 text-base font-semibold tracking-tight">{incident.title}</h2>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {incident.service} · {incident.errorCode} · {incident.occurredAt}
        </p>
      </header>

      <div className="flex-1 space-y-5 px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Resolved in" value={incident.resolutionMinutes > 0 ? `${incident.resolutionMinutes} min` : "—"} />
          <Stat label="Runbook" value={incident.runbook || "—"} />
          <Stat label="Severity" value={incident.severity} />
        </div>

        <DetailSection label="Root cause" body={incident.rootCause} />
        <DetailSection label="Resolution" body={incident.resolution} />

        {incident.runbookSteps.length > 0 && (
          <div>
            <p className="mb-2 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
              Runbook — {incident.runbookTitle}
            </p>
            <ol className="space-y-2">
              {incident.runbookSteps.map((step, index) => (
                <li key={index} className="flex gap-2.5">
                  <span className="mt-px font-mono text-[11px] text-emerald-400/90">
                    {index + 1}.
                  </span>
                  <span className="text-[12.5px] leading-relaxed text-foreground/85">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {incident.nextEvidence && (
          <DetailSection label="Evidence that confirms it" body={incident.nextEvidence} />
        )}

        {/* Backend records are stored as one full-text document — show it raw. */}
        {incident.rawText && (
          <div>
            <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
              Full record
            </p>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-black/40 px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-foreground/80">
              {incident.rawText}
            </pre>
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 flex gap-2 border-t border-border/70 bg-background/95 px-5 py-3.5 backdrop-blur">
        <Button type="button" size="sm" className="gap-1.5" onClick={onRecall}>
          <Brain className="size-3.5" />
          Recall in chat
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-[12.5px]">{value}</p>
    </div>
  );
}

function DetailSection({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="text-[13px] leading-relaxed text-foreground/85">{body}</p>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3">
      <Loader2 className="size-5 animate-spin text-emerald-400" />
      <p className="font-mono text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorState({
  message,
  hint,
  onRetry,
}: {
  message: string;
  hint: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10">
        <AlertTriangle className="size-4 text-rose-400" />
      </span>
      <p className="mt-3 text-sm font-medium">{message}</p>
      <p className={cn("mt-1 max-w-md text-[12.5px] leading-relaxed text-muted-foreground")}>
        {hint}
      </p>
      <Button type="button" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}
