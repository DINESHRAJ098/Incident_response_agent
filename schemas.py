"""Shared Pydantic schemas for incident analysis.

Used by agent.py (pure functions) and later by main.py (FastAPI layer).
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentNew(BaseModel):
    """Input for POST /api/incidents/new — analysis only, no persistence."""

    title: str = Field(..., min_length=3, description="Short incident title")
    description: str = Field(..., min_length=5, description="What happened / impact")
    logs: str = Field(default="", description="Relevant log excerpt (optional)")
    severity: Severity = Field(default=Severity.medium)


class ResolveRequest(BaseModel):
    """Input for POST /api/incidents/resolve — persist a resolved incident."""

    incident_id: str = Field(..., min_length=1, description="ID returned by /new or client-generated")
    resolution: str = Field(..., min_length=5, description="Confirmed fix / resolution steps")
    title: Optional[str] = Field(default=None, description="Original title (for memory text)")
    description: Optional[str] = Field(default=None, description="Original description")
    logs: Optional[str] = Field(default=None, description="Original logs")
    severity: Optional[Severity] = Field(default=None)


class SimilarIncident(BaseModel):
    """One recalled past incident from Hindsight."""

    memory_id: str = ""
    text: str = ""
    type: Optional[str] = None
    document_id: Optional[str] = None


class Suggestion(BaseModel):
    """One candidate resolution with confidence + references."""

    resolution: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    references: List[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    """Output of analyze_incident() and POST /api/incidents/new."""

    incident_id: str
    suggestions: List[Suggestion]
    similar_incidents: List[SimilarIncident] = Field(default_factory=list)


class StoredIncident(BaseModel):
    """One item returned by GET /api/incidents/ (via list_memories)."""

    memory_id: str = ""
    text: str = ""
    type: Optional[str] = None
    document_id: Optional[str] = None


class FeedbackRequest(BaseModel):
    """Input for POST /api/incidents/feedback — frontend resends full incident.
    helpful=True  -> answer solved the user's problem (good example).
    helpful=False -> answer was wrong/useless (bad example to avoid).
    """

    incident_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=3)
    description: str = Field(..., min_length=5)
    logs: str = Field(default="")
    severity: Severity = Field(default=Severity.medium)
    helpful: bool = Field(..., description="True if the suggestions helped, False otherwise")
    suggestion_index: Optional[int] = Field(default=None, description="Which suggestion (0-based) was rated")


class StoredDocument(BaseModel):
    """One full-text document from the bank (via documents API)."""

    document_id: str = ""
    text: str = ""
    created_at: Optional[str] = None
    memory_count: int = 0
