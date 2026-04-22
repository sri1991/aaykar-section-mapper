export type BusinessType = 'sole_proprietor' | 'partnership' | 'pvt_ltd' | 'llp' | 'other'
export type Headcount = 'none' | 'small' | 'medium' | 'large'
export type DeductionType = '80C' | '80D' | 'HRA' | 'LTA' | 'NPS' | 'other'
export type TaxRegime = 'old' | 'new' | 'mixed' | 'na'

export interface GapAuditAnswers {
  businessType: BusinessType | null
  headcount: Headcount | null
  filesTDS: boolean | null
  deductions: DeductionType[]
  foreignIncome: boolean | null
  taxRegime: TaxRegime | null
}

export interface GapItem {
  id: string
  title: string
  description: string
  action: string
  severity: 'high' | 'medium' | 'low'
  source: string
  new_ref?: string
}

export function generateGapChecklist(answers: GapAuditAnswers): GapItem[] {
  const gaps: GapItem[] = []
  const hasEmployees = answers.headcount !== 'none'

  if (hasEmployees && answers.filesTDS === false) {
    gaps.push({
      id: 'tds-not-filed',
      title: 'TDS returns not being filed — mandatory with employees',
      description:
        'You have employees but are not filing TDS returns. This is a compliance requirement under Section 393 (IT Act 2025) / Section 192 (old Act). Penalties under Section 234E apply for every day of default.',
      action:
        'Register for TAN if not yet done. File Form 24Q quarterly for salary TDS. Engage a CA to file outstanding returns and assess penalty exposure under Section 234E.',
      severity: 'high',
      source:
        'Section 393, IT Act 2025 (old: Section 192) · Rule 30, IT Rules 1962 · Section 234E, IT Act',
      new_ref: 'Section 393',
    })
  }

  gaps.push({
    id: 'section-ref-update',
    title: 'All tax documents must reference new section numbers from Tax Year 2026-27',
    description:
      'Every salary structure, audit report, agreement, and ITR draft that cites old sections (80C, 194C, Form 16, etc.) carries stale references. The IT Act 2025 is in force from April 1, 2026.',
    action:
      'Use the Document Scanner tab to upload and auto-flag stale references. Re-issue any client-facing documents that reference old sections before filing.',
    severity: 'medium',
    source:
      'Income Tax Act 2025, effective Tax Year 2026-27 · CBDT Press Release, Feb 2025 · CBDT concordance table',
  })

  if (hasEmployees && answers.taxRegime === 'old') {
    gaps.push({
      id: 'old-regime-deductions',
      title: 'Old tax regime — verify all deductions carry the correct new section numbers',
      description:
        'Old regime deductions (80C, 80D, HRA, etc.) are retained in the IT Act 2025 under new section numbers. Salary structures and Form 16 must use updated references or deductions may be disallowed during assessment.',
      action:
        'Cross-check each deduction being claimed against the new Act using the Section Mapper. Update payroll software and Form 16 templates before the first TDS deduction of Tax Year 2026-27.',
      severity: 'medium',
      source:
        'CBDT Circular No. 4/2023 · Finance Act 2023 · IT Act 2025 concordance — Chapter VI-A equivalent',
      new_ref: 'Chapter VI-A equivalent sections',
    })
  }

  if (
    answers.taxRegime === 'new' &&
    answers.deductions.some(d => ['80C', '80D', 'HRA', 'LTA'].includes(d))
  ) {
    gaps.push({
      id: 'new-regime-deductions-clash',
      title: '80C / 80D / HRA / LTA cannot be claimed under the new tax regime',
      description:
        'These deductions are unavailable to employees who have opted for the new regime (Section 202, IT Act 2025). Continuing to claim them will result in disallowance during assessment and potential interest liability.',
      action:
        'Audit payroll deductions for all new-regime employees. Remove ineligible deductions from Form 16. Collect signed regime-choice declarations from each employee at the start of the tax year.',
      severity: 'high',
      source:
        'Section 202, IT Act 2025 (old: Section 115BAC) · CBDT Circular No. 4/2023 on employer TDS obligations',
      new_ref: 'Section 202',
    })
  }

  if (answers.deductions.includes('80C')) {
    gaps.push({
      id: '80c-section-update',
      title: 'Section 80C references are stale — update investment declarations and Form 16',
      description:
        'Section 80C (₹1.5 lakh deduction for ELSS, LIC, PPF, home loan principal, etc.) is renumbered in the IT Act 2025. Old references in salary slips, investment proofs, and Form 16 are invalid for Tax Year 2026-27.',
      action:
        'Update all investment declaration forms, payroll templates, and Form 16 to the new section number. Use the Section Mapper to confirm the correct reference before issuing.',
      severity: 'medium',
      source:
        'IT Act 2025 CBDT concordance table · Finance Act 2024 · Section 80C, IT Act 1961',
    })
  }

  if (answers.deductions.includes('NPS')) {
    gaps.push({
      id: 'nps-employer-contribution',
      title: "NPS employer contribution — one of few deductions available in both regimes, verify new reference",
      description:
        "Employer NPS contribution (old: Section 80CCD(2)) is available even under the new regime — a key benefit to communicate to employees. However, the section reference has changed and payroll/Form 16 must reflect the new number.",
      action:
        'Confirm employer NPS contribution stays within 10% of basic salary. Update Form 16 and payroll records to cite the new section. Inform employees that this deduction is regime-agnostic.',
      severity: 'low',
      source:
        'Section 80CCD(2), IT Act 1961 → IT Act 2025 concordance · PFRDA circular on NPS employer contribution',
    })
  }

  if (answers.foreignIncome) {
    gaps.push({
      id: 'foreign-assets-schedule-fa',
      title: 'Foreign income or assets — Schedule FA and Schedule FSI are mandatory',
      description:
        'Failure to disclose foreign assets in ITR Schedule FA attracts a flat ₹10 lakh penalty under the Black Money Act, regardless of tax due. DTAA benefits require a valid Tax Residency Certificate from the foreign country.',
      action:
        'Compile a complete list of foreign assets (bank accounts, investments, property, ESOPs, crypto held abroad). Obtain TRC from the foreign country if claiming DTAA relief under Section 150 (new Act). File by the ITR due date — no extension is available for Schedule FA.',
      severity: 'high',
      source:
        'Section 150, IT Act 2025 (old: Section 90) · Black Money Act 2015, Section 42 · Rule 112DA, IT Rules',
      new_ref: 'Section 150',
    })
  }

  if (answers.businessType === 'pvt_ltd' || answers.businessType === 'llp') {
    gaps.push({
      id: 'tax-audit',
      title: 'Tax audit report (Form 3CD) must reference IT Act 2025 section numbers',
      description:
        'Tax audit is mandatory above ₹1 crore turnover (business) or ₹50 lakh receipts (profession). Form 3CD contains dozens of section references — all need updating for FY 2026-27. Using old references may result in a defective return notice.',
      action:
        'Brief your auditor now — do not wait for year end. ICAI is expected to issue a revised Form 3CD checklist. Confirm your auditor has the updated guidance before sign-off.',
      severity: 'high',
      source:
        'Section 58A, IT Act 2025 (old: Section 44AB) · ICAI Guidance Note on Tax Audit · CBDT circular on audit form updates',
      new_ref: 'Section 58A',
    })
  }

  if (answers.businessType === 'partnership' || answers.businessType === 'llp') {
    gaps.push({
      id: 'partnership-deed-update',
      title: 'Partnership / LLP deed likely cites stale IT Act sections — update required',
      description:
        'Partner remuneration limits and interest on capital are governed by Section 64 (new Act) / Section 40(b) (old Act). A deed citing the old section is not invalid, but creates ambiguity in assessment. New deeds should use the 2025 references.',
      action:
        'Review the deed for any IT Act section references. For new deeds or amendments, cite Section 64. For existing deeds, a board resolution acknowledging the renumbering is adequate for most firms — confirm with your CA.',
      severity: 'medium',
      source:
        'Section 64, IT Act 2025 (old: Section 40(b)) · IT Act 2025 concordance · CBDT FAQ on transition',
      new_ref: 'Section 64',
    })
  }

  if (answers.businessType === 'pvt_ltd') {
    gaps.push({
      id: 'mat-applicability',
      title: 'MAT working papers and advance tax must cite Section 211, not Section 115JB',
      description:
        'Minimum Alternate Tax (15% of book profit) is now under Section 211 of the IT Act 2025. Board minutes, auditor certifications, advance tax workings, and MAT credit schedules citing 115JB are stale.',
      action:
        'Update all MAT computation worksheets, advance tax schedules, and audit documentation to Section 211. Verify MAT credit carryforward is correctly captured — the credit entitlement provisions are also renumbered.',
      severity: 'medium',
      source:
        'Section 211, IT Act 2025 (old: Section 115JB) · CBDT concordance · ICAI guidance on MAT',
      new_ref: 'Section 211',
    })
  }

  if (answers.headcount === 'large') {
    gaps.push({
      id: 'large-employer-compliance',
      title: '50+ employees — confirm EPF, ESIC, and professional tax are current for FY 2026-27',
      description:
        'EPF and ESIC are mandatory for establishments with 20+ and 10+ employees respectively. With 50+ employees, all three (EPF, ESIC, and state professional tax) are very likely mandatory. Defaults attract interest at 12–18% p.a. plus damages.',
      action:
        'Confirm PF and ESIC registrations are active. File monthly ECR (Electronic Challan cum Return) within 15 days of month end. Verify professional tax slab for your state for FY 2026-27 — several states revise slabs annually.',
      severity: 'medium',
      source:
        'EPF & MP Act 1952 · ESI Act 1948, Section 2(12) · EPFO circular on ECR filing · State Professional Tax Acts',
    })
  }

  const order = { high: 0, medium: 1, low: 2 }
  gaps.sort((a, b) => order[a.severity] - order[b.severity])
  return gaps.slice(0, 10)
}
