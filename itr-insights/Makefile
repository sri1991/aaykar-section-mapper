.PHONY: install dev test eval clean

PY ?= python3
PIP ?= $(PY) -m pip
PYTEST ?= $(PY) -m pytest

install:
	$(PIP) install -r backend/requirements.txt

dev:
	cd backend && $(PY) -m uvicorn app:app --reload --host $${HOST:-0.0.0.0} --port $${PORT:-8000}

test:
	cd backend && $(PYTEST) -q

eval:
	cd backend && $(PYTEST) -q tests/eval -m eval

clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type d -name .pytest_cache -prune -exec rm -rf {} +
