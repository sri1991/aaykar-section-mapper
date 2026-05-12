"""ITR-2 extraction. Stub for MVP1 — schema and extractor wired, not yet tuned."""

from __future__ import annotations

from ..llm.provider import LLMProvider
from ..schemas import AssessmentYear, ITR2


_PROMPT = """You are an Indian tax document extractor.

You will be given the full text of an ITR-2 return PDF. Extract the fields into
the provided JSON schema.

Rules:
- Money values must be plain decimal numbers (no commas, no currency symbol).
- If a field is not present in the document, use null. DO NOT invent values.
- Mask the PAN to keep only the last 4 visible characters, e.g. "XXXXX1234X".
- For the regime, use "old" or "new".
- Capital gains: report each bucket separately. Long-term listed equity is
  Sec 112A; short-term listed equity is Sec 111A.
- Total fields (total_80c, total_80d, total_capital_gains) must be the totals
  reported in the return, not your own re-computation.
"""


def extract_itr2(
    *,
    provider: LLMProvider,
    pdf_text: str,
    assessment_year: AssessmentYear,
) -> ITR2:
    result = provider.extract(prompt=_PROMPT, schema=ITR2, pdf_text=pdf_text)
    return result.model_copy(update={"assessment_year": assessment_year})
