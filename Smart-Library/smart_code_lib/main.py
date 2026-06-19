"""FastAPI gateway for the Smart Code Library core engine."""

from smart_code_lib.config import load_env

load_env()

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from smart_code_lib.config import get_api_key, get_max_code_bytes
from smart_code_lib.database.vector_store import VectorMemoryStore
from smart_code_lib.llm.local_models import (
    check_ollama_available,
    get_chat_llm,
    get_embedding_model_name,
    get_ollama_model,
)
from smart_code_lib.sandbox.code_runner import SelfHealingSandbox

app = FastAPI(title="Smart Code Library API", version="1.0.0")

try:
    db = VectorMemoryStore()
    llm = get_chat_llm()
    sandbox = SelfHealingSandbox(vector_db=db)
except ValueError as exc:
    db = None
    sandbox = None
    llm = None
    _startup_error = str(exc)
else:
    _startup_error = None


class QueryRequest(BaseModel):
    """Request body for semantic library queries."""

    query: str


class QueryContextRequest(BaseModel):
    """Retrieval-only query — no LLM synthesis (SOUL token policy)."""

    query: str
    limit: int = 3
    max_chars: int = 8000


class SeedingRequest(BaseModel):
    """Request body for seeding reference content into the vector store."""

    content: str
    category: str
    language: str = "All"


class RepairErrorEntry(BaseModel):
    """Single validation error from a failed repair attempt."""

    message: str
    file: str | None = None
    rule: str | None = None


class SeedRepairRequest(BaseModel):
    """Structured validation-repair pattern for memory seeding (SOUL §6)."""

    objective: str
    errors: list[RepairErrorEntry]
    resolution: str
    profile: str


class CodeRunRequest(BaseModel):
    """Request body for execute-and-heal sandbox runs."""

    code: str


def _ensure_ready() -> None:
    """Raise HTTP 503 if core services failed to initialize."""
    if _startup_error:
        raise HTTPException(status_code=503, detail=_startup_error)


def _validate_code_size(code: str) -> None:
    """Raise HTTP 413 if code exceeds MAX_CODE_BYTES."""
    encoded = code.encode("utf-8")
    limit = get_max_code_bytes()
    if len(encoded) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"Code payload exceeds maximum size of {limit} bytes.",
        )


def require_write_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> None:
    """Require X-API-Key header when API_KEY is configured."""
    expected = get_api_key()
    if expected is None:
        return
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


@app.get("/health")
async def health_check():
    """Liveness probe for deployment and monitoring."""
    if _startup_error:
        return {"status": "degraded", "detail": _startup_error}

    ollama_ok, ollama_msg = check_ollama_available()
    if not ollama_ok:
        return {"status": "degraded", "detail": ollama_msg}

    return {
        "status": "ok",
        "llm": f"ollama/{get_ollama_model()}",
        "embeddings": get_embedding_model_name(),
    }


@app.post("/seed")
async def seed_data(
    payload: SeedingRequest,
    _: None = Depends(require_write_api_key),
):
    """Index reference content into the vector memory store."""
    _ensure_ready()
    _validate_code_size(payload.content)
    db.insert_reference(payload.content, payload.category, payload.language)
    return {"message": "Data indexed accurately."}


def _format_repair_seed_content(payload: SeedRepairRequest) -> str:
    """Build retrieval-friendly text from a verified validation repair."""
    error_lines = [
        f"- [{entry.rule or 'unknown'}] {entry.file or 'n/a'}: {entry.message}"
        for entry in payload.errors
    ]
    return "\n".join(
        [
            f"Objective: {payload.objective}",
            f"Profile: {payload.profile}",
            "Errors:",
            *error_lines,
            f"Resolution: {payload.resolution}",
        ]
    )


@app.post("/seed-repair")
async def seed_repair_pattern(
    payload: SeedRepairRequest,
    _: None = Depends(require_write_api_key),
):
    """Index a validation repair pattern after a verified heal (SOUL §6)."""
    _ensure_ready()
    content = _format_repair_seed_content(payload)
    _validate_code_size(content)
    db.insert_reference(content, "Validation Repair Pattern", "All")
    return {"message": "Repair pattern indexed accurately."}


@app.post("/query/context")
async def query_context_only(payload: QueryContextRequest):
    """Retrieve context slices only — no LLM call (Janus token-efficient path)."""
    _ensure_ready()
    slices = db.query_context_slices(
        payload.query,
        limit=max(1, min(payload.limit, 10)),
        max_chars=max(256, min(payload.max_chars, 32000)),
    )
    return {
        "slices": slices,
        "total_chars": sum(len(slice_text) for slice_text in slices),
    }


@app.post("/query")
async def smart_query(payload: QueryRequest):
    """Retrieve relevant context and generate an implementation-focused answer."""
    _ensure_ready()
    context = db.query_context(payload.query)
    prompt = f"""
    Use this library reference data to formulate a sharp answer:
    {context}

    User Query: {payload.query}
    Provide clean, ready-to-run implementations.
    """
    response = llm.invoke(prompt)
    return {"response": response.content, "referenced_context": context}


@app.get("/doctrine/status")
async def doctrine_status(content_hash: str):
    """Check whether SOUL.md content hash is present in Operational Doctrine memory."""
    _ensure_ready()
    stored_hashes = db.content_hashes_for_category("Operational Doctrine")
    return {
        "fresh": content_hash in stored_hashes,
        "content_hash": content_hash,
        "stored_count": len(stored_hashes),
    }


@app.post("/execute-heal")
async def run_and_heal(
    payload: CodeRunRequest,
    _: None = Depends(require_write_api_key),
):
    """Execute Python code in the self-healing sandbox."""
    _ensure_ready()
    _validate_code_size(payload.code)
    execution_report = sandbox.heal_and_verify(payload.code)
    return {"report": execution_report}


@app.post("/maintenance/deduplicate")
async def deduplicate_vectors(
    dry_run: bool = True,
    threshold: float = 0.95,
    _: None = Depends(require_write_api_key),
):
    """Remove exact and near-duplicate documents from the vector store."""
    _ensure_ready()
    return db.deduplicate(similarity_threshold=threshold, dry_run=dry_run)