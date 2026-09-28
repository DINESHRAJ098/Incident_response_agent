"""Seed the Hindsight Cloud bank with realistic resolved incidents.

Run once (safe to re-run — document_ids upsert, no duplicates):
    python seed_incidents.py

Requires .env: HINDSIGHT_API_KEY, HINDSIGHT_API_URL, HINDSIGHT_BANK_ID.
"""

from agent import (
    _close_client,
    ensure_bank,
    get_hindsight_client,
    load_config,
    persist_resolution,
)
from schemas import IncidentNew, Severity

SEEDS = [
    (
        "seed-001",
        IncidentNew(
            title="Checkout API 500s after deploy",
            description="p99 latency >8s on /checkout with DB connection pool timeouts right after release v2.14.",
            logs="ERROR HikariPool - Connection is not available, request timed out after 30000ms | FATAL: remaining connection slots are reserved",
            severity=Severity.high,
        ),
        "Raised DB max_connections from 100 to 250, increased app pool size to 50, and added PgBouncer in transaction mode. Latency recovered in 10 min.",
    ),
    (
        "seed-002",
        IncidentNew(
            title="Pods OOMKilled in payments service",
            description="Payments pods restarting every few minutes, exit 137, heap growing unbounded after new fraud-check library.",
            logs="OOMKilled (exit 137) | java.lang.OutOfMemoryError: Java heap space | container memory usage 512Mi limit",
            severity=Severity.critical,
        ),
        "Raised memory limit 512Mi→2Gi, set -Xmx1g, and disabled the leaky in-memory fraud cache. Rolled out v2.15.1, restarts stopped.",
    ),
    (
        "seed-003",
        IncidentNew(
            title="Intermittent DNS failures in Kubernetes",
            description="Random 5s delays and NXDOMAIN for internal service names across all namespaces.",
            logs="nslookup timeout | CoreDNS: read udp i/o timeout | ndots:5 causing external queries for short names",
            severity=Severity.high,
        ),
        "Fixed CoreDNS forward plugin config, added ndots:2 to pod DNS config, and scaled CoreDNS replicas 2→4. Resolution time back to <5ms.",
    ),
    (
        "seed-004",
        IncidentNew(
            title="Kafka consumer lag growing on orders topic",
            description="Consumer lag crossed 2M messages, order processing delayed by 40 min during sale event.",
            logs="Consumer lag 2,140,000 | poll timeout | OFFSET_OUT_OF_RANGE on partition 7",
            severity=Severity.high,
        ),
        "Increased partitions 12→24, scaled consumers 4→10, and raised max.poll.records. Lag drained in 25 min; added lag alerting at 100k.",
    ),
    (
        "seed-005",
        IncidentNew(
            title="Redis outage caused cache stampede on DB",
            description="Redis failover during maintenance; thundering herd of 20k qps hit Postgres directly and it fell over.",
            logs="Redis: READONLY replica | DB CPU 100% | 20k concurrent queries on products table",
            severity=Severity.critical,
        ),
        "Enabled Redis Sentinel with 3 nodes, added jittered TTLs + request coalescing (singleflight), and a circuit breaker. DB load normalized.",
    ),
    (
        "seed-006",
        IncidentNew(
            title="Disk full on /var/log stopped API nodes",
            description="Nodes became NotReady, kubelet evicting pods; root disk 100% used by uncompressed app logs.",
            logs="no space left on device | kubelet: image garbage collection failed | df: /dev/sda1 100%",
            severity=Severity.medium,
        ),
        "Added logrotate (daily, 7-day retention, compress), moved logs to a 50Gi volume, and set a disk-pressure alert at 80%.",
    ),
    (
        "seed-007",
        IncidentNew(
            title="TLS certificate expired on public API",
            description="Clients failing with certificate verify errors; cert expired at midnight, renewal cron had been failing silently for weeks.",
            logs="ssl.SSLCertVerificationError: certificate has expired | x509: certificate has expired or is not yet valid",
            severity=Severity.critical,
        ),
        "Renewed cert via cert-manager, fixed the failing ACME challenge (blocked HTTP-01 port), and added a 30/7/1-day expiry alert.",
    ),
    (
        "seed-008",
        IncidentNew(
            title="Slow query missing index on orders table",
            description="Order history page timing out; one query doing a full sequential scan over 40M rows.",
            logs="Seq Scan on orders (cost=0.00..1823456.00 rows=40M) | statement timeout 30s exceeded",
            severity=Severity.medium,
        ),
        "Added composite index on (user_id, created_at), ran ANALYZE; query went from 28s to 40ms. Added pg_stat_statements review to weekly checklist.",
    ),
    (
        "seed-009",
        IncidentNew(
            title="CrashLoopBackOff from bad env var",
            description="New deployment crash-looping; app exits immediately reading a missing S3_BUCKET_REGION variable.",
            logs="CrashLoopBackOff | KeyError: 'S3_BUCKET_REGION' | container exit code 1",
            severity=Severity.medium,
        ),
        "Fixed ConfigMap to include S3_BUCKET_REGION, added startup config validation that fails fast with a clear message, redeployed.",
    ),
    (
        "seed-010",
        IncidentNew(
            title="429 rate limits from payment provider",
            description="Checkout failing at peak; provider throttles at 100 rps and we burst to 300 rps with retries amplifying traffic.",
            logs="HTTP 429 Too Many Requests | Retry-After: 60 | retry storm: 3x amplification",
            severity=Severity.high,
        ),
        "Added exponential backoff with jitter, a token-bucket client-side limiter at 80 rps, and queued non-urgent captures. 429s dropped to zero.",
    ),
]


def main() -> None:
    cfg = load_config()
    print(f"Seeding bank: {cfg['bank_id']} @ {cfg['base_url']}")
    client = get_hindsight_client()
    try:
        ensure_bank(client, cfg["bank_id"])
        for doc_id, incident, resolution in SEEDS:
            persist_resolution(client, cfg["bank_id"], doc_id, incident, resolution)
            print(f"  stored {doc_id}: {incident.title}")
        print(f"Done — {len(SEEDS)} incidents retained (re-runs upsert, no duplicates).")
    finally:
        _close_client(client)


if __name__ == "__main__":
    main()
