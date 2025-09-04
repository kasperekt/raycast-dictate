import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Logger } from './logger';
import { environment, getPreferenceValues } from '@raycast/api';
import { GlobalPreferences } from './types';

// Virtual environment directory (outside repo)
export const VENV_DIR = path.join(os.homedir(), '.config', 'raycast-dictate', '.venv');
export const PYTHON_INTERPRETER = path.join(VENV_DIR, 'bin', 'python');
export const TRANSCRIBE_SCRIPT_PATH = path.join(environment.assetsPath, 'transcribe.py');

/**
 * Return the Python interpreter path, logging a note if it's missing.
 */
export function getPythonInterpreter(logger?: Logger): string {
	if (!fs.existsSync(PYTHON_INTERPRETER)) {
		logger?.log('missing_interpreter', { path: PYTHON_INTERPRETER, hint: "Run 'make install'" });
	}
	return PYTHON_INTERPRETER;
}

export function getLogPath(): string | undefined {
	const logDir = getPreferenceValues<GlobalPreferences>().log_file_path;

	if (logDir) {
		// Expand ~ to home directory
		return path.resolve(logDir.replace(/^~(?=$|\/|\\)/, os.homedir()));
	}

	return undefined;
}
