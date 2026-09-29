/**
 * SAMPLE INCIDENT ARCHIVE — reference data.
 *
 * Nine closed incidents across eight services, each with root cause, runbook
 * and time-to-resolve. The live console reads the real archive from the
 * backend (`GET /api/incidents`); this file is used as an offline fallback
 * for enrichment (see `normalizeSimilarIncident`) and documents the record
 * shape the backend documents are parsed into.
 */

import type { IncidentRecord } from "@/domain/incident";

export const SAMPLE_INCIDENTS: IncidentRecord[] = [
  {
    id: "INC-402",
    title: "Database connection pool exhaustion during flash sale",
    service: "payments-api",
    severity: "critical",
    errorCode: "PG-53300",
    rootCause:
      "The pgbouncer pool was sized for baseline traffic (max_client_conn=200). A flash sale drove 6× normal checkout volume, and a missing retry jitter made every client retry at the same moment, saturating all connections in under 40 seconds.",
    resolution:
      "Raised pool limits, added exponential backoff with jitter to checkout retries, and scheduled an autoscaled pgbouncer deployment.",
    runbook: "RB-014",
    runbookTitle: "Drain and scale the database pool safely",
    runbookSteps: [
      "Confirm saturation: `select count(*) from pg_stat_activity;` against `max_connections`.",
      "Stop retry storms by enabling jittered backoff on the failing client (config flag `DB_RETRY_JITTER=on`).",
      "Raise `max_client_conn` on pgbouncer in 25% increments, watching `p99` and replication lag between steps.",
      "Drain the oldest connections first with `RECONNECT` on the affected database entry.",
      "File a follow-up to right-size the pool from observed peak, not baseline.",
    ],
    resolutionMinutes: 38,
    occurredAt: "2026-07-18",
    keywords: [
      "postgres",
      "connection",
      "pool",
      "too many clients",
      "53300",
      "pgbouncer",
      "exhausted",
      "max_connections",
      "checkout",
    ],
    nextEvidence:
      "`select count(*) from pg_stat_activity;` plus the connection-count graph for the last hour.",
  },
  {
    id: "INC-415",
    title: "Redis cache memory leak after session-store deployment",
    service: "cache",
    severity: "high",
    errorCode: "REDIS-OOM",
    rootCause:
      "Release 2.31.0 wrote session keys without a TTL and used an incrementing key prefix per request, so `used_memory` grew unbounded until Redis refused writes with OOM. Evictions could not keep up because the working set exceeded `maxmemory`.",
    resolution:
      "Rolled back to 2.31.0-1 (which restores TTLs), cleared the leaked key namespace, and capped memory with `maxmemory` + `allkeys-lru`.",
    runbook: "RB-021",
    runbookTitle: "Recover a saturated Redis instance",
    runbookSteps: [
      "Verify saturation: `INFO MEMORY` — compare `used_memory` to `maxmemory` and check `evicted_keys` slope.",
      "Check for TTL regressions: `SCAN` a sample of live keys with `TTL`; keys returning -1 are the leak signature.",
      "Roll back the most recent deploy of the session store before touching data.",
      "Apply `maxmemory-policy allkeys-lru` if it was unset, then let evictions recover headroom.",
      "Delete only the leaked namespace (`UNLINK`, never `DEL` on a large keyspace) once traffic is stable.",
    ],
    resolutionMinutes: 24,
    occurredAt: "2026-08-30",
    keywords: [
      "redis",
      "oom",
      "maxmemory",
      "memory",
      "leak",
      "cache",
      "eviction",
      "ttl",
      "session",
      "used_memory",
    ],
    nextEvidence:
      "`INFO MEMORY` and a `TTL` sample of live session keys from the last ten minutes.",
  },
  {
    id: "INC-389",
    title: "API gateway returning 504s on a slow upstream",
    service: "api-gateway",
    severity: "critical",
    errorCode: "HTTP-504",
    rootCause:
      "The gateway's 10-second upstream timeout fired while `payments-api` was stalling on an exhausted database pool (see INC-402). No circuit breaker was configured, so the gateway kept queueing requests and the 504 rate climbed to 41% within two minutes.",
    resolution:
      "Raised the upstream timeout, enabled the circuit breaker with a 5% error-rate trip, and added a p99-latency alert on upstreams.",
    runbook: "RB-007",
    runbookTitle: "Stabilize gateway timeouts",
    runbookSteps: [
      "Identify the slow upstream: compare per-route `upstream_response_time` against the 1-hour baseline.",
      "Check whether the upstream is blocked on its own dependency (DB pool, cache, downstream API).",
      "Enable the circuit breaker (`upstream.circuit_breaker=on`) to stop queueing onto a failing upstream.",
      "Return fast where you can: serve stale or degrade the route instead of holding requests open.",
      "Once the upstream recovers, restore normal timeouts and confirm the 504 rate returns to < 0.1%.",
    ],
    resolutionMinutes: 51,
    occurredAt: "2026-06-24",
    keywords: [
      "504",
      "gateway",
      "timeout",
      "upstream",
      "nginx",
      "timed out",
      "circuit",
      "breaker",
      "latency",
      "edge",
    ],
    nextEvidence:
      "Per-route `upstream_response_time` p99 and the error rate of the upstream service itself.",
  },
  {
    id: "INC-431",
    title: "Pod CrashLoopBackOff after a config change",
    service: "checkout-web",
    severity: "high",
    errorCode: "CFG-YAML-001",
    rootCause:
      "A ConfigMap edit introduced an unquoted string containing `:` on line 3, so the application failed YAML parsing on boot and exited with status 1. The liveness probe kept restarting the container, producing CrashLoopBackOff within four minutes.",
    resolution:
      "Reverted the ConfigMap to the last known-good revision and added schema validation of application config to CI so malformed values cannot ship.",
    runbook: "RB-033",
    runbookTitle: "Recover a crash-looping workload",
    runbookSteps: [
      "`kubectl describe pod <pod>` — read the last exit code and the events section first.",
      "`kubectl logs <pod> --previous` to capture the crash output before the container restarts.",
      "Diff the last change to ConfigMaps, Secrets, and manifests within the failure window.",
      "Roll back the offending change (`kubectl rollout undo deployment/<name>`) rather than editing live.",
      "Block the regression: require config schema validation in CI before re-enabling deploys.",
    ],
    resolutionMinutes: 17,
    occurredAt: "2026-09-14",
    keywords: [
      "kubernetes",
      "k8s",
      "pod",
      "crashloopbackoff",
      "crashloop",
      "config",
      "configmap",
      "yaml",
      "liveness",
      "exit status",
    ],
    nextEvidence:
      "`kubectl logs <pod> --previous` and the ConfigMap diff from the last deploy window.",
  },
  {
    id: "INC-376",
    title: "Consumer lag spike after a partition rebalance",
    service: "data-pipeline",
    severity: "medium",
    errorCode: "KFK-LAG",
    rootCause:
      "A single invoice-sync consumer exceeded `max.poll.interval.ms` while processing a large batch, triggering repeated group rebalances. Each rebalance revoked partitions mid-processing, so lag compounded to 2.8M records and downstream writes paused.",
    resolution:
      "Reduced `max.poll.records`, scaled consumers to three per group, and pinned a static membership so restarts no longer triggered rebalances.",
    runbook: "RB-018",
    runbookTitle: "Drain Kafka consumer lag",
    runbookSteps: [
      "Identify the hot group: `kafka-consumer-groups --describe --group <g>` and sort by lag.",
      "Look for rebalance loops in consumer logs — `Preparing to rebalance` more than once per minute is the signature.",
      "Lower `max.poll.records` so each poll stays well inside `max.poll.interval.ms`.",
      "Scale consumers to match partition count; never more consumers than partitions.",
      "Enable static group membership (`group.instance.id`) so pod restarts do not revoke partitions.",
    ],
    resolutionMinutes: 64,
    occurredAt: "2026-06-10",
    keywords: [
      "kafka",
      "consumer",
      "lag",
      "rebalance",
      "partition",
      "poll",
      "invoice-sync",
      "throughput",
      "backlog",
    ],
    nextEvidence:
      "`kafka-consumer-groups --describe` output for the lagging group plus consumer rebalance logs.",
  },
  {
    id: "INC-408",
    title: "TLS certificate expiry on a newly added domain",
    service: "edge-proxy",
    severity: "critical",
    errorCode: "TLS-EXP",
    rootCause:
      "A new hostname was added to the ingress without the cert-manager annotation, so auto-renewal never ran. The certificate expired at 00:00 UTC and every request to the domain failed certificate validation.",
    resolution:
      "Issued and reloaded a fresh certificate manually, added the annotation to the ingress template, and shipped an expiry alert at 14 days.",
    runbook: "RB-002",
    runbookTitle: "Replace an expiring or expired certificate",
    runbookSteps: [
      "Confirm expiry: `openssl s_client -connect <host>:443 -servername <host>` and read `notAfter`.",
      "Check whether cert-manager sees the ingress — missing annotations mean renewal was never scheduled.",
      "Issue a replacement certificate and reload the edge proxy without dropping active connections.",
      "Add the renewal annotation and a 14-day expiry alert so this cannot recur silently.",
    ],
    resolutionMinutes: 12,
    occurredAt: "2026-05-29",
    keywords: [
      "tls",
      "certificate",
      "cert",
      "expiry",
      "expired",
      "ssl",
      "ingress",
      "edge",
      "443",
    ],
    nextEvidence:
      "`openssl s_client` output showing `notAfter`, and the cert-manager certificate status.",
  },
  {
    id: "INC-399",
    title: "JWT validation failures after key rotation",
    service: "auth-service",
    severity: "high",
    errorCode: "JWT-INVALID",
    rootCause:
      "The identity provider rotated signing keys, but the service cached the JWKS document indefinitely. Tokens signed by the new key were rejected as invalid for 22 minutes because the cache never invalidated on `kid` mismatch.",
    resolution:
      "Added kid-based cache busting on unknown key IDs, set a 10-minute JWKS TTL, and alerted on 401 spikes after rotation.",
    runbook: "RB-011",
    runbookTitle: "Recover from a JWKS rotation outage",
    runbookSteps: [
      "Confirm the failure mode: 401s starting exactly at rotation time point at key mismatch, not auth logic.",
      "Fetch the live JWKS (`/.well-known/jwks.json`) and compare key `kid`s to the rejected token header.",
      "Force a JWKS refresh or restart the auth service to drop the stale cache.",
      "Ship the kid-based invalidation fix and a TTL so rotation never blocks again.",
    ],
    resolutionMinutes: 29,
    occurredAt: "2026-07-02",
    keywords: [
      "jwt",
      "jwks",
      "auth",
      "401",
      "token",
      "rotation",
      "invalid",
      "signature",
      "key",
    ],
    nextEvidence:
      "The rejected token header (`kid`) compared against the current JWKS document.",
  },
  {
    id: "INC-420",
    title: "Search indexer throttled at CPU limit during backfill",
    service: "search-indexer",
    severity: "medium",
    errorCode: "CPU-THROTTLE",
    rootCause:
      "A backfill job submitted unbounded batches (50k documents each) into a deployment with a 500m CPU limit. The indexer throttled constantly, ingest throughput collapsed 80%, and index freshness lagged by six hours.",
    resolution:
      "Capped batch size at 5k, added a HorizontalPodAutoscaler on CPU, and moved backfills to a dedicated low-priority queue.",
    runbook: "RB-026",
    runbookTitle: "Recover throttled ingestion",
    runbookSteps: [
      "`kubectl top pods` and check `container_cpu_c throttled_seconds_total` — sustained throttling confirms the limit.",
      "Reduce batch size before adding capacity; large batches are the usual amplifier.",
      "Scale horizontally with HPA rather than raising limits on a single pod.",
      "Route bulk backfills to a separate queue so live indexing keeps priority.",
    ],
    resolutionMinutes: 44,
    occurredAt: "2026-08-11",
    keywords: [
      "cpu",
      "throttle",
      "indexer",
      "backfill",
      "batch",
      "ingest",
      "search",
      "limit",
      "throughput",
    ],
    nextEvidence:
      "`container_cpu_throttled_seconds_total` and the batch-size config for the backfill job.",
  },
  {
    id: "INC-384",
    title: "Replica lag after WAL volume filled",
    service: "data-platform",
    severity: "medium",
    errorCode: "PG-LAG",
    rootCause:
      "The WAL volume reached 95% utilization during a bulk export; PostgreSQL paused WAL archiving, replicas stopped applying segments, and replication lag grew to 42 minutes before read traffic hit stale data.",
    resolution:
      "Expanded the WAL volume, restored archiving, and added an 80% disk watermark alert with automated volume growth.",
    runbook: "RB-009",
    runbookTitle: "Clear replication lag on Postgres replicas",
    runbookSteps: [
      "Check `pg_stat_replication` — `replay_lag` growing while writes succeed means apply is stalled, not overloaded.",
      "Inspect WAL disk headroom; a full volume pauses archiving and stalls every replica.",
      "Free space or expand the volume, then confirm archiving resumes (`pg_stat_wal`).",
      "Wait for `replay_lag` to drain before routing reads back to the replica.",
      "Set a watermark alert at 80% so the volume never reaches the stall point again.",
    ],
    resolutionMinutes: 33,
    occurredAt: "2026-06-05",
    keywords: [
      "replica",
      "lag",
      "replication",
      "wal",
      "postgres",
      "stale",
      "archive",
      "disk",
      "volume",
    ],
    nextEvidence:
      "`pg_stat_replication` output and free-space percentage on the WAL volume.",
  },
];

/** Lookup by incident id, e.g. `INCIDENT_BY_ID.get("INC-402")`. */
export const INCIDENT_BY_ID = new Map(
  SAMPLE_INCIDENTS.map((incident) => [incident.id, incident]),
);
