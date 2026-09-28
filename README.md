# Incident Resolution Agent

Agno-orchestrated backend that finds semantically similar past incidents in
Hindsight Cloud memory and generates ranked resolution suggestions with
confidence scores. Resolved incidents and user feedback are persisted back
into memory for future recall.

## Stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Orchestration| Agno (`Agent` + provider model)                   |
| Semantic memory | Hindsight Cloud (`hindsight-client`, `hindsight-agno`) |
| LLM          | Gemini (`gemini-3.1-flash-lite`) or Groq (`openai/gpt-oss-20b`) |
| API          | FastAPI + Uvicorn                                 |

No local embeddings — Hindsight does embedding + fact extraction server-side
on every `retain`/`recall`.

## Setup

```bash
# use the project venv (has agno, google-genai, groq, hindsight-*, fastapi)
.venv/Scripts/python.exe -m pip list   # venv has no pip; use `uv` to add packages:
uv pip install --python .venv/Scripts/python.exe <package>
```

Copy `.env` keys (values never committed):

```env
HINDSIGHT_API_KEY=...
HINDSIGHT_API_URL=https://api.hindsight.vectorize.io
HINDSIGHT_BANK_ID=incidents        # required, no default — pick ONE name
GEMINI_API_KEY=...                 # and/or GROQ_API_KEY (at least one for generation)
GEMINI_MODEL=gemini-3.1-flash-lite # optional override
GROQ_MODEL=openai/gpt-oss-20b      # optional override
```

**Provider rule:** Groq key present → Groq wins (even if both keys set).
Gemini key only → Gemini. Neither → recall-only mode (generation errors
clearly, memory functions still work).

> Plain `gemini-3.1-flash` does not exist on this API — use
> `gemini-3.1-flash-lite` (default) or another ID from `ListModels`.

## Files

* `schemas.py` — Pydantic contracts (`IncidentNew`, `ResolveRequest`,
  `FeedbackRequest`, `Suggestion`, `AnalyzeResponse`, …).
* `agent.py` — pure functions, no FastAPI. Run `python agent.py` for an
  interactive smoke test (`--sample` skips prompts, `--persist` also retains
  the top suggestion).
* `seed_incidents.py` — one-time seeding of 10 realistic resolved incidents
  (`python seed_incidents.py`; safe to re-run, upserts by `seed-00x`).
* `main.py` — FastAPI layer (thin wrappers over `agent.py`).

## API

```bash
.venv/Scripts/python.exe -m uvicorn main:app --reload
# interactive docs at http://127.0.0.1:8000/docs
```

The four endpoints form a chain: `/new` produces an `incident_id` (+ ranked
suggestions) that `/resolve` and `/feedback` consume; `/incidents/` (list)
and `/incidents/{document_id}` (single) let you read back everything stored.
Nothing is persisted by `/new` itself.

### 1. POST `/api/incidents/new` — analyze an incident

Send the incident. You get back a generated `incident_id`, 2–3 ranked
suggestions (each with `confidence` 0–1 and `references`), and the similar
past incidents that were used.

```bash
curl -X POST "http://127.0.0.1:8000/api/incidents/new?top_k=3" \
  -H "Content-Type: application/json" -d "{
    \"title\": \"Redis timeouts on product pages\",
    \"description\": \"Product pages timing out, Redis replica went READONLY\",
    \"logs\": \"Redis READONLY replica errors\",
    \"severity\": \"high\"
  }"
```

Response (shape):

```json
{
  "incident_id": "9f910112",
  "suggestions": [
    {"resolution": "Enable Redis Sentinel with 3 nodes…", "confidence": 0.9,
     "references": ["<memory_id>", "incident-seed-005"]},
    {"resolution": "Add jittered TTLs + request coalescing…", "confidence": 0.7,
     "references": ["<memory_id>"]}
  ],
  "similar_incidents": [
    {"memory_id": "…", "text": "Incident seed-005 occurred…", "type": "world",
     "document_id": "incident-seed-005"}
  ]
}
```

* `incident_id` — random 8-char hex. **Save it** (frontend state): it is the
  link to steps 2 and 3. It exists nowhere else until you store something.
