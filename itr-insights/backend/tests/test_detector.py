"""FormDetector tests."""

from __future__ import annotations

import pytest

from core import detector
from core.schemas import AssessmentYear, FormType


def test_detects_itr1_sahaj_ay_2024_25():
    text = "INDIAN INCOME TAX RETURN SAHAJ for AY 2024-25"
    r = detector.detect(text)
    assert r.form_type is FormType.ITR1
    assert r.assessment_year is AssessmentYear.AY_2024_25


def test_detects_itr2_ay_2025_26():
    text = "INDIAN INCOME TAX RETURN ITR-2 Assessment Year 2025-26"
    r = detector.detect(text)
    assert r.form_type is FormType.ITR2
    assert r.assessment_year is AssessmentYear.AY_2025_26


def test_rejects_itr3():
    with pytest.raises(detector.UnsupportedForm):
        detector.detect("ITR-3 for 2024-25")


def test_rejects_unsupported_ay():
    with pytest.raises(detector.UnsupportedAY):
        detector.detect("ITR-1 SAHAJ AY 2023-24")
