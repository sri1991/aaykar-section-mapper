"""DeductionGapAnalyzer.

Pure Python. Identical input → byte-identical output. Tested by hashing.
Only the old regime can claim these deductions; under the new regime we emit
a single info anomaly and skip gap computation.
"""

from __future__ import annotations

from decimal import Decimal

from ..schemas import (
    Deductions80C,
    Deductions80D,
    DeductionGap,
    OtherDeductions,
    Regime,
    StructuredITR,
)
from . import limits as L


_ZERO = Decimal("0")


def _z(x: Decimal | None) -> Decimal:
    return x if x is not None else _ZERO


def _80c_used(d: Deductions80C) -> Decimal:
    if d.total_80c is not None:
        return d.total_80c
    parts = [
        d.epf,
        d.ppf,
        d.elss,
        d.life_insurance_premium,
        d.home_loan_principal,
        d.tuition_fees,
        d.nsc,
        d.tax_saver_fd,
        d.sukanya_samriddhi,
        d.other_80c,
    ]
    return sum((_z(p) for p in parts), start=_ZERO)


def _80d_limit(d: Deductions80D) -> Decimal:
    self_family = L.LIMIT_80D_SELF_FAMILY  # senior-self detection out of scope MVP1.
    parents = (
        L.LIMIT_80D_PARENTS_SENIOR
        if d.senior_citizen_parents
        else L.LIMIT_80D_PARENTS
    )
    return self_family + parents + L.LIMIT_80D_PREVENTIVE


def _80d_used(d: Deductions80D) -> Decimal:
    if d.total_80d is not None:
        return d.total_80d
    return _z(d.self_family_premium) + _z(d.parents_premium) + _z(d.preventive_health_checkup)


def compute_gaps(itr: StructuredITR) -> list[DeductionGap]:
    """Return per-section gaps. Empty list under the new regime."""
    if itr.regime == Regime.NEW:
        return []

    gaps: list[DeductionGap] = []

    used_80c = _80c_used(itr.deductions_80c)
    gap_80c = max(L.LIMIT_80C - used_80c, _ZERO)
    gaps.append(
        DeductionGap(
            section="80C",
            limit=L.LIMIT_80C,
            used=used_80c,
            gap=gap_80c,
            explanation=(
                "Section 80C allows up to Rs 1,50,000 across EPF/PPF/ELSS/LIC/"
                "home-loan principal/tuition fees and similar. Increasing this "
                "to the cap reduces taxable income in the old regime."
            ),
        )
    )

    used_80ccd_1b = _z(itr.other_deductions.section_80ccd_1b)
    gap_80ccd_1b = max(L.LIMIT_80CCD_1B - used_80ccd_1b, _ZERO)
    gaps.append(
        DeductionGap(
            section="80CCD(1B)",
            limit=L.LIMIT_80CCD_1B,
            used=used_80ccd_1b,
            gap=gap_80ccd_1b,
            explanation=(
                "Section 80CCD(1B) allows an additional Rs 50,000 of NPS "
                "contribution over and above the 80C cap."
            ),
        )
    )

    limit_80d = _80d_limit(itr.deductions_80d)
    used_80d = _80d_used(itr.deductions_80d)
    gap_80d = max(limit_80d - used_80d, _ZERO)
    gaps.append(
        DeductionGap(
            section="80D",
            limit=limit_80d,
            used=used_80d,
            gap=gap_80d,
            explanation=(
                "Section 80D covers health insurance premium for self/family "
                "and parents, plus up to Rs 5,000 of preventive health check-up."
            ),
        )
    )

    return gaps
