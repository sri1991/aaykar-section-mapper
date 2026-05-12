"""Pydantic v2 schemas for the ITR Insights pipeline.

Money is `Decimal`. Everything sourced from extraction is `Optional` — the LLM
may legitimately fail to find a field, and the analyzers must handle `None`
without crashing.
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


Money = Decimal


class FormType(str, Enum):
    ITR1 = "ITR-1"
    ITR2 = "ITR-2"


class AssessmentYear(str, Enum):
    AY_2024_25 = "AY 2024-25"
    AY_2025_26 = "AY 2025-26"


class Regime(str, Enum):
    OLD = "old"
    NEW = "new"


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=False)


# ---------- Common sub-schemas ----------


class Taxpayer(_Base):
    name: Optional[str] = None
    pan_masked: Optional[str] = Field(
        default=None,
        description="PAN with all but last 4 chars masked, e.g. 'XXXXX1234X'.",
    )


class SalaryBreakup(_Base):
    gross_salary: Optional[Money] = None
    exempt_allowances: Optional[Money] = None
    standard_deduction: Optional[Money] = None
    professional_tax: Optional[Money] = None
    net_salary: Optional[Money] = None
    hra_received: Optional[Money] = None
    hra_exempt: Optional[Money] = None


class HouseProperty(_Base):
    annual_value: Optional[Money] = None
    interest_on_borrowed_capital: Optional[Money] = None
    net_income: Optional[Money] = None
    is_self_occupied: Optional[bool] = None


class Deductions80C(_Base):
    """Chapter VI-A 80C and related (80CCC, 80CCD(1))."""

    epf: Optional[Money] = None
    ppf: Optional[Money] = None
    elss: Optional[Money] = None
    life_insurance_premium: Optional[Money] = None
    home_loan_principal: Optional[Money] = None
    tuition_fees: Optional[Money] = None
    nsc: Optional[Money] = None
    tax_saver_fd: Optional[Money] = None
    sukanya_samriddhi: Optional[Money] = None
    other_80c: Optional[Money] = None
    total_80c: Optional[Money] = None


class Deductions80D(_Base):
    self_family_premium: Optional[Money] = None
    parents_premium: Optional[Money] = None
    senior_citizen_parents: Optional[bool] = None
    preventive_health_checkup: Optional[Money] = None
    total_80d: Optional[Money] = None


class OtherDeductions(_Base):
    section_80ccd_1b: Optional[Money] = Field(default=None, description="NPS additional 50k")
    section_80ccd_2: Optional[Money] = Field(default=None, description="Employer NPS contribution")
    section_80e: Optional[Money] = Field(default=None, description="Education loan interest")
    section_80g: Optional[Money] = Field(default=None, description="Donations")
    section_80tta: Optional[Money] = Field(default=None, description="Savings interest")
    section_80ttb: Optional[Money] = Field(default=None, description="Senior savings interest")
    section_80eea: Optional[Money] = None
    section_80eeb: Optional[Money] = None


class TaxComputation(_Base):
    gross_total_income: Optional[Money] = None
    total_deductions: Optional[Money] = None
    total_taxable_income: Optional[Money] = None
    tax_on_taxable_income: Optional[Money] = None
    rebate_87a: Optional[Money] = None
    surcharge: Optional[Money] = None
    cess: Optional[Money] = None
    total_tax: Optional[Money] = None
    tds: Optional[Money] = None
    advance_tax: Optional[Money] = None
    self_assessment_tax: Optional[Money] = None
    refund_or_payable: Optional[Money] = None


# ---------- ITR-1 ----------


class ITR1(_Base):
    form_type: Literal[FormType.ITR1] = FormType.ITR1
    assessment_year: AssessmentYear
    regime: Optional[Regime] = None

    taxpayer: Taxpayer = Field(default_factory=Taxpayer)
    salary: SalaryBreakup = Field(default_factory=SalaryBreakup)
    house_property: HouseProperty = Field(default_factory=HouseProperty)
    income_from_other_sources: Optional[Money] = None

    deductions_80c: Deductions80C = Field(default_factory=Deductions80C)
    deductions_80d: Deductions80D = Field(default_factory=Deductions80D)
    other_deductions: OtherDeductions = Field(default_factory=OtherDeductions)

    tax_computation: TaxComputation = Field(default_factory=TaxComputation)


# ---------- ITR-2 ----------


class CapitalGains(_Base):
    short_term_listed_equity: Optional[Money] = None  # Sec 111A
    long_term_listed_equity: Optional[Money] = None  # Sec 112A
    short_term_other: Optional[Money] = None
    long_term_other: Optional[Money] = None  # Sec 112
    total_capital_gains: Optional[Money] = None


class ITR2(_Base):
    form_type: Literal[FormType.ITR2] = FormType.ITR2
    assessment_year: AssessmentYear
    regime: Optional[Regime] = None

    taxpayer: Taxpayer = Field(default_factory=Taxpayer)
    salary: SalaryBreakup = Field(default_factory=SalaryBreakup)
    house_property: HouseProperty = Field(default_factory=HouseProperty)
    capital_gains: CapitalGains = Field(default_factory=CapitalGains)
    income_from_other_sources: Optional[Money] = None

    deductions_80c: Deductions80C = Field(default_factory=Deductions80C)
    deductions_80d: Deductions80D = Field(default_factory=Deductions80D)
    other_deductions: OtherDeductions = Field(default_factory=OtherDeductions)

    tax_computation: TaxComputation = Field(default_factory=TaxComputation)


StructuredITR = ITR1 | ITR2


# ---------- Computed insights (pure data, deterministic) ----------


class DeductionGap(_Base):
    section: str
    limit: Money
    used: Money
    gap: Money
    explanation: str  # Static template string — no LLM, no numbers from LLM.


class AnomalyFlag(_Base):
    code: str  # machine-readable identifier, e.g. "GTI_MISMATCH"
    severity: Literal["info", "warn", "error"]
    message: str  # static template
    fields: list[str] = Field(default_factory=list)


class ComputedInsights(_Base):
    """Deterministic output of the analysis stage. No LLM touches this."""

    form_type: FormType
    assessment_year: AssessmentYear
    regime: Optional[Regime] = None

    gross_total_income: Optional[Money] = None
    total_deductions_used: Optional[Money] = None
    total_taxable_income: Optional[Money] = None
    total_tax: Optional[Money] = None

    deduction_gaps: list[DeductionGap] = Field(default_factory=list)
    anomalies: list[AnomalyFlag] = Field(default_factory=list)


class NarratedInsights(_Base):
    """Insights wrapped with an LLM-generated prose summary."""

    computed: ComputedInsights
    narrative: str
