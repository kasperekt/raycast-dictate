import { ChildProcess, exec, execFile } from 'node:child_process';
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
		const python = getPythonInterpreter(this.logger);
		const script = path.join(environment.assetsPath, 'transcribe.py');
		this.process = execFile(python, [script], {
			cwd: environment.assetsPath,
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
			try {
				const lines = data.toString().trim().split('\n');

				for (const line of lines) {
					if (line.trim()) {
						const parsedMessage = JSON.parse(line.trim()) as ChildProcessUpdate;

						if (parsedMessage.status === 'error') {
							this.onLoadingCallback?.('error');
							this.kill();
						}

						if (parsedMessage.status === 'state_change') {
							this.onLoadingCallback?.(parsedMessage.state);
							if (parsedMessage.state === 'ready' && parsedMessage.payload) {
								console.log(`State changed with payload: ${parsedMessage.payload}`);
								this.onFinishCallback?.(parsedMessage.payload as string);
							}
						}
					}
				}
			} catch (error) {
				console.error(`Error parsing message from child process: ${error}`);
				this.onLoadingCallback?.('error');
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
		this.process?.kill();
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
