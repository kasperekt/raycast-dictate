# Raycast Dictate

Helper extension that lets you dictate messages using locally-hosted AI models for STT.

## Quick Setup

To install application, first clone this repository and then run the command below:

```bash
PYTHON=$(which python3) npm install && npm run build
```

Now you should be able to open Raycast and type "Dictate" and see this application to show up.

Note: If the application doesn't show up in the Raycast, try running `npm run dev`, then turning the dev mode off and run `npm run build` again.

## Python Virtual Environment

This project uses a Python backend script (`assets/transcribe.py`). The Python virtual environment is intentionally created **outside** the repository at:

```text
~/.config/raycast-dictate/.venv
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

1. Create the venv at `~/.config/raycast-dictate/.venv` (using Python 3.12 by default).
2. Install dependencies from `requirements.txt`.

Override the Python executable (e.g. with pyenv) and/or venv path:

```bash
make PYTHON=$(which python3.12) install
make VENV="$HOME/.config/raycast-dictate/.venv" install
```

Show environment info:

```bash
make show
```

Remove the environment:

```bash
make clean
```
