# TaxBridge — MVP → V2 → V3 Roadmap

> What to build, in what order, and why

## The product in one line

A compliance workbench that helps Indian SMEs and CAs get their documents, terminology, and data gaps sorted for the Income Tax Act 2025 — in 15 minutes, not 15 hours.

---

## MVP — ship in 8 days

**3 tabs · static site · no backend · no auth**

---

### Tab 1 — Section & Form Mapper

**Days 1–3** · The foundation.

Fuzzy search over a static JSON dataset of 1961→2025 mappings. Works both directions. Covers top 100 sections + all TDS/TCS forms.

- Search by section number, name, or keyword — results in under 200ms (Fuse.js, client-side)
- Each result: old ref · new ref · change type badge (`renumbered` / `amended` / `merged` / `deleted`)
- Plain-English 2–3 line summary — what changed, not just the number. **This is the differentiator.**
- Forms sub-tab: 24Q→138, 26Q, 27Q, 27EQ and all equivalents
- Category filter pills: All / TDS-TCS / Deductions / Capital Gains / Business Income

> **Data is the work:** Day 1–2 is entirely building and validating the mapping JSON from CBDT utility

---

### Tab 2 — Document Scanner

**Days 3–5** · Features 1 + 2 combined into one upload flow.

Paste text or upload DOCX → get an annotated output with all old terminology and section references flagged and replaced.

- **Terminology sanitizer:** Finds "Assessment Year", "Previous Year", and ~20 deprecated terms → suggests "Tax Year" replacement. Flags ambiguous cases in orange rather than silently replacing.
- **Section auto-mapper:** Regex catches all variants (`80C`, `Sec 80C`, `u/s 80C`, `section 80-C`) → replaces with new section number, highlights in blue
- **Limit-change flag:** If the section had a monetary limit that changed, shows yellow warning: "Limit updated — verify amount"
- **Output:** annotated text view + summary panel (X terms replaced, Y sections remapped, Z warnings)
- Copy to clipboard or download as DOCX (Mammoth.js for read, docx.js for write)

> V1 inputs only: paste text + DOCX upload. PDF parsing is V2.

---

### Tab 3 — Gap Auditor (questionnaire mode)

**Days 5–7** · Rule-engine approach — no AI, no document parsing. 6 questions in, personalized gap checklist out. Fast to build, defensible, testable.

| # | Question | Options |
|---|----------|---------|
| Q1 | Business type | Sole proprietor / Partnership / Pvt Ltd / LLP / Other |
| Q2 | Employee headcount | 0 / 1–10 / 11–50 / 50+ |
| Q3 | Do you currently file TDS returns? | Yes / No |
| Q4 | Which deductions do you claim? | 80C, 80D, HRA, LTA, NPS, others (multi-select) |
| Q5 | Do you have foreign income or assets? | Yes / No |
| Q6 | Are your employees on the old or new tax regime? | Old / New |

**Output:** personalized checklist of gaps — e.g. "You need to collect PAN-Aadhaar linking confirmation from employees". Max 8–10 items, specific not generic.

> **Critical rule:** Wrong gaps destroy trust with CAs permanently. Every gap item must be sourced to a specific CBDT notification. No guessing.

---

### Export — CA-ready checklist PDF

**Day 7–8** · Not document generation — a clean PDF checklist of what the user's CA needs, gated behind email capture. This is the lead-gen engine.

- Available on all 3 tabs — exports current context (search results / scanned doc summary / gap report)
- **Email gate:** enter email → PDF downloads + copy sent to inbox via Resend (free up to 3k/mo)
- PDF includes: TaxBridge branding, date, filter/context applied, numbered checklist
- Generated client-side with jsPDF — no server needed

---

## V2 — after MVP validation

> *To be defined based on MVP usage and CA feedback*

---

## V3 — longer horizon

> *To be defined based on V2 learnings*
