"""Compose ComputedInsights from a StructuredITR. Pure, deterministic."""

from __future__ import annotations

from ..schemas import ComputedInsights, StructuredITR
from .anomaly import detect_anomalies
from .deduction_gap import compute_gaps


def compute_insights(itr: StructuredITR) -> ComputedInsights:
    return ComputedInsights(
        form_type=itr.form_type,
        assessment_year=itr.assessment_year,
        regime=itr.regime,
        gross_total_income=itr.tax_computation.gross_total_income,
        total_deductions_used=itr.tax_computation.total_deductions,
        total_taxable_income=itr.tax_computation.total_taxable_income,
        total_tax=itr.tax_computation.total_tax,
        deduction_gaps=compute_gaps(itr),
        anomalies=detect_anomalies(itr),
    )
