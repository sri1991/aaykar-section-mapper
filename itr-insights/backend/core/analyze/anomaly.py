"""AnomalyDetector. Pure Python. Internal-consistency checks only — no LLM.

Each rule emits a stable `code` so the UI can render explanations and the
narrator can reference flags without producing new numbers.
"""

from __future__ import annotations

from decimal import Decimal

from ..schemas import AnomalyFlag, Regime, StructuredITR

_ZERO = Decimal("0")
_TOLERANCE = Decimal("10")  # Tax PDFs sometimes round to nearest rupee.


def _z(x: Decimal | None) -> Decimal:
    return x if x is not None else _ZERO


def detect_anomalies(itr: StructuredITR) -> list[AnomalyFlag]:
    flags: list[AnomalyFlag] = []

    tc = itr.tax_computation

    # 1. Total = tax_on_taxable_income + surcharge + cess - rebate_87a, within tolerance.
    if (
        tc.total_tax is not None
        and tc.tax_on_taxable_income is not None
    ):
        expected = (
            _z(tc.tax_on_taxable_income)
            + _z(tc.surcharge)
            + _z(tc.cess)
            - _z(tc.rebate_87a)
        )
        if abs(expected - tc.total_tax) > _TOLERANCE:
            flags.append(
                AnomalyFlag(
                    code="TOTAL_TAX_MISMATCH",
                    severity="warn",
                    message=(
                        "Total tax shown in the return does not match "
                        "tax_on_taxable_income + surcharge + cess − rebate_87a."
                    ),
                    fields=[
                        "tax_computation.total_tax",
                        "tax_computation.tax_on_taxable_income",
                        "tax_computation.surcharge",
                        "tax_computation.cess",
                        "tax_computation.rebate_87a",
                    ],
                )
            )

    # 2. Taxable income = GTI − total deductions, within tolerance.
    if (
        tc.total_taxable_income is not None
        and tc.gross_total_income is not None
    ):
        expected = _z(tc.gross_total_income) - _z(tc.total_deductions)
        if abs(expected - tc.total_taxable_income) > _TOLERANCE:
            flags.append(
                AnomalyFlag(
                    code="TAXABLE_INCOME_MISMATCH",
                    severity="warn",
                    message=(
                        "Taxable income does not equal gross_total_income − "
                        "total_deductions."
                    ),
                    fields=[
                        "tax_computation.total_taxable_income",
                        "tax_computation.gross_total_income",
                        "tax_computation.total_deductions",
                    ],
                )
            )

    # 3. New regime but deductions claimed.
    if itr.regime == Regime.NEW:
        chapter_via = (
            _z(itr.deductions_80c.total_80c)
            + _z(itr.deductions_80d.total_80d)
            + _z(itr.other_deductions.section_80ccd_1b)
            + _z(itr.other_deductions.section_80e)
            + _z(itr.other_deductions.section_80g)
        )
        if chapter_via > _ZERO:
            flags.append(
                AnomalyFlag(
                    code="NEW_REGIME_CHAPTER_VIA",
                    severity="error",
                    message=(
                        "New regime selected but Chapter VI-A deductions are "
                        "non-zero. Most VI-A deductions are disallowed under "
                        "the new regime."
                    ),
                    fields=["regime", "deductions_80c", "deductions_80d", "other_deductions"],
                )
            )

    # 4. HRA exempt > HRA received.
    sal = itr.salary
    if (
        sal.hra_received is not None
        and sal.hra_exempt is not None
        and sal.hra_exempt > sal.hra_received + _TOLERANCE
    ):
        flags.append(
            AnomalyFlag(
                code="HRA_EXEMPT_EXCEEDS_RECEIVED",
                severity="error",
                message="Exempt HRA exceeds HRA received.",
                fields=["salary.hra_received", "salary.hra_exempt"],
            )
        )

    # 5. Self-occupied house property interest deduction caps at Rs 2,00,000.
    hp = itr.house_property
    if (
        hp.is_self_occupied
        and hp.interest_on_borrowed_capital is not None
        and hp.interest_on_borrowed_capital > Decimal("200000") + _TOLERANCE
    ):
        flags.append(
            AnomalyFlag(
                code="SOP_INTEREST_OVER_CAP",
                severity="warn",
                message=(
                    "Self-occupied house property interest claimed exceeds the "
                    "Rs 2,00,000 cap under section 24(b)."
                ),
                fields=["house_property.interest_on_borrowed_capital"],
            )
        )

    return flags
