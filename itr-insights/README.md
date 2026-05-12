# ITR Insights

Upload a filed Indian ITR PDF (ITR-1 or ITR-2, AY 2024-25 or AY 2025-26) and get back:

1. Deduction gap analysis (80C / 80D / HRA / others)
2. Anomaly flags (internal mismatches, outliers)
3. Narrative summary

See [`CLAUDE.md`](./CLAUDE.md) for the source-of-truth design doc and locked decisions.

## Stack

- Backend: FastAPI + Python 3.11+ + Pydantic v2
- LLM: Gemini by default (model-agnostic via `LLMProvider` protocol)
- Frontend: static HTML + vanilla JS + Tailwind CDN

## Quick start

```bash
# from itr-insights/
make install
cp backend/.env.example backend/.env   # fill in GEMINI_API_KEY
make dev
# open http://localhost:8000
```

Run tests:

```bash
make test
```

## Determinism boundary

No LLM ever touches a tax calculation. Extraction is LLM-driven; analysis is pure
Python; narration is LLM-driven but every number in the prose must already appear
in `ComputedInsights`. See `CLAUDE.md` for the full guarantees.
