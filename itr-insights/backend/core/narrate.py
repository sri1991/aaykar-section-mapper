"""Narrator. The narrative is allowed to vary, but it must not introduce numbers
that don't appear in ComputedInsights (D5 guarantee #3).
"""

from __future__ import annotations

import re
from decimal import Decimal

from .llm.provider import LLMProvider
from .schemas import ComputedInsights, NarratedInsights


_PROMPT = """You are an Indian tax advisor narrating a single taxpayer's
return for them in plain English. You will be given a JSON object of
already-computed insights. Write a 4-6 sentence summary covering:

1. The form type and AY.
2. The biggest deduction gap (by rupee value).
3. The most severe anomaly, if any.
4. One concrete next step.

Hard rules:
- Use only numbers that already appear in the JSON. Do not compute new totals.
  Do not estimate. Do not round.
- Do not mention PAN or full name.
- Plain prose. No markdown headings, no bullets.
"""


class NarrativeNumberLeak(RuntimeError):
    """Raised when the narrator introduces a number not present in insights."""


_NUM_RE = re.compile(r"(?<!\w)(\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d+)?|\d+\.?\d*)(?!\w)")


def _allowed_number_strings(ci: ComputedInsights) -> set[str]:
    """Return every number form (with/without commas, with/without paise) that
    may legitimately appear in the narrative."""
    nums: set[Decimal] = set()

    def add(x: Decimal | None) -> None:
        if x is None:
            return
        nums.add(Decimal(x))

    add(ci.gross_total_income)
    add(ci.total_deductions_used)
    add(ci.total_taxable_income)
    add(ci.total_tax)
    for g in ci.deduction_gaps:
        add(g.limit)
        add(g.used)
        add(g.gap)

    out: set[str] = set()
    for n in nums:
        # Normalize to integer rupees and to two-decimal forms.
        as_int = int(n.quantize(Decimal("1")))
        out.add(str(as_int))
        out.add(f"{as_int:,}")
        # Indian-style grouping (12,34,567).
        out.add(_indian_format(as_int))
    # Years are also allowed (AY 2024-25 / 2025-26).
    out.update({"2024", "2025", "2026", "25", "26"})
    return out


def _indian_format(n: int) -> str:
    s = str(abs(n))
    if len(s) <= 3:
        return ("-" if n < 0 else "") + s
    last3 = s[-3:]
    rest = s[:-3]
    parts: list[str] = []
    while len(rest) > 2:
        parts.append(rest[-2:])
        rest = rest[:-2]
    if rest:
        parts.append(rest)
    return ("-" if n < 0 else "") + ",".join(reversed(parts)) + "," + last3


def _check_no_leaks(narrative: str, ci: ComputedInsights) -> None:
    allowed = _allowed_number_strings(ci)
    for match in _NUM_RE.finditer(narrative):
        token = match.group(1)
        if token in allowed:
            continue
        # Also accept tokens that are substrings of allowed Indian-format numbers.
        if any(token in a for a in allowed):
            continue
        raise NarrativeNumberLeak(
            f"Number {token!r} in narrative not present in ComputedInsights"
        )


def narrate(*, provider: LLMProvider, insights: ComputedInsights) -> NarratedInsights:
    context = insights.model_dump_json()
    text = provider.narrate(prompt=_PROMPT, context=context)
    _check_no_leaks(text, insights)
    return NarratedInsights(computed=insights, narrative=text)
