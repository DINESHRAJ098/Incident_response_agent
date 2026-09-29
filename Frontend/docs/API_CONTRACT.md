# API contract used by the frontend

Base: FastAPI "Incident Resolution API" (Render). All calls are JSON. Implemented in `src/services/agent/client.ts`.

| Method | Path | Used for |
|---|---|---|
| `POST` | `/api/incidents/new?top_k=4` | Analyse an incident → suggestions + similar past incidents |
| `GET`  | `/api/incidents?limit=100` | Load the stored memory archive |
| `POST` | `/api/incidents/feedback` | Rate a suggestion helpful / not helpful |

## POST `/api/incidents/new`
Request
```json
{ "title": "string ≥3", "description": "string ≥5", "logs": "string", "severity": "low|medium|high|critical" }
```
Response
```json
{
  "incident_id": "string",
  "suggestions": [{ "resolution": "string", "confidence": 0.0, "references": ["string"] }],
  "similar_incidents": [{ "memory_id": "string", "text": "string", "type": "string", "document_id": "string|null" }]
}
```

## GET `/api/incidents`
```json
{ "total": 0, "items": [{ "document_id": "string", "text": "string", "created_at": "ISO", "memory_count": 0 }] }
```
`text` is pipe-delimited: `incident-010 | Title: … | Severity: … | Description: … | Logs: … | Resolution: …`
(parsed by `parseDocumentFields` in `normalize.ts`).

## POST `/api/incidents/feedback`
```json
{ "incident_id": "string", "title": "…", "description": "…", "logs": "…", "severity": "…", "helpful": true, "suggestion_index": 0 }
```

## CORS
The browser needs CORS on the agent (`allow_origins=["*"]`) *or* it goes through the relay in `api/[...path].ts`.
