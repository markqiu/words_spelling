from pydantic import BaseModel
from typing import Optional

class SegmentRequest(BaseModel):
    text: str
    mode: str  # "word" | "phrase" | "sentence"
    engine: Optional[str] = "spacy"  # "spacy" | "api"

class SegmentResponse(BaseModel):
    segments: list[str]
    engine_used: str
    success: bool
    error: Optional[str] = None
    metadata: Optional[dict] = None

class HealthResponse(BaseModel):
    status: str
    spacy_loaded: bool
