import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { getPythonInterpreter } from './pythonEnv';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getPreferenceValues, environment } from '@raycast/api';
import { Logger } from './logger';
import { GlobalPreferences } from './types';

export type LoadingState = 'idle' | 'initializing' | 'listening' | 'processing' | 'generating' | 'ready' | 'error';
type ChildProcessUpdate =
	| { status: 'state_change'; state: LoadingState; payload?: unknown }
	| { status: 'error' | 'info'; message: string };

export interface DictationPreferences extends GlobalPreferences {
	tmp_wav_directory: string;
	log_file_path?: string;
}

export class RecordScriptProcess {
	onFinishCallback: ((text: string) => void) | null;
	onLoadingCallback: ((state: LoadingState) => void) | null;
	logger: Logger;

	private process: ChildProcess | null = null;
	private stdoutBuffer = '';
	private spawnStart?: bigint;
	private firstStdoutAt?: number;
	private readyAt?: number;

	// Cache script path (assetsPath is stable during runtime)
	private static scriptPath = path.join(environment.assetsPath, 'transcribe.py');

	constructor() {
		const { log_file_path } = getPreferenceValues<DictationPreferences>();
		this.onFinishCallback = null;
		this.onLoadingCallback = null;
		this.logger = new Logger(log_file_path, environment.isDevelopment);
	}

	onFinish(callback: (text: string) => void) {
		this.onFinishCallback = callback;
	}

	onLoading(callback: (state: LoadingState) => void) {
		this.onLoadingCallback = callback;
	}

	record() {
		// Prevent spawning multiple concurrent processes
		if (this.process) {
			this.logger.log('record_already_running', {});
			return;
		}
		const python = getPythonInterpreter(this.logger);
		const script = RecordScriptProcess.scriptPath;
		this.spawnStart = globalThis.process.hrtime.bigint();
		this.logger.log('spawn_start', { script });
		// Use spawn for lower overhead and streaming output without shell wrapping.
		this.process = spawn(python, [script], {
			cwd: environment.assetsPath,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		this.process.stderr?.on('data', (err) => {
			console.error(`Error from child process: ${err}`);
		});

		this.process.on('exit', (code) => {
			console.log(`Child process exited with code: ${code}`);
			this.kill();
			this.onLoadingCallback!('error');
		});

		this.process.stdout?.on('data', (data) => {
			if (!this.firstStdoutAt && this.spawnStart) {
				const diff = Number(globalThis.process.hrtime.bigint() - this.spawnStart) / 1e6;
				this.firstStdoutAt = diff;
				this.logger.log('first_stdout', { ms: diff });
			}
			this.stdoutBuffer += data.toString();
			let newlineIndex;
			while ((newlineIndex = this.stdoutBuffer.indexOf('\n')) !== -1) {
				const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
				this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
				if (!line) continue;
				try {
					const parsedMessage = JSON.parse(line) as ChildProcessUpdate;
					if (parsedMessage.status === 'error') {
						this.logger.log('child_error', { message: parsedMessage.message });
						this.onLoadingCallback?.('error');
						this.kill();
						return;
					}
					if (parsedMessage.status === 'state_change') {
						this.logger.log('state_change', { state: parsedMessage.state });
						this.onLoadingCallback?.(parsedMessage.state);
						if (parsedMessage.state === 'ready' && parsedMessage.payload) {
							if (this.spawnStart && !this.readyAt) {
								const total = Number(globalThis.process.hrtime.bigint() - this.spawnStart) / 1e6;
								this.readyAt = total;
								this.logger.log('ready_timing', {
									spawn_to_first_stdout_ms: this.firstStdoutAt,
									spawn_to_ready_ms: total,
								});
							}
							this.onFinishCallback?.(parsedMessage.payload as string);
						}
					}
				} catch (error) {
					this.logger.log('parse_error', { error: (error as Error).message, line });
					this.onLoadingCallback?.('error');
				}
			}
		});
	}

	finishRecording() {
		console.log('FinishRecording');
		if (this.process) {
			this.process.stdin?.write('\n');
		}
	}

	/**
	 * Kills the child process and resets the loading state.
	 */
	kill() {
		if (this.process) {
			try {
				this.process.kill();
			} catch (e) {
				this.logger.log('kill_error', { error: (e as Error).message });
			}
		}
		this.process = null;
		this.stdoutBuffer = '';
		this.onLoadingCallback?.('idle');
	}
}

// React hook for dictation
export function useDictation() {
	const [loadingState, setLoadingState] = useState<LoadingState>('idle');
	const [transcript, setTranscript] = useState('');
	const processRef = useRef<RecordScriptProcess | null>(null);

	const startDictation = useCallback(() => {
		setTranscript('');
		setLoadingState('initializing');
	}, []);

	const reset = useCallback(() => {
		setTranscript('');
		setLoadingState('idle');
		processRef.current?.kill();
		processRef.current = null;
	}, []);

	// Call this to finish recording (send newline to record.py)
	const finishDictation = useCallback(() => {
		if (loadingState === 'listening' && processRef.current) {
			processRef.current.finishRecording();
		}
	}, [loadingState]);

	useEffect(() => {
		if (loadingState === 'initializing' && !processRef.current) {
			const recordProcess = new RecordScriptProcess();
			processRef.current = recordProcess;

			recordProcess.onFinish((text) => {
				setTranscript(text);
				setLoadingState('ready');
			});

			recordProcess.onLoading((state) => {
				setLoadingState(state);
			});

			recordProcess.record();
		}

		if (loadingState === 'ready' || loadingState === 'error') {
			processRef.current = null;
		}
	}, [loadingState]);

	return {
		transcript,
		loadingState,
		startDictation,
		reset,
		finishDictation, // Call this when user hits ENTER in listening mode
		isReady: loadingState === 'ready',
	};
}
