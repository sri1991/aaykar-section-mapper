"""FormDetector — picks ITR-1 vs ITR-2 from raw PDF text.

Deterministic, regex-only. The LLM is never asked which form this is.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .schemas import AssessmentYear, FormType


class UnsupportedForm(ValueError):
    pass


class UnsupportedAY(ValueError):
    pass


_ITR1_PATTERNS = [
    re.compile(r"\bITR[\s\-]*1\b", re.IGNORECASE),
    re.compile(r"\bSAHAJ\b", re.IGNORECASE),
]
_ITR2_PATTERNS = [
    re.compile(r"\bITR[\s\-]*2\b", re.IGNORECASE),
]
_ITR_OTHER_PATTERNS = [
    re.compile(r"\bITR[\s\-]*([3-7])\b", re.IGNORECASE),
    re.compile(r"\bSUGAM\b", re.IGNORECASE),  # ITR-4
]

_AY_PATTERNS: dict[AssessmentYear, list[re.Pattern[str]]] = {
    AssessmentYear.AY_2024_25: [re.compile(r"\b2024\s*[-–]\s*25\b")],
    AssessmentYear.AY_2025_26: [re.compile(r"\b2025\s*[-–]\s*26\b")],
}


@dataclass(frozen=True)
class DetectionResult:
    form_type: FormType
    assessment_year: AssessmentYear


def detect(pdf_text: str) -> DetectionResult:
    # Reject unsupported forms first (D1).
    for pat in _ITR_OTHER_PATTERNS:
        if pat.search(pdf_text):
            raise UnsupportedForm(
                "Only ITR-1 and ITR-2 are supported in this MVP."
            )

    is_itr1 = any(p.search(pdf_text) for p in _ITR1_PATTERNS)
    is_itr2 = any(p.search(pdf_text) for p in _ITR2_PATTERNS)
    if is_itr1 and not is_itr2:
        form = FormType.ITR1
    elif is_itr2 and not is_itr1:
        form = FormType.ITR2
    elif is_itr1 and is_itr2:
        # Both matched — bias toward the more specific one (ITR-2 since "ITR-1"
        # rarely appears inside an ITR-2 return; SAHAJ never does).
        form = FormType.ITR2 if not any(
            p.search(pdf_text) for p in _ITR1_PATTERNS if "SAHAJ" in p.pattern
        ) else FormType.ITR1
    else:
        raise UnsupportedForm(
            "Could not identify the ITR form. Upload the full return PDF "
            "(not the acknowledgment or Form 16)."
        )

    ay: AssessmentYear | None = None
    for candidate, patterns in _AY_PATTERNS.items():
        if any(p.search(pdf_text) for p in patterns):
            ay = candidate
            break
    if ay is None:
        raise UnsupportedAY(
            "Only AY 2024-25 and AY 2025-26 are supported in this MVP."
        )

    return DetectionResult(form_type=form, assessment_year=ay)
