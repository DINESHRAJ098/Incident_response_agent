# Architecture

## Layers (dependency direction: top → bottom)

```
pages/            thin route components
  └─ features/    landing/ and console/ (UI + feature state)
       └─ components/   shared presentational pieces (BrandMark, SeverityBadge, ui/*)
       └─ services/agent   network boundary (only place that calls fetch)
            └─ domain/     types shared by everyone (no I/O)
            └─ data/       static reference data (sample archive, outage presets)
```

Rule of thumb: **components render, `ConsoleProvider` orchestrates, `services/agent` talks to the network,
`domain` defines the shapes.**

## Console data flow

```
User pastes log / fires a preset
        │
        ▼
ChatView / TriageView ──► useConsole().send(text)                (ConsoleProvider)
                                   │
                                   ▼
                    services/agent/client.sendChat()
                       toIncidentPayload()  → { title, description, logs, severity }
                       POST /api/incidents/new?top_k=4
                                   │
                                   ▼
                    normalize.normalizeAnalyzeResponse()
                       suggestions[]      → markdown reply + confidence
                       similar_incidents[] → RecalledMemory[]   (memory rail)
                                   │
                                   ▼
             AgentAnswer { reply, confidence, baseConfidence, memories, incidentId }
                                   │
                                   ▼
        ChatMessage renders reply · MemoryPanel renders memories · ConfidenceMeter shows the lift
```

Feedback (👍/👎) calls `POST /api/incidents/feedback` and then reloads the archive, so the rating appears
as a new memory document in **Incident memory**.

## `ConsoleProvider` (single source of console state)

| Concern | State |
|---|---|
| Navigation | `view: "chat" \| "memory" \| "triage"` |
| Chat | `messages`, `isSending`, `stage` (progress / wake-up label), `sendError` |
| Archive | `incidents`, `incidentsStatus`, `selectedIncidentId` |
| Memory rail | `activeAnswer` (which response's recalled memories are shown) |

Cross-view actions live here so views stay decoupled: `injectPreset()` (Triage → Chat) and
`askAboutIncident()` (Memory → Chat).

## Network resilience (`services/agent`)

| File | Responsibility |
|---|---|
| `config.ts` | Agent URL, relay URL, per-call timeouts |
| `http.ts` | `fetchJson`: tries same-origin `/api` → public relay → direct; detects HTML fallbacks; maps failures |
| `errors.ts` | `ApiError` (`timeout`/`network`/`http`/`parse`) with a user-facing hint |
| `normalize.ts` | Raw payload → typed domain objects, tolerant of missing fields |
| `client.ts` | The three public functions: `sendChat`, `sendFeedback`, `fetchIncidents` |

`api/[...path].ts` is the production relay: it forwards the path verbatim (the archive route is
trailing-slash-sensitive) and adds permissive CORS headers.

## Known limitations (honest notes)

- **Baseline confidence is an estimate.** The API returns no "without memory" score, so the UI approximates it
  (≈60% of the top confidence when memories were recalled). It illustrates the lift; it is not a measured A/B result.
- **Similarity % is rank-derived.** The API ranks recalled incidents but doesn't return a score, so displayed
  match percentages descend by rank.
- **Severity is inferred client-side** from keywords in the pasted text before it is sent.
- `data/sample-incidents.ts` is reference data / enrichment fallback; the live archive comes from the backend.
