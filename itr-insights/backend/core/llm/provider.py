"""LLMProvider Protocol.

Every provider exposes two operations:

- `extract(prompt, schema, pdf_text, ...)` → a validated instance of `schema`.
- `narrate(prompt, context)` → free-form prose (no schema, no numbers expected
  from the model — see `core.narrate` for the leak guard).

Providers MUST:
- Default to temperature 0.0 for extraction.
- Use structured-output mode when the underlying API supports it.
- Never log raw extraction output containing PAN / income.
"""

from __future__ import annotations

from typing import Protocol, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProvider(Protocol):
    name: str

    def extract(
        self,
        *,
        prompt: str,
        schema: Type[T],
        pdf_text: str,
    ) -> T:
        """Return a validated instance of `schema` from `pdf_text`."""
        ...

    def narrate(
        self,
        *,
        prompt: str,
        context: str,
    ) -> str:
        """Generate prose. Must not be relied on for numbers."""
        ...
