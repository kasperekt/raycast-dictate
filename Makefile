# Makefile for Python 3.12 virtual environment management
# Usage examples:
#   make venv        # create .venv with Python 3.12 (fails if python3.12 not found)
#   make install     # create venv (if needed) + install requirements.txt
#   make upgrade     # upgrade all packages listed in requirements.txt
#   make freeze      # output exact versions to requirements.lock
#   make clean       # remove the virtual environment
#   make help        # list targets

# Desired Python interpreter (override with: make PYTHON=/path/to/python3.12 install)
PYTHON ?= python3.12
VENV := assets/.venv
BIN := $(VENV)/bin
PY := $(BIN)/python
PIP := $(BIN)/pip

REQ_FILE := requirements.txt
LOCK_FILE := requirements.lock

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  venv      - Create virtual environment using $(PYTHON)"
	@echo "  install   - Create venv (if needed) and install from $(REQ_FILE)"
	@echo "  upgrade   - Reinstall using latest versions (ignoring existing pins)"
	@echo "  freeze    - Write fully pinned deps to $(LOCK_FILE)"
	@echo "  clean     - Remove the virtual environment"
	@echo "  show      - Show Python & pip location/version in venv"

$(VENV)/pyvenv.cfg:
	@if ! command -v $(PYTHON) >/dev/null 2>&1; then \
		echo "Error: $(PYTHON) not found. Install Python 3.12 (e.g. with pyenv) or run 'make PYTHON=...'"; \
		exit 1; \
	fi
	$(PYTHON) -m venv $(VENV)

.PHONY: venv
venv: $(VENV)/pyvenv.cfg
	@echo "Virtual environment ready at $(VENV)"

# Ensure requirements file exists (won't overwrite existing)
$(REQ_FILE):
	@test -f $(REQ_FILE) || echo "# Add project dependencies here" > $(REQ_FILE)

.PHONY: install
install: $(REQ_FILE) venv
	$(PIP) install --upgrade pip
	@if [ -s $(REQ_FILE) ]; then \
		echo "Installing dependencies from $(REQ_FILE)..."; \
		$(PIP) install -r $(REQ_FILE); \
	else \
		echo "$(REQ_FILE) is empty; nothing to install."; \
	fi

.PHONY: upgrade
upgrade: venv
	@if [ ! -s $(REQ_FILE) ]; then echo "Nothing to upgrade; $(REQ_FILE) empty."; exit 0; fi
	$(PIP) install --upgrade pip
	# Install latest versions ignoring currently installed ones
	$(PIP) install --upgrade --force-reinstall -r $(REQ_FILE)

.PHONY: freeze
freeze: venv
	$(PIP) freeze > $(LOCK_FILE)
	@echo "Locked versions written to $(LOCK_FILE)"

.PHONY: show
show: venv
	@echo "Python: $$($(PY) --version 2>&1)"
	@echo "Location: $$($(PY) -c 'import sys,os; print(sys.executable)')"
	@echo "Pip: $$($(PIP) --version)"

.PHONY: clean
clean:
	rm -rf $(VENV)
	@echo "Removed $(VENV)" 
