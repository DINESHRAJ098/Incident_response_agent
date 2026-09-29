"""Incident-resolution agent functions (no FastAPI here).

Agent flow:
  1. Receive incident report (IncidentNew).
  2. Extract context -> format_incident_for_query().
  3. Query Hindsight Cloud for similar incidents (recall handles embeddings
     server-side; no local fastembed needed).
  4. Build prompt with context + similar incidents.
  5. Generate candidate resolutions with confidence scores (Agno + Gemini/Groq).
  6. Return suggestions + references.
  7. Persist resolution via persist_resolution() for future recall.

Run smoke test with:  python agent.py [--persist]
"""

import argparse
import json
import os
import uuid
from typing import List, Tuple

from dotenv import load_dotenv

from schemas import (
    AnalyzeResponse,
    IncidentNew,
    ResolveRequest,
    Severity,
    SimilarIncident,
    StoredDocument,
    StoredIncident,
    Suggestion,
)

load_dotenv()

CLOUD_DEFAULT_URL = "https://api.hindsight.vectorize.io"



# ---------------------------------------------------------------------------
# Config / clients
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Read cloud-only config from environment (.env supported).

    Required: HINDSIGHT_API_KEY, HINDSIGHT_BANK_ID (no default — set it in .env).
    Generation needs at least one LLM key: GEMINI_API_KEY (or GOOGLE_API_KEY)
    and/or GROQ_API_KEY. If both are set, Groq wins; Groq-only or Gemini-only
    keys use that provider. Optional: GEMINI_MODEL (default
    gemini-3.1-flash-lite),
    GROQ_MODEL (default openai/gpt-oss-20b), HINDSIGHT_API_URL.
    """
    base_url = (
        os.getenv("HINDSIGHT_API_URL")
        or os.getenv("HINDSIGHT_BASE_URL")
        or CLOUD_DEFAULT_URL
    ).rstrip("/")
    api_key = os.getenv("HINDSIGHT_API_KEY")
    bank_id = os.getenv("HINDSIGHT_BANK_ID")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    missing = []
    if not api_key:
        missing.append("HINDSIGHT_API_KEY")
    if not bank_id:
        missing.append("HINDSIGHT_BANK_ID (no default — add it to .env)")
    if missing:
        raise RuntimeError(
            f"Missing required env vars: {', '.join(missing)}. "
            "Add them to .env (cloud Hindsight only)."
        )
    provider = "groq" if groq_key else ("gemini" if gemini_key else None)
    return {
        "base_url": base_url,
        "api_key": api_key,
        "bank_id": bank_id,
        "provider": provider,
        "gemini_key": gemini_key,
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"),
        "groq_key": groq_key,
        "groq_model": os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    }


def get_hindsight_client():
    """Create a Hindsight Cloud client. Verified signature: Hindsight(base_url, api_key)."""
    from hindsight_client import Hindsight

    cfg = load_config()
    return Hindsight(base_url=cfg["base_url"], api_key=cfg["api_key"])


def _close_client(client) -> None:
    """Best-effort close of the Hindsight client (prevents 'Unclosed client
    session / connector' aiohttp warnings)."""
    try:
        client.close()
    except Exception:
        pass


def ensure_bank(client, bank_id: str):
    """Ensure the bank exists — checks first, creates only if missing.

    Never blind-creates: get_bank_config() 404s for unknown banks, in which
    case we create once. Existing banks are reused untouched.
    """
    try:
        client.get_bank_config(bank_id)
        return None  # already exists — reuse, create nothing
    except Exception as exc:
        msg = str(exc)
        if "404" not in msg and "not found" not in msg.lower():
            raise  # real error (auth, network) — don't mask it
    return client.create_bank(
        bank_id=bank_id,
        name="Incidents",
        mission="Track production incidents, root causes and confirmed resolutions.",
    )


# ---------------------------------------------------------------------------
# Context extraction / formatting
# ---------------------------------------------------------------------------

def format_incident_for_query(incident: IncidentNew) -> str:
    """Canonical query text used for Hindsight recall."""
    parts = [
        f"Title: {incident.title}",
        f"Severity: {incident.severity.value}",
        f"Description: {incident.description}",
    ]
    if incident.logs:
        parts.append(f"Logs: {incident.logs[:4000]}")
    return "\n".join(parts)


def format_incident_for_memory(
    incident_id: str, incident: IncidentNew, resolution: str
) -> str:
    """Canonical memory text stored on resolve (keeps id + fix together)."""
    return (
        f"Incident {incident_id} | Title: {incident.title} | "
        f"Severity: {incident.severity.value} | "
        f"Description: {incident.description} | "
        f"Logs: {(incident.logs or '')[:4000]} | "
        f"Resolution: {resolution}"
    )


# ---------------------------------------------------------------------------
# Memory ops (Hindsight Cloud)
# ---------------------------------------------------------------------------

def find_similar_incidents(
    client,
    bank_id: str,
    query_text: str,
    top_k: int = 3,
    budget: str = "mid",
    max_tokens: int = 4096,
) -> List[SimilarIncident]:
    """Recall similar incidents. Hindsight ranks server-side; we slice to top_k.

    Verified: client.recall(bank_id, query, max_tokens, budget,
    include_chunks, ...) -> RecallResponse(results=[RecallResult(...)]).

    NOTE: Hindsight has no native top-k; max_tokens/budget control recall
    breadth, top_k only limits what we return to the prompt/API.
    """
    resp = client.recall(
        bank_id=bank_id,
        query=query_text,
        budget=budget,
        max_tokens=max_tokens,
        include_chunks=True,
    )
    results = getattr(resp, "results", []) or []
    similar: List[SimilarIncident] = []
    for r in results[: max(top_k, 0)]:
        similar.append(
            SimilarIncident(
                memory_id=getattr(r, "id", "") or "",
                text=getattr(r, "text", "") or "",
                type=getattr(r, "type", None),
                document_id=getattr(r, "document_id", None),
            )
        )
    return similar


def persist_resolution(
    client,
    bank_id: str,
    incident_id: str,
    incident: IncidentNew,
    resolution: str,
) -> str:
    """Persist a resolved incident. Returns the document_id used.

    Verified: client.retain(bank_id, content, document_id, metadata, ...).
    Uses document_id=f"incident-{incident_id}" so re-resolves upsert.
    """
    content = format_incident_for_memory(incident_id, incident, resolution)
    client.retain(
        bank_id=bank_id,
        content=content,
        document_id=f"incident-{incident_id}",
        metadata={"status": "resolved", "severity": incident.severity.value},
    )
    return f"incident-{incident_id}"


def get_incidents(
    client, bank_id: str, query: str = "", limit: int = 20, offset: int = 0
) -> Tuple[int, List[StoredIncident]]:
    """List/search stored incidents. Verified: list_memories(bank_id, search_query, limit, offset)."""
    resp = client.list_memories(
        bank_id=bank_id,
        search_query=query or None,
        limit=limit,
        offset=offset,
    )
    items = getattr(resp, "items", None) or getattr(resp, "results", None) or []
    total = getattr(resp, "total", len(items)) or len(items)
    out = [
        StoredIncident(
            memory_id=getattr(m, "id", "") or "",
            text=getattr(m, "text", "") or "",
            type=getattr(m, "type", None),
            document_id=getattr(m, "document_id", None),
        )
        for m in items
    ]
    return total, out


# ---------------------------------------------------------------------------
# Generation (Agno + Gemini)
# ---------------------------------------------------------------------------

def build_prompt(incident: IncidentNew, similar: List[SimilarIncident]) -> str:
    """Build the LLM prompt: current incident + retrieved neighbours."""
    lines = [
        "You are an incident-resolution assistant.",
        "Given the current incident and similar past incidents, propose 2-3 "
        "candidate resolutions ranked by confidence (0.0-1.0).",
        "Each suggestion must cite which similar incident(s) support it.",
        "",
        "CURRENT INCIDENT:",
        format_incident_for_query(incident),
        "",
        "SIMILAR PAST INCIDENTS:",
    ]
    if not similar:
        lines.append("(none found — answer from general best practices, use low confidence)")
    for i, s in enumerate(similar, 1):
        ref = s.memory_id or s.document_id or f"similar-{i}"
        lines.append(f"[{i}] ref={ref} type={s.type}\n{s.text}")
    lines += [
        "",
        'Reply as JSON: {"suggestions": ['
        '{"resolution": "...", "confidence": 0.0-1.0, "references": ["ref", ...]}, ...]}',
    ]
    return "\n".join(lines)


def get_agent():
    """Agno agent with Gemini or Groq model.

    Verified: Agent(model=Gemini(id, api_key)), Agent(model=Groq(id, api_key)).
    Groq key present -> Groq (wins ties); else Gemini.
    """
    from agno.agent import Agent

    cfg = load_config()
    if cfg["provider"] == "groq":
        from agno.models.groq import Groq

        model = Groq(id=cfg["groq_model"], api_key=cfg["groq_key"])
    elif cfg["provider"] == "gemini":
        from agno.models.google import Gemini

        model = Gemini(id=cfg["gemini_model"], api_key=cfg["gemini_key"])
    else:
        raise RuntimeError(
            "No LLM key set — need GEMINI_API_KEY (or GOOGLE_API_KEY) and/or "
            "GROQ_API_KEY in .env. Recall-only functions work without either."
        )
    return Agent(
        model=model,
        instructions=[
            "You resolve production incidents concisely.",
            "Always output valid JSON with suggestions, confidence scores and references.",
        ],
    )


def _extract_text(run_output) -> str:
    content = getattr(run_output, "content", run_output)
    if isinstance(content, str):
        return content
    # Agno may return parsed BaseModel / dict / list when output_schema is used
    if hasattr(content, "model_dump"):
        try:
            return json.dumps(content.model_dump())
        except Exception:
            return str(content)
    if isinstance(content, (dict, list)):
        return json.dumps(content)
    return str(content)


def _parse_suggestions(text: str, fallback_refs: List[str]) -> List[Suggestion]:
    """Parse LLM JSON into Suggestion list; fallback to single low-confidence item."""
    try:
        start, end = text.find("{"), text.rfind("}")
        data = json.loads(text[start : end + 1] if start != -1 and end != -1 else text)
        if isinstance(data, dict) and "error" in data:
            # Agno embeds provider errors (e.g. Gemini 503) in content instead
            # of raising — surface them cleanly, never as a "suggestion".
            err = data.get("error", {})
            msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
            return [
                Suggestion(
                    resolution=f"Generation temporarily unavailable: {msg}".strip()[:1000],
                    confidence=0.0,
                    references=fallback_refs[:3],
                )
            ]
        raw = data.get("suggestions", []) if isinstance(data, dict) else []
        out: List[Suggestion] = []
        for item in raw[:3]:
            try:
                out.append(
                    Suggestion(
                        resolution=str(item.get("resolution", "")).strip() or "No resolution text",
                        confidence=max(0.0, min(1.0, float(item.get("confidence", 0.5)))),
                        references=[str(x) for x in (item.get("references", []) or [])][:5],
                    )
                )
            except Exception:
                continue
        if out:
            return out
    except Exception:
        pass
    return [Suggestion(resolution=text.strip()[:2000] or "No suggestion", confidence=0.3, references=fallback_refs[:3])]


def analyze_incident(incident: IncidentNew, top_k: int = 3) -> AnalyzeResponse:
    """Full flow: recall similar -> prompt -> Agno generation -> ranked suggestions."""
    cfg = load_config()
    client = get_hindsight_client()
    try:
        ensure_bank(client, cfg["bank_id"])

        query_text = format_incident_for_query(incident)
        similar = find_similar_incidents(client, cfg["bank_id"], query_text, top_k=top_k)
        refs = [s.memory_id or s.document_id or "" for s in similar if (s.memory_id or s.document_id)]

        agent = get_agent()
        prompt = build_prompt(incident, similar)
        try:
            run_output = agent.run(prompt, stream=False)
            suggestions = _parse_suggestions(_extract_text(run_output), refs)
        except Exception as exc:
            suggestions = [
                Suggestion(
                    resolution=f"Generation failed ({type(exc).__name__}): {exc}".strip()[:1000],
                    confidence=0.0,
                    references=refs[:3],
                )
            ]
    finally:
        _close_client(client)
    # Highest confidence first
    suggestions.sort(key=lambda s: s.confidence, reverse=True)

    return AnalyzeResponse(
        incident_id=uuid.uuid4().hex[:8],
        suggestions=suggestions,
        similar_incidents=similar,
    )


def persist_feedback(
    client,
    bank_id: str,
    incident_id: str,
    incident: IncidentNew,
    helpful: bool,
    suggestion_index=None,
) -> str:
    """Store a user's helpful/not-helpful signal for a past answer.

    Uses document_id=f"feedback-{incident_id}" (upsert on re-vote) and
    metadata helpful=true/false + status=feedback, so it stays
    distinguishable from confirmed fixes (document_id=incident-...).
    """
    verdict = "HELPFUL — answer solved the problem" if helpful else "NOT HELPFUL — answer was wrong or useless"
    content = (
        f"User feedback on incident {incident_id}: {verdict} | "
        f"Rated suggestion index: {suggestion_index} | "
        f"{format_incident_for_query(incident)}"
    )
    client.retain(
        bank_id=bank_id,
        content=content,
        document_id=f"feedback-{incident_id}",
        metadata={"status": "feedback", "helpful": str(helpful).lower()},
    )
    return f"feedback-{incident_id}"


def _to_stored_document(d) -> StoredDocument:
    created = getattr(d, "created_at", None)
    return StoredDocument(
        document_id=getattr(d, "id", "") or "",
        text=getattr(d, "original_text", "") or "",
        created_at=str(created) if created else None,
        memory_count=getattr(d, "memory_unit_count", 0) or 0,
    )


async def alist_documents(
    client, bank_id: str, query: str = "", limit: int = 20, offset: int = 0
) -> Tuple[int, List[StoredDocument]]:
    """List full-text documents in the bank (async documents API).

    Unlike list_memories (fact fragments), documents carry the original text.
    q filters by document-ID substring: 'incident-' fixes, 'feedback-' signals.
    NOTE: list items are metadata-only, so each doc's text is fetched
    concurrently via get_document.
    """
    import asyncio

    resp = await client.documents.list_documents(
        bank_id, q=query or None, limit=limit, offset=offset
    )
    items = getattr(resp, "items", None) or []
    total = getattr(resp, "total", len(items)) or len(items)
    ids = [getattr(d, "id", "") for d in items if getattr(d, "id", "")]
    docs = await asyncio.gather(
        *(aget_document(client, bank_id, i) for i in ids)
    )
    return total, [d for d in docs if d is not None]


async def aget_document(client, bank_id: str, document_id: str):
    """Fetch one full-text document; returns None on 404."""
    try:
        doc = await client.documents.get_document(bank_id, document_id)
    except Exception as exc:
        msg = str(exc)
        if "404" in msg or "not found" in msg.lower():
            return None
        raise
    return _to_stored_document(doc)


def resolve_incident(request: ResolveRequest) -> str:
    """Helper for POST /api/incidents/resolve: rebuild IncidentNew then retain."""
    cfg = load_config()
    client = get_hindsight_client()
    try:
        ensure_bank(client, cfg["bank_id"])
        incident = IncidentNew(
            title=request.title or f"Incident {request.incident_id}",
            description=request.description or "",
            logs=request.logs or "",
            severity=request.severity or Severity.medium,
        )
        return persist_resolution(client, cfg["bank_id"], request.incident_id, incident, request.resolution)
    finally:
        _close_client(client)


# ---------------------------------------------------------------------------
# __main__ smoke test (no FastAPI here)
# ---------------------------------------------------------------------------

def _mask(value: str) -> str:
    return (value[:4] + "..." + value[-3:]) if value and len(value) > 7 else "***"


def _prompt_incident() -> IncidentNew:
    """Ask the user for incident details on the command line."""
    print("Enter the incident details (Ctrl+C to quit):")
    title = input("  Title: ").strip()
    while not title:
        print("  Title is required.")
        title = input("  Title: ").strip()
    description = input("  Description: ").strip()
    while len(description) < 5:
        print("  Description needs at least 5 characters.")
        description = input("  Description: ").strip()
    logs = input("  Logs (optional, Enter to skip): ").strip()
    raw_sev = input("  Severity [low/medium/high/critical, default medium]: ").strip().lower() or "medium"
    try:
        severity = Severity(raw_sev)
    except ValueError:
        print("  Unknown severity — using 'medium'.")
        severity = Severity.medium
    return IncidentNew(title=title, description=description, logs=logs, severity=severity)


def _sample_incident() -> IncidentNew:
    return IncidentNew(
        title="API 500 spike on /checkout",
        description="Checkout latency p99 > 8s with DB connection timeouts after deploy.",
        logs="ERROR pool timeout ... connection refused ...",
        severity=Severity.high,
    )


def main(persist: bool = False, sample: bool = False) -> None:
    cfg = load_config()
    print(f"Hindsight URL : {cfg['base_url']}")
    print(f"Bank          : {cfg['bank_id']}")
    print(f"Hindsight key : {_mask(cfg['api_key'])}")
    print(f"Gemini key   : {'set' if cfg['gemini_key'] else 'missing'}")
    print(f"Groq key     : {'set' if cfg['groq_key'] else 'missing'}")
    if cfg["provider"] == "groq":
        print(f"LLM provider : Groq ({cfg['groq_model']}, override via GROQ_MODEL)")
    elif cfg["provider"] == "gemini":
        print(f"LLM provider : Gemini ({cfg['gemini_model']}, override via GEMINI_MODEL)")
    else:
        print("LLM provider : none (recall-only mode)")

    client = get_hindsight_client()
    try:
        ensure_bank(client, cfg["bank_id"])
        print("Bank ready.")

        incident = _sample_incident() if sample else _prompt_incident()
        similar = find_similar_incidents(client, cfg["bank_id"], format_incident_for_query(incident))
        print(f"Recall: found {len(similar)} similar incident(s).")
        for s in similar:
            print(f" - [{s.memory_id or s.document_id}] {s.text[:120]}")

        if not cfg["provider"]:
            print("Skipping generation: set GEMINI_API_KEY and/or GROQ_API_KEY to test analyze_incident().")
            return

        result = analyze_incident(incident)
        print(f"Incident id: {result.incident_id}")
        for i, sug in enumerate(result.suggestions, 1):
            print(f"Suggestion {i} (conf={sug.confidence:.2f} refs={sug.references}): {sug.resolution[:300]}")

        if persist and result.suggestions:
            doc_id = persist_resolution(
                client, cfg["bank_id"], result.incident_id, incident, result.suggestions[0].resolution
            )
            print(f"Persisted as document: {doc_id}")
            total, items = get_incidents(client, cfg["bank_id"], query="checkout", limit=5)
            print(f"Stored incidents matching 'checkout': {total}")
    finally:
        _close_client(client)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Smoke-test the incident agent (no API server).")
    parser.add_argument("--persist", action="store_true", help="Also retain top suggestion + list memories")
    parser.add_argument("--sample", action="store_true", help="Use the built-in sample incident instead of prompting")
    args = parser.parse_args()
    main(persist=args.persist, sample=args.sample)
