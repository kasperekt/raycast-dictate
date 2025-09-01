import argparse
import sys
import wave
import numpy as np
import sounddevice as sd
import queue
import sys

# Create a queue to hold audio data from the callback.
audio_queue = queue.Queue()

print(sd.query_devices())

def audio_callback(indata, frames, time, status):
    """Callback function that is called for each audio block."""
    if status:
        print(status, file=sys.stderr)
    # Put a copy of the recorded data into the queue.
    audio_queue.put(indata.copy())


def record_until_key(output: str, samplerate: int = 44100, channels: int = 1):
    print("Recording started. Press Enter to stop recording.")
    
    # Open an input stream with our callback.
    with sd.InputStream(samplerate=samplerate, channels=channels, callback=audio_callback):
        # Wait for the user to press Enter.
        input()
    
    print("Recording stopped. Saving file...")

    # Drain the queue and collect all audio blocks.
    frames = []
    while not audio_queue.empty():
        frames.append(audio_queue.get())
    
    # If no frames were recorded, exit early.
    if not frames:
        print("No audio data was captured.")
        return

    # Concatenate all blocks into one numpy array.
    audio_data = np.concatenate(frames, axis=0)

    # Convert from float32 (range -1.0 to 1.0) to int16 (typical WAV format).
    audio_int16 = np.int16(audio_data * 32767)

    # Write the audio data to a WAV file.
    with wave.open(output, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)  # 2 bytes for int16
        wf.setframerate(samplerate)
        wf.writeframes(audio_int16.tobytes())
    print(f"Recording saved to {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Record audio from the microphone until a key is pressed, then save as a WAV file."
    )
    parser.add_argument(
        "--output",
        type=str,
        default="recording.wav",
        help="Path to the output WAV file (default: recording.wav).",
    )
    parser.add_argument(
        "--samplerate",
        type=int,
        default=44100,
        help="Sampling rate in Hz (default: 44100).",
    )
    parser.add_argument(
        "--channels",
        type=int,
        default=1,
        help="Number of audio channels (default: 1).",
    )
    args = parser.parse_args()

    record_until_key(args.output, args.samplerate, args.channels)