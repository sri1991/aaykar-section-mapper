# AaykarSetu — V2/V3 Roadmap & Expansion Plan

> Planned additions based on current codebase state (100 sections, 18 forms) · April 2026

---

## New Sections to Add to the Mapper

The current 100 sections focus on the most common ones. These categories are underrepresented:

| Category | What to add |
|---|---|
| **Charitable Trusts & NGOs** | Sections governing 12A/12AB registration, 80G approvals, FCRA compliance hooks |
| **Transfer Pricing** | TP documentation rules, APA provisions, safe harbour limits (big for SME exporters) |
| **Startup / DPIIT** | Section 80-IAC (tax holiday), angel tax provisions (56(2)(viib) and its 2025 equivalent) |
| **Virtual Digital Assets** | VDA taxation sections — high demand from clients with crypto holdings |
| **Search & Seizure** | 132, 133A equivalents — audit teams need these for assessment proceedings |
| **Presumptive Taxation** | 44AD, 44ADA, 44AE in full — many SMEs/freelancers use these exclusively |
| **International Taxation** | DTAA reference hooks, POEM rules, equalisation levy equivalents |

---

## New Features

### V2 — High impact, relatively quick

**1. Gap Auditor** *(already designed, not yet built)*
The questionnaire flow is designed but not built. Gives a personalised compliance checklist in 2 minutes. Highest-value feature for CAs.

**2. Bulk Document Scanner**
Currently one doc at a time. Let users upload a ZIP or folder of PDFs/DOCX — get a combined report. Huge for audit teams working on 10+ client files.

**3. Regime Comparison Calculator**
Old vs. new tax regime side-by-side for a given salary/income profile. CAs ask this for every salaried client. Pure client-side, no backend needed.

**4. Section Bookmark / Save**
Let users pin frequently used sections. LocalStorage-based, no auth required. Simple but high retention value for repeat CAs.

---

### V3 — Bigger bets

**5. Client Report Generator**
CA uploads a salary structure → tool generates a 2-page "Transition Impact Summary" PDF branded for the CA's firm. Gated behind email — strong lead-gen.

**6. Circular & Notification Tracker**
CBDT releases circulars constantly. A curated feed of 2025-relevant notifications with section cross-references — manually curated initially.

**7. Multi-language Support**
Hindi and regional language summaries for the plain-English explanations. Opens up the SME-direct market beyond English-comfortable users.

**8. CA Workspace (with auth)**
Saved searches, client-tagged sessions, team sharing. Supabase Auth is already wired up — this is when to enable it.

**9. API / Embed**
Let accounting software (Tally, Zoho Books) query the mapper via API. B2B distribution play.

---

## Priority Order

1. Gap Auditor
2. Regime Comparison Calculator
3. Bulk Document Scanner
4. Section Bookmarks
5. Client Report PDF
6. Circular Tracker
7. Multi-language
8. CA Workspace
9. API / Embed

> **Note on Gap Auditor:** Every gap item must be sourced to a specific CBDT notification. Wrong gaps destroy CA trust permanently — accuracy over speed.
