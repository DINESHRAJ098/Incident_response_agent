/**
 * SIMULATED OUTAGES — the one-click presets behind the "Simulated triage" view.
 *
 * Each log is written to hit at least one stored incident's recall keywords,
 * so the memory panel fills within seconds of firing a preset.
 */

import type { MockOutage } from "@/domain/incident";

export const MOCK_OUTAGES: MockOutage[] = [
  {
    id: "redis-oom",
    name: "Memory leak in Redis cache",
    service: "cache",
    severity: "high",
    errorCode: "REDIS-OOM",
    summary:
      "Session keys are filling Redis past maxmemory; writes start failing and session lookups time out.",
    log: `14:41:02.884Z  WARN   cache.redis   used_memory=4.19G maxmemory=4.00G mem_fragmentation_ratio=1.18 evicted_keys=1284021
14:41:03.114Z  ERROR  cache.redis   OOM command not allowed when used memory > 'maxmemory'.
14:41:03.117Z  ERROR  session.store redis.exceptions.ResponseError: OOM command not allowed
                         at SessionStore.get (src/cache/session-store.ts:88:15)
                         at async requireAuth (src/middleware/auth.ts:41:22)
14:41:03.640Z  ERROR  web.session   500 GET /session/refresh reason=cache_write_failed
14:41:04.402Z  WARN   edge.gateway  upstream latency p99=2410ms (+1870ms vs 1h baseline) route=/session/*`,
  },
  {
    id: "gateway-504",
    name: "API gateway 504 timeout",
    service: "api-gateway",
    severity: "critical",
    errorCode: "HTTP-504",
    summary:
      "Checkout requests are timing out at the edge while the payments upstream stalls on a saturated dependency.",
    log: `09:12:44Z ERROR api-gateway upstream timed out (110:Connection timed out) while reading response header from upstream,
                   upstream: "http://payments-api.prod.svc:8080/v1/charges", request_id=7f3c1a9e
09:12:44Z WARN  api-gateway POST /v1/checkout HTTP/2.0 504 up_response_time=10.002s upstream_status=504
09:12:45Z WARN  api-gateway 504 rate=41.2% window=60s threshold=1% circuit=closed
09:12:45Z WARN  api-gateway upstream=payments-api p99=8740ms (baseline 410ms) db_pool=exhausted active_conns=200/200
09:12:46Z ERROR checkout-web Uncaught Error: charge authorization failed (upstream_timeout)
                   at processCharge (src/checkout/charge.ts:214:9)`,
  },
  {
    id: "k8s-crashloop",
    name: "Kubernetes pod CrashLoopBackOff",
    service: "checkout-web",
    severity: "high",
    errorCode: "CFG-YAML-001",
    summary:
      "The checkout web pod cannot boot after a config change and the restart loop is draining capacity.",
    log: `$ kubectl -n prod describe pod checkout-web-7d9f6b8f4-x2q7m
  Type     Reason     Age                From     Message
  ----     ------     ----               ----     -------
  Warning  BackOff    92s (x6 over 4m)   kubelet  Back-off restarting failed container checkout-web
  Normal   Pulled     96s (x5 over 4m)   kubelet  Container image "registry.example.com/checkout-web:2026.9.14-1" already present
  Warning  Failed     96s (x5 over 4m)   kubelet  Error: failed to start container: exit status 1

07:58:31.204Z FATAL config  invalid configuration: yaml: line 3: did not find expected key
                     at loadConfig (src/config/index.ts:57:11)
07:58:31.210Z FATAL config  APPLICATION_CONFIG from ConfigMap "checkout-web-config" failed validation`,
  },
  {
    id: "pg-pool",
    name: "Postgres connection pool exhaustion",
    service: "payments-api",
    severity: "critical",
    errorCode: "PG-53300",
    summary:
      "All database connections are taken; charge authorizations fail and retries are amplifying the load.",
    log: `14:03:09.661Z ERROR postgres.pool  FATAL: sorry, too many clients already (max_connections=200, active=200, waiting=46)
14:03:09.663Z ERROR payments-api    DatabaseError: ConnectionTerminated: client unexpectedly closed the connection
                                    at Pool.acquire (src/db/pg-pool.ts:132:13)
                                    at async authorizeCharge (src/payments/authorize.ts:88:5)
14:03:10.018Z WARN  payments-api    retry budget exhausted 3/3 attempts service=chargeAuthorization code=53300
14:03:10.442Z WARN  api-gateway     503 upstream=payments-api active_conns=200/200 queue_depth=812
14:03:11.207Z ERROR checkout-web    POST /v1/checkout 503 upstream_unavailable`,
  },
  {
    id: "kafka-lag",
    name: "Kafka consumer lag backlog",
    service: "data-pipeline",
    severity: "medium",
    errorCode: "KFK-LAG",
    summary:
      "The invoice-sync group keeps rebalancing, lag is compounding, and downstream writes have paused.",
    log: `21:47:16Z WARN   pipeline.consumer  consumer lag rising group=invoice-sync topic=orders.v3 partition=7 lag=2841194
21:47:18Z ERROR  pipeline.consumer  [Consumer clientId=consumer-invoice-sync-3] Attempt to heartbeat failed since last poll
                                    was 312845 ms ago which is longer than the configured interval (300000 ms)
21:47:19Z WARN   pipeline.consumer  Preparing to rebalance group invoice-sync in state PreparingRebalance
                                    members=[consumer-invoice-sync-1, consumer-invoice-sync-2, consumer-invoice-sync-3]
21:47:25Z ERROR  pipeline.ingest     downstream writes paused: 6110200 records behind watermark`,
  },
];
