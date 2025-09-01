import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const DEFAULT_LOG_FILENAME = 'dictate.log';

export class Logger {
	private enabled: boolean;
	private logToConsole: boolean;
	private logFilePath?: string;

	constructor(logDir?: string, logToConsole: boolean = false) {
		this.enabled = !!logDir;
		this.logToConsole = logToConsole;
		if (logDir) {
			this.logFilePath = join(logDir, DEFAULT_LOG_FILENAME);
		}
	}

	log(action: string, data: Record<string, unknown>): void {
		if (this.logToConsole) {
			console.log(`[${action}]`, data);
		}
		if (!this.enabled || !this.logFilePath) return;

		try {
			const dir = dirname(this.logFilePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			const timestamp = new Date().toISOString();
			const logData = {
				timestamp,
				action,
				...data,
			};
			const logEntry = JSON.stringify(logData, null, 0) + '\n';
			appendFileSync(this.logFilePath, logEntry);
		} catch (error) {
			// Fallback to console if file logging fails
			console.error('Failed to write to log file:', error);
		}
	}
}
