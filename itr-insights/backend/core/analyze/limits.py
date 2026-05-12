"""Statutory limits per assessment year.

Only AY 2024-25 and AY 2025-26 are supported (D3). Both retain the same
Chapter VI-A limits under the old regime, which is the only regime in which
these deductions are usable. The new regime disallows most of them, so the
analyzer reports "regime mismatch" rather than fabricating a gap.
"""

from __future__ import annotations

from decimal import Decimal

from ..schemas import AssessmentYear

LIMIT_80C = Decimal("150000")
LIMIT_80CCD_1B = Decimal("50000")  # NPS additional, on top of 80C.
LIMIT_80D_SELF_FAMILY = Decimal("25000")
LIMIT_80D_SELF_FAMILY_SENIOR = Decimal("50000")
LIMIT_80D_PARENTS = Decimal("25000")
LIMIT_80D_PARENTS_SENIOR = Decimal("50000")
LIMIT_80D_PREVENTIVE = Decimal("5000")
LIMIT_80TTA = Decimal("10000")
LIMIT_80TTB = Decimal("50000")
LIMIT_HOME_LOAN_INTEREST_SOP = Decimal("200000")  # 24(b) self-occupied.


def limits_for(_ay: AssessmentYear) -> None:
    """Currently identical across both supported AYs. Kept as a hook."""
    return None
