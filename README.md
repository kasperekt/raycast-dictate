# Dictate

Helper extension that lets you dictate messages using locally-hosted AI models for STT.

## Python Virtual Environment

This project uses a Python backend script (`assets/transcribe.py`). The Python virtual environment is intentionally created **outside** the repository at:

```text
~/.config/dictate/.venv
```

Reasons:
- Keeps the repo clean (no `.venv` folder committed accidentally).
- Consistent location across clones / branches.
- Works smoothly with Raycast extension sandboxing.

### Create / Update the venv

```bash
make install
```

This will:

1. Create the venv at `~/.config/dictate/.venv` (using Python 3.12 by default).
2. Install dependencies from `requirements.txt`.

Override the Python executable (e.g. with pyenv) and/or venv path:

```bash
make PYTHON=$(which python3.12) install
make VENV="$HOME/.config/dictate/.venv" install
```

Show environment info:

```bash
make show
```

Remove the environment:

```bash
make clean
```

### Using the Interpreter in Code

TypeScript code resolves the interpreter dynamically via `os.homedir()` (see `src/utils/pythonEnv.ts`). You should not hard‑code absolute user paths elsewhere.

VS Code is configured (in `.vscode/settings.json`) to point to `${env:HOME}/.config/dictate/.venv/bin/python`.

### Manual Test of the Transcriber

```bash
cd assets
~/.config/dictate/.venv/bin/python transcribe.py
```

Press Enter to stop recording and trigger transcription.

---

Run `make help` to see available Make targets.
