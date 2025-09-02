import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Logger } from './logger';

// Virtual environment directory (outside repo)
export const VENV_DIR = path.join(os.homedir(), '.config', 'dictate', '.venv');
export const PYTHON_INTERPRETER = path.join(VENV_DIR, 'bin', 'python');

/**
 * Return the Python interpreter path, logging a note if it's missing.
 */
export function getPythonInterpreter(logger?: Logger): string {
  if (!fs.existsSync(PYTHON_INTERPRETER)) {
    logger?.log('missing_interpreter', { path: PYTHON_INTERPRETER, hint: "Run 'make install'" });
  }
  return PYTHON_INTERPRETER;
}
