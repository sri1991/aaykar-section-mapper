"""GeminiProvider — default LLM implementation.

Uses google-generativeai with structured output mode for extraction
(temperature 0.0) and a separate model for narration.
"""

from __future__ import annotations

import json
import os
from typing import Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str | None = None,
        extract_model: str | None = None,
        narrate_model: str | None = None,
    ) -> None:
        self._api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self._api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        self._extract_model_name = extract_model or os.environ.get(
            "GEMINI_EXTRACT_MODEL", "gemini-2.5-flash"
        )
        self._narrate_model_name = narrate_model or os.environ.get(
            "GEMINI_NARRATE_MODEL", "gemini-2.5-pro"
        )
        # Import lazily so unit tests can import this module without the SDK.
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=self._api_key)
        self._genai = genai

    def extract(
        self,
        *,
        prompt: str,
        schema: Type[T],
        pdf_text: str,
    ) -> T:
        model = self._genai.GenerativeModel(self._extract_model_name)
        generation_config = {
            "temperature": 0.0,
            "response_mime_type": "application/json",
            "response_schema": schema.model_json_schema(),
        }
        full_prompt = (
            f"{prompt}\n\n"
            "Return JSON conforming exactly to the response schema. "
            "Use null for fields you cannot find. Do not invent numbers.\n\n"
            f"=== ITR PDF TEXT START ===\n{pdf_text}\n=== ITR PDF TEXT END ==="
        )
        response = model.generate_content(
            full_prompt, generation_config=generation_config
        )
        raw = response.text
        data = json.loads(raw)
        return schema.model_validate(data)

    def narrate(self, *, prompt: str, context: str) -> str:
        model = self._genai.GenerativeModel(self._narrate_model_name)
        generation_config = {"temperature": 0.2}
        response = model.generate_content(
            f"{prompt}\n\nContext:\n{context}",
            generation_config=generation_config,
        )
        return response.text.strip()
