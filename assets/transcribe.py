import argparse
import sys
import wave
import numpy as np
import sounddevice as sd
import queue
import mlx_whisper
import json

SAMPLE_RATE = 16000
CHANNELS = 1

# Create a queue to hold audio data from the callback.
audio_queue = queue.Queue()

def log(msg_type: str, message: str):
    """
    Prints out log (message) in form of json so that parent process can read it.
    """
    out_file = sys.stderr if msg_type == 'error' else sys.stdout
    message = json.dumps({ 'status': msg_type, 'message': message })
    print(message, flush=True, file=out_file)


def log_state_change(state: str, payload=None):
    """
    Logs a state change message.
    """
    obj = { 'status': "state_change", 'state': state }
    if payload is not None:
        obj['payload'] = payload
    message = json.dumps(obj)
    print(message, flush=True)


def audio_callback(indata, frames, time, status):
    """Callback function that is called for each audio block."""
    if status:
        log(status, file=sys.stderr)
    # Put a copy of the recorded data into the queue.
    audio_queue.put(indata.copy())


def record_until_key() -> np.ndarray:
    log("info", "Recording started. Press Enter to stop recording.")

    # Open an input stream with our callback.
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, callback=audio_callback):
        log_state_change('listening')
        # Wait for the user to press Enter.
        input()
    
    log("info", "Recording stopped. Saving file...")
    log_state_change('processing')

    # Drain the queue and collect all audio blocks.
    frames: list[np.ndarray] = []

    while not audio_queue.empty():
        frames.append(audio_queue.get())

    if not frames:
        # Return an empty float32 array (shape (0,)) so callers can handle gracefully.
        log("error", "No audio data was captured.")
        return np.empty((0,), dtype=np.float32)

    # Concatenate all blocks into one numpy array (shape: (samples, channels)).
    audio_data = np.concatenate(frames, axis=0)

    # Ensure we have a 1-D float32 waveform (samples,). The input stream already yields float32.
    if audio_data.ndim == 2 and audio_data.shape[1] == 1:
        audio_data = audio_data[:, 0]
    audio_data = np.asarray(audio_data, dtype=np.float32, order='C')

    log("info", "Recording done.")
    return audio_data


def transcribe_and_save(audio: np.ndarray) -> None:
    log("info", f"Transcribing audio")
    try:
        if audio is None or audio.size == 0:
            raise ValueError("Empty audio array passed to transcription")
        response = mlx_whisper.transcribe(audio, path_or_hf_repo="mlx-community/whisper-large-v3-turbo")
        text = str(response['text']).strip()
        log_state_change('ready', payload=text)
    except Exception as e:
        log('error', f'Error transcribing audio: {e}')
        log_state_change('error')


def main(args) -> None:
    audio = record_until_key()
    transcribe_and_save(audio)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Record audio from the microphone until a key is pressed, then save as a WAV file."
    )
    args = parser.parse_args()
    main(args)
