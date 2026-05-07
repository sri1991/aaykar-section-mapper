# AaykarSetu — Section Mapper

Free, open-source tool to map any **Income Tax Act 1961** section to its equivalent in the **Income Tax Act 2025**.

Built for CAs, finance teams, and developers navigating India's tax transition.

## What it does

- Search 115 sections by number, keyword, or plain English
- See old ref → new ref, change type (renumbered / merged / relocated / amended / deleted)
- Monetary limit changes with old vs new amounts
- Regime-specific variants (new regime vs old regime)
- Related sections (read-with, governed-by, form-required)
- Verbatim Act 2025 source text with sub-sections and provisos
- CBDT-verified, sourced from the official CBDT Navigator PDF

## Stack

- Next.js 16 (App Router)
- React 19, Tailwind CSS v4
- Fuse.js (client-side fuzzy search — no backend, no API keys)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data

Mapping data is in [`lib/data/mapping.json`](lib/data/mapping.json) — v3.0.0, sourced from the CBDT Navigator PDF and the Income Tax Act 2025 as amended by Finance Act 2026.

Always verify with a qualified CA before relying on any mapping.

## License

MIT

---

Built by MSB Digital Labs
