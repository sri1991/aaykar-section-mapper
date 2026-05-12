"""ITR-1 extraction. Delegates to the configured LLMProvider with a Pydantic schema."""

from __future__ import annotations

from ..llm.provider import LLMProvider
from ..schemas import AssessmentYear, ITR1


_PROMPT = """You are an Indian tax document extractor.

You will be given the full text of an ITR-1 (Sahaj) return PDF. Extract the
fields into the provided JSON schema.

Rules:
- Money values must be plain decimal numbers (no commas, no currency symbol).
- If a field is not present in the document, use null. DO NOT invent values.
- Mask the PAN to keep only the last 4 visible characters, e.g. "XXXXX1234X".
- For the regime, use "old" or "new" based on what's declared in Schedule TI / "Tax Regime Opted".
- Total fields (total_80c, total_80d) must be the sum reported in the return,
  not your own re-computation.
"""


def extract_itr1(
    *,
    provider: LLMProvider,
    pdf_text: str,
    assessment_year: AssessmentYear,
) -> ITR1:
    result = provider.extract(prompt=_PROMPT, schema=ITR1, pdf_text=pdf_text)
    # AY is detected deterministically upstream; trust it over the LLM's choice.
    return result.model_copy(update={"assessment_year": assessment_year})
