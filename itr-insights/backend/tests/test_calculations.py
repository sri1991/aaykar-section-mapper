"""Pure-Python analyzer tests. These guard the determinism boundary.

If these fail, the analyzer is not byte-stable or a statutory limit changed
without updating the tests.
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal

from core.analyze.insights import compute_insights
from core.schemas import (
    AssessmentYear,
    Deductions80C,
    Deductions80D,
    ITR1,
    OtherDeductions,
    Regime,
    TaxComputation,
)


def _sample_itr1() -> ITR1:
    return ITR1(
        assessment_year=AssessmentYear.AY_2024_25,
        regime=Regime.OLD,
        deductions_80c=Deductions80C(total_80c=Decimal("100000")),
        deductions_80d=Deductions80D(
            self_family_premium=Decimal("15000"),
            parents_premium=Decimal("0"),
            preventive_health_checkup=Decimal("0"),
            senior_citizen_parents=False,
            total_80d=Decimal("15000"),
        ),
        other_deductions=OtherDeductions(section_80ccd_1b=Decimal("20000")),
        tax_computation=TaxComputation(
            gross_total_income=Decimal("1000000"),
            total_deductions=Decimal("135000"),
            total_taxable_income=Decimal("865000"),
            tax_on_taxable_income=Decimal("85500"),
            cess=Decimal("3420"),
            total_tax=Decimal("88920"),
        ),
    )


def test_80c_gap():
    ins = compute_insights(_sample_itr1())
    gap_80c = next(g for g in ins.deduction_gaps if g.section == "80C")
    assert gap_80c.limit == Decimal("150000")
    assert gap_80c.used == Decimal("100000")
    assert gap_80c.gap == Decimal("50000")


def test_80ccd1b_gap():
    ins = compute_insights(_sample_itr1())
    g = next(g for g in ins.deduction_gaps if g.section == "80CCD(1B)")
    assert g.limit == Decimal("50000")
    assert g.used == Decimal("20000")
    assert g.gap == Decimal("30000")


def test_new_regime_skips_gaps():
    itr = _sample_itr1().model_copy(update={"regime": Regime.NEW})
    ins = compute_insights(itr)
    assert ins.deduction_gaps == []


def test_anomaly_total_tax_consistent():
    ins = compute_insights(_sample_itr1())
    # 85500 + 3420 - 0 = 88920 → no mismatch
    assert all(a.code != "TOTAL_TAX_MISMATCH" for a in ins.anomalies)


def test_anomaly_taxable_income_mismatch_detected():
    bad = _sample_itr1()
    bad.tax_computation.total_taxable_income = Decimal("900000")  # GTI - deductions = 865000
    ins = compute_insights(bad)
    assert any(a.code == "TAXABLE_INCOME_MISMATCH" for a in ins.anomalies)


def test_anomaly_new_regime_via_deductions():
    itr = _sample_itr1().model_copy(update={"regime": Regime.NEW})
    ins = compute_insights(itr)
    assert any(a.code == "NEW_REGIME_CHAPTER_VIA" for a in ins.anomalies)


def test_byte_identical_output_for_identical_input():
    """D5 guarantee #2: identical StructuredITR → byte-identical ComputedInsights."""
    a = compute_insights(_sample_itr1()).model_dump_json()
    b = compute_insights(_sample_itr1()).model_dump_json()
    assert a == b
    digest_a = hashlib.sha256(a.encode()).hexdigest()
    digest_b = hashlib.sha256(b.encode()).hexdigest()
    assert digest_a == digest_b
