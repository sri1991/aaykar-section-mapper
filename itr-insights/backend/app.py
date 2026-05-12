"""FastAPI entrypoint for ITR Insights.

POST /api/analyze accepts a single PDF, runs detection → extraction → analysis
→ narration, and returns NarratedInsights as JSON.

Per D10, nothing is persisted. The PDF lives in memory only for the duration
of the request.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from core import detector
from core.analyze.insights import compute_insights
from core.extract.itr1 import extract_itr1
from core.extract.itr2 import extract_itr2
from core.llm.factory import build_provider
from core.llm.provider import LLMProvider
from core.logging import configure_logging, get_logger
from core.narrate import NarrativeNumberLeak, narrate
from core.pdf import PDFTooLarge, PDFUnreadable, pdf_bytes_to_text
from core.schemas import FormType

load_dotenv()
configure_logging()
log = get_logger("app")

app = FastAPI(title="ITR Insights", version="0.1.0")

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


_provider: LLMProvider | None = None


def _get_provider() -> LLMProvider:
    global _provider
    if _provider is None:
        _provider = build_provider()
    return _provider


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)) -> Any:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        return _error("BAD_CONTENT_TYPE", "Upload a PDF file.", 400)

    data = await file.read()
    try:
        text = pdf_bytes_to_text(data)
    except PDFTooLarge as e:
        return _error("PDF_TOO_LARGE", str(e), 413)
    except PDFUnreadable as e:
        return _error("PDF_UNREADABLE", str(e), 400)

    try:
        detection = detector.detect(text)
    except detector.UnsupportedForm as e:
        return _error("UNSUPPORTED_FORM", str(e), 415)
    except detector.UnsupportedAY as e:
        return _error("UNSUPPORTED_AY", str(e), 415)

    provider = _get_provider()
    log.info(
        "analyze.detected",
        form=detection.form_type.value,
        ay=detection.assessment_year.value,
    )

    try:
        if detection.form_type is FormType.ITR1:
            structured = extract_itr1(
                provider=provider,
                pdf_text=text,
                assessment_year=detection.assessment_year,
            )
        else:
            structured = extract_itr2(
                provider=provider,
                pdf_text=text,
                assessment_year=detection.assessment_year,
            )
    except ValidationError as e:
        return _error("EXTRACTION_SCHEMA_INVALID", e.errors().__repr__(), 422)
    except Exception:
        log.exception("analyze.extract_failed")
        return _error("EXTRACTION_FAILED", "Could not extract fields.", 502)

    insights = compute_insights(structured)

    try:
        narrated = narrate(provider=provider, insights=insights)
    except NarrativeNumberLeak as e:
        log.warning("analyze.narrative_leak", reason=str(e))
        # Fail open: return computed insights with an empty narrative rather
        # than emit a narrative we know contains a fabricated number.
        narrated = None

    return JSONResponse(
        content={
            "computed": insights.model_dump(mode="json"),
            "narrative": narrated.narrative if narrated else None,
            "narrative_status": "ok" if narrated else "suppressed_number_leak",
        }
    )


# Serve static frontend from ../frontend if present.
_frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
