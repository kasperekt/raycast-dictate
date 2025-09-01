import fs from 'node:fs';
import path from 'node:path';
import { ChildProcess, exec } from 'node:child_process';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getPreferenceValues, environment } from '@raycast/api';
import { Logger } from './logger';
import { GlobalPreferences } from './types';

export type LoadingState = 'idle' | 'listening' | 'processing' | 'generating' | 'ready' | 'error';

export interface DictationPreferences extends GlobalPreferences {
	tmp_wav_directory: string;
	log_file_path?: string;
}

export class RecordScriptProcess {
	process: ChildProcess | null = null;
	outputName: string;
	onFinishCallback: ((text: string) => void) | null;
	onLoadingCallback: ((state: LoadingState) => void) | null;
	logger: Logger;
	private pythonPath: string;

	constructor(outputName: string) {
		this.pythonPath = path.join(environment.assetsPath, '.venv/bin/python');
		this.outputName = outputName;
		this.onFinishCallback = null;
		this.onLoadingCallback = null;
		const { log_file_path } = getPreferenceValues<DictationPreferences>();
		this.logger = new Logger(log_file_path, environment.isDevelopment);
		this.assertConfigurationCorrect();
	}

	onFinish(callback: (text: string) => void) {
		this.onFinishCallback = callback;
	}

	onLoading(callback: (state: LoadingState) => void) {
		this.onLoadingCallback = callback;
	}

	assertConfigurationCorrect() {
		if (!fs.existsSync(this.pythonPath))
			throw new Error(`Python interpreter not found at path: ${this.pythonPath}`);
	}

	getWavPath() {
		const { tmp_wav_directory: wavDirectory } = getPreferenceValues<DictationPreferences>();
		if (!fs.existsSync(wavDirectory)) {
			fs.mkdirSync(wavDirectory, { recursive: true });
		}
		const filename = `${this.outputName.replace(/\.wav$/, '')}.wav`;
		return `${wavDirectory}/${filename}`;
	}

	record() {
		const pythonPath = this.pythonPath;
		this.onLoadingCallback?.('listening');
		this.process = exec(`${pythonPath} record.py --samplerate=16000 --output="${this.getWavPath()}"`, {
			cwd: environment.assetsPath,
		});
		// this.process?.stdout?.on("data", () => {});
		this.process.on('exit', () => {
			this.generate();
			this.onLoadingCallback?.('processing');
		});
	}

	complete(text: string) {
		try {
			text = text.trim();
			this.onLoadingCallback?.('ready');
			this.onFinishCallback?.(text);
		} catch {
			this.onLoadingCallback?.('error');
		}
	}

	generate() {
		let text = '';
		this.process = exec(`${this.pythonPath} transcribe.py ${this.getWavPath()}`, {
			cwd: environment.assetsPath,
		});

		this.process.stdout?.on('data', (data) => {
			console.log(`Returned: ${data}`);
			// this.complete(data);
			text += data;
		});

		this.process.on('exit', () => {
			// this.complete();
			console.log('Exit!!');
			this.complete(text);
		});
	}

	finish() {
		if (this.process) {
			this.process.stdin?.write('\n');
		}
	}
}

// React hook for dictation
export function useDictation() {
	const [loadingState, setLoadingState] = useState<LoadingState>('idle');
	const [transcript, setTranscript] = useState('');
	const processRef = useRef<RecordScriptProcess | null>(null);

	const startDictation = useCallback(() => {
		setTranscript('');
		setLoadingState('listening');
	}, []);

	const reset = useCallback(() => {
		setTranscript('');
		setLoadingState('idle');
		processRef.current = null;
	}, []);

	// Call this to finish recording (send newline to record.py)
	const finishDictation = useCallback(() => {
		if (loadingState === 'listening' && processRef.current) {
			processRef.current.finish();
		}
	}, [loadingState]);

	useEffect(() => {
		if (loadingState === 'listening' && !processRef.current) {
			const recordProcess = new RecordScriptProcess(`raycast_${Date.now()}.wav`);
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
