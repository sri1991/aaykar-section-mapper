"""Provider selection at FastAPI startup."""

from __future__ import annotations

import os

from .provider import LLMProvider


def build_provider() -> LLMProvider:
    name = os.environ.get("LLM_PROVIDER", "gemini").lower()
    if name == "gemini":
        from .gemini import GeminiProvider

        return GeminiProvider()
    raise RuntimeError(f"Unknown LLM_PROVIDER: {name!r}")
