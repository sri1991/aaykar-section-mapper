"""Narrator leak-guard tests. No live LLM is invoked."""

from __future__ import annotations

from decimal import Decimal

import pytest

from core.narrate import NarrativeNumberLeak, _check_no_leaks
from core.schemas import (
    AssessmentYear,
    ComputedInsights,
    DeductionGap,
    FormType,
    Regime,
)


def _ci() -> ComputedInsights:
    return ComputedInsights(
        form_type=FormType.ITR1,
        assessment_year=AssessmentYear.AY_2024_25,
        regime=Regime.OLD,
        gross_total_income=Decimal("1000000"),
        total_deductions_used=Decimal("135000"),
        total_taxable_income=Decimal("865000"),
        total_tax=Decimal("88920"),
        deduction_gaps=[
            DeductionGap(
                section="80C",
                limit=Decimal("150000"),
                used=Decimal("100000"),
                gap=Decimal("50000"),
                explanation="x",
            )
        ],
    )


def test_allows_numbers_from_insights():
    text = "GTI was 10,00,000 and tax came to 88,920. 80C gap is 50,000."
    _check_no_leaks(text, _ci())  # should not raise


def test_rejects_unknown_number():
    text = "You can save another 75,000 by topping up 80C."
    with pytest.raises(NarrativeNumberLeak):
        _check_no_leaks(text, _ci())


def test_allows_assessment_year_tokens():
    text = "For AY 2024-25 you owe 88,920."
    _check_no_leaks(text, _ci())
