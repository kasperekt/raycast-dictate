import { useEffect, useRef, useState } from 'react';
import { Action, ActionPanel, Detail, Clipboard, closeMainWindow, popToRoot } from '@raycast/api';
import dedent from 'dedent';
import { useDictation } from './utils/dictation';

function getMarkdownText({
	loadingState,
	message,
	pasteMessage,
}: {
	loadingState: string;
	message: string;
	pasteMessage: string | null;
}) {
	if (loadingState === 'initializing') {
		return dedent(`
			## Dictate

			🔄 **Initializing...**
		`);
	}

	if (loadingState === 'listening') {
		return dedent(`
			## Dictate

			👂 **Listening...**

			Speak now. When you're done, press **Enter** to finish and transcribe your speech.

			- Press **Esc** or click **Cancel** to abort.
			- You can dictate as long as you want before pressing Enter.
		`);
	}
	if (loadingState === 'processing') {
		return dedent(`
			## Dictate

			⚙️ **Processing your audio...**

			Please wait while your speech is being transcribed.
		`);
	}
	if (pasteMessage != null) {
		return dedent(`
			## Dictate

			**Your message is:**

			---

			${pasteMessage ? `> ${pasteMessage}` : '<empty>'}

			---
			- Press **Paste** to insert this text.
			- Press **Option+A** to dictate again.
			- Press **Copy** to copy to clipboard.
		`);
	}
	return dedent(`
		## Dictate

		${message}

		- Press **Option+A** to dictate again.
		- Press **Paste** to insert the result.
	`);
}

export default function Dictate() {
	const { transcript, loadingState, startDictation, reset, finishDictation, isReady } = useDictation();
	const [pasteMessage, setPasteMessage] = useState<string | null>(null);
	const [message, setMessage] = useState('No data yet...');
	const dictationRef = useRef(false);

	useEffect(() => {
		if (dictationRef.current) return;
		dictationRef.current = true;
		startDictation();
	}, []);

	useEffect(() => {
		if (isReady) {
			setMessage(transcript);
			setPasteMessage(transcript);

			// Automatically paste the transcript and close window if not empty
			if (transcript && transcript.trim().length > 0) {
				(async () => {
					await Clipboard.paste(transcript);
					await closeMainWindow();
					setTimeout(() => {
						popToRoot();
					}, 500);
				})();
			}
		}
	}, [isReady, transcript]);

	async function handlePaste() {
		if (pasteMessage) {
			await Clipboard.paste(pasteMessage);
			await closeMainWindow();
			setTimeout(() => {
				popToRoot();
			}, 500);
		}
	}

	return (
		<Detail
			markdown={getMarkdownText({ loadingState, message, pasteMessage })}
			actions={
				<ActionPanel>
					{loadingState === 'listening' && (
						<Action
							title="Finish"
							onAction={finishDictation}
							shortcut={{ key: 'enter', modifiers: ['opt'] }}
						/>
					)}
					{isReady && pasteMessage && (
						<>
							<Action title="Paste" onAction={handlePaste} />
							<Action.CopyToClipboard title="Copy" content={pasteMessage} />
							<Action
								title="Dictate Again"
								onAction={() => {
									reset();
									startDictation();
									setMessage('No data yet...');
									setPasteMessage(null);
								}}
								shortcut={{ modifiers: ['opt'], key: 'a' }}
							/>
						</>
					)}
					{(loadingState === 'idle' || loadingState === 'processing') && (
						<Action
							title="Start Dictation"
							onAction={() => {
								reset();
								startDictation();
								setMessage('No data yet...');
								setPasteMessage(null);
							}}
						/>
					)}
					{(loadingState === 'listening' || loadingState === 'processing') && (
						<Action title="Cancel" onAction={reset} />
					)}
				</ActionPanel>
			}
		/>
	);
}
