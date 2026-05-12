"""Structured logging with PAN/name masking."""

from __future__ import annotations

import logging
import os
import re

import structlog

_PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")


def _mask_pan(_logger, _name, event_dict):
    for k, v in list(event_dict.items()):
        if isinstance(v, str):
            event_dict[k] = _PAN_RE.sub("XXXXX0000X", v)
    return event_dict


def configure_logging() -> None:
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=level, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            _mask_pan,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level)),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
