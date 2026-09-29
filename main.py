"""FastAPI backend for the incident-resolution agent.

Endpoints:
  POST /api/incidents/new       -> analyze (no persistence)
  POST /api/incidents/resolve   -> persist confirmed fix
  GET  /api/incidents/          -> list/search stored incidents
  POST /api/incidents/feedback  -> store helpful / not-helpful user signal

All heavy lifting lives in agent.py; this file is HTTP only.
Run with:  uvicorn main:app --reload   (use the .venv python)
"""

from fastapi import FastAPI, HTTPException, Query

from fastapi.middleware.cors import CORSMiddleware

from agent import (
    _close_client,
    aget_document,
    alist_documents,
    analyze_incident,
    ensure_bank,
    get_hindsight_client,
    load_config,
    persist_feedback,
    resolve_incident,
)
from schemas import (
    AnalyzeResponse,
    FeedbackRequest,
    IncidentNew,
    ResolveRequest,
    Severity,
)

app = FastAPI(title="Incident Resolution API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
"https://hindsight-project-incident-agent.onrender.com/",  # your deployed frontend URL
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    """Health check (Render hits this) — no external calls."""
    try:
        cfg = load_config()
        provider = cfg.get("provider")
    except Exception:
        provider = None
    return {"status": "ok", "llm_provider": provider or "none"}


@app.on_event("startup")
async def _startup() -> None:
    # NOTE: sync hindsight_client methods use run_until_complete internally,
    # which fails inside FastAPI's running event loop — so startup uses the
    # async (a*) client methods. Route handlers below are sync (run in a
    # threadpool), where the sync methods work fine.
    cfg = load_config()
    client = get_hindsight_client()
    try:
        try:
            await client.aget_bank_config(cfg["bank_id"])
        except Exception as exc:
            msg = str(exc)
            if "404" not in msg and "not found" not in msg.lower():
                raise
            await client.acreate_bank(
                bank_id=cfg["bank_id"],
                name="Incidents",
                mission="Track production incidents, root causes and confirmed resolutions.",
            )
    finally:
        await client.aclose()


@app.post("/api/incidents/new", response_model=AnalyzeResponse)
def create_incident(incident: IncidentNew, top_k: int = Query(default=3, ge=1, le=10)):
    try:
        return analyze_incident(incident, top_k=top_k)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:  # Hindsight/LLM outage
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}")


@app.post("/api/incidents/resolve")
def resolve(request: ResolveRequest):
    try:
        doc_id = resolve_incident(request)
        return {"status": "stored", "document_id": doc_id}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Persist failed: {exc}")


@app.get("/api/incidents/")
async def list_incidents(
    q: str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List stored incidents as full-text documents (not fact fragments).

    q filters by document-ID substring: 'incident-' resolved fixes,
    'feedback-' user signals, 'seed-' seeded samples.
    """
    try:
        cfg = load_config()
        client = get_hindsight_client()
        try:
            total, items = await alist_documents(client, cfg["bank_id"], query=q, limit=limit, offset=offset)
        finally:
            await client.aclose()
        return {"total": total, "items": [i.model_dump() for i in items]}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lookup failed: {exc}")


@app.get("/api/incidents/{document_id}")
async def get_incident(document_id: str):
    """Fetch one stored incident's full text by document ID."""
    try:
        cfg = load_config()
        client = get_hindsight_client()
        try:
            doc = await aget_document(client, cfg["bank_id"], document_id)
        finally:
            await client.aclose()
        if doc is None:
            raise HTTPException(status_code=404, detail=f"No document '{document_id}'")
        return doc.model_dump()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lookup failed: {exc}")


@app.post("/api/incidents/feedback")
def feedback(request: FeedbackRequest):
    """Store whether the user found the suggestions helpful.

    Frontend resends the full incident text (server stays stateless).
    helpful=True  -> good example, ranked up for future recall.
    helpful=False -> bad example, avoided in future recall.
    """
    try:
        cfg = load_config()
        client = get_hindsight_client()
        try:
            incident = IncidentNew(
                title=request.title,
                description=request.description,
                logs=request.logs,
                severity=request.severity or Severity.medium,
            )
            doc_id = persist_feedback(
                client,
                cfg["bank_id"],
                request.incident_id,
                incident,
                request.helpful,
                request.suggestion_index,
            )
        finally:
            _close_client(client)
        return {"status": "stored", "document_id": doc_id, "helpful": request.helpful}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Feedback failed: {exc}")