* `suggestion_index` — simply the position in the `suggestions` array:
  first card = `0`, second = `1`, third = `2`. Suggestions arrive sorted by
  confidence, so `0` is always the top pick. If your UI has one helpful-button
  for the whole answer, send `0` (or omit the field — it's optional).
* `similar_incidents` — what the bank recalled; shown for transparency, and
  fed into the prompt that produced the suggestions.

### 2. POST `/api/incidents/resolve` — persist a confirmed fix

Call this when the incident is actually fixed. Needs the `incident_id` from
step 1 plus the confirmed `resolution` text.

```bash
curl -X POST http://127.0.0.1:8000/api/incidents/resolve \
  -H "Content-Type: application/json" -d "{
    \"incident_id\": \"9f910112\",
    \"resolution\": \"Enabled Redis Sentinel with 3 nodes; timeouts gone.\",
    \"title\": \"Redis timeouts on product pages\",
    \"description\": \"Product pages timing out, Redis replica went READONLY\",
    \"severity\": \"high\"
  }"
```

Response: `{"status": "stored", "document_id": "incident-9f910112"}`.
Re-resolving the same `incident_id` upserts (no duplicates). Stored under the
`incident-` prefix so it reads as a confirmed fix in future recall.

### 3. POST `/api/incidents/feedback` — store helpful / not-helpful signal

The "was this helpful?" button. The server is stateless, so the frontend
**resends the full incident** it originally sent, plus the `incident_id` from
step 1 and a `helpful` flag:

* `helpful: true` → "this solved my problem" (good example, ranked up later).
* `helpful: false` → "this was wrong/useless" (bad example, avoided later).

```bash
curl -X POST http://127.0.0.1:8000/api/incidents/feedback \
  -H "Content-Type: application/json" -d "{
    \"incident_id\": \"9f910112\",
    \"title\": \"Redis timeouts on product pages\",
    \"description\": \"Product pages timing out, Redis replica went READONLY\",
    \"logs\": \"Redis READONLY replica errors\",
    \"severity\": \"high\",
    \"helpful\": true,
    \"suggestion_index\": 0
  }"
```

Response:
`{"status": "stored", "document_id": "feedback-9f910112", "helpful": true}`.
Same bank, `feedback-` prefix + `helpful:true/false` metadata keep signals
apart from confirmed fixes. Re-voting upserts.

### 4. GET `/api/incidents/` — browse stored incidents (full text)

```bash
curl "http://127.0.0.1:8000/api/incidents/?limit=20&offset=0"
curl "http://127.0.0.1:8000/api/incidents/?q=incident-"   # only confirmed fixes
curl "http://127.0.0.1:8000/api/incidents/?q=feedback-"   # only user signals
curl "http://127.0.0.1:8000/api/incidents/?q=seed-"       # only seeded samples
```

Response:

```json
{"total": 12, "items": [
  {"document_id": "incident-seed-001",
   "text": "Incident seed-001 | Title: Checkout API 500s… | Resolution: Raised DB max_connections…",
   "created_at": "2026-09-28T14:37:32+00:00", "memory_count": 2}
]}
```

This reads **documents** (full original text), not fact fragments. Only writes
that carried a `document_id` appear (all seeds, `/resolve`, `/feedback`).

### 5. GET `/api/incidents/{document_id}` — one incident in full

```bash
curl http://127.0.0.1:8000/api/incidents/incident-seed-001
# missing id -> 404 {"detail": "No document '…'"}
```

### End-to-end example (typical frontend flow)

```
1. POST /new        -> {incident_id: "abc123", suggestions: [s0, s1, s2]}
2. user clicks "helpful" on s0
3. POST /feedback   -> {incident_id: "abc123", <original incident fields>,
                        helpful: true, suggestion_index: 0}
4. ... incident really fixed ...
5. POST /resolve    -> {incident_id: "abc123", resolution: "<the real fix>", ...}
6. GET  /incidents/ -> new entries visible as feedback-abc123 / incident-abc123
```

## Notes

* Hindsight `recall` has no native top-k — `max_tokens`/`budget` control
  breadth; `top_k` only slices what we return.
* `ensure_bank()` checks existence first (`get_bank_config`), creates only on
  404 — never duplicates banks. Use one `HINDSIGHT_BANK_ID` everywhere.
* Startup uses Hindsight's async (`a*`) methods because the sync client can't
  run inside FastAPI's event loop; route handlers are sync (threadpool) and
  use the sync methods.
* The `Models.generate_content` AFC log line comes from Agno's Gemini
  integration (upstream) — harmless, ignore it.
