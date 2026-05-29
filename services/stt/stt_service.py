"""
Connect STT Service
Streaming speech-to-text using faster-whisper + Silero VAD.
Accepts WebSocket audio (PCM Float32), returns JSON transcript events.

Protocol:
  1. Client sends JSON config: { "sample_rate": 48000 }
  2. Client sends binary audio chunks (PCM float32)
  3. Server returns JSON: { "type": "transcript", "text": "...", "is_final": true }
"""
import asyncio
import json
import logging
import os
import numpy as np
import torch
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stt")

app = FastAPI(title="Connect STT Service")

whisper_model = None
vad_model = None

SILENCE_THRESHOLD_S = float(os.getenv("STT_SILENCE_THRESHOLD_S", "0.4"))
MIN_SPEECH_S = float(os.getenv("STT_MIN_SPEECH_S", "0.3"))
VAD_CHUNK_SAMPLES = 512  # Silero VAD expects 512 samples at 16kHz
WHISPER_MODEL = os.getenv("STT_WHISPER_MODEL", "large-v3-turbo")
WHISPER_BEAM_SIZE = int(os.getenv("STT_BEAM_SIZE", "1"))


def resample(audio: np.ndarray, orig_sr: int, target_sr: int = 16000) -> np.ndarray:
    if orig_sr == target_sr:
        return audio
    ratio = target_sr / orig_sr
    n_samples = int(len(audio) * ratio)
    indices = np.linspace(0, len(audio) - 1, n_samples)
    return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)


@app.on_event("startup")
async def startup():
    global whisper_model, vad_model
    logger.info(f"Loading Whisper {WHISPER_MODEL}...")
    whisper_model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")
    logger.info("Loading Silero VAD...")
    vad_model, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
    vad_model.eval()
    logger.info("Models loaded — ready.")


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": whisper_model is not None}


@app.websocket("/transcribe")
async def transcribe(ws: WebSocket):
    await ws.accept()

    # First message: config
    config_raw = await ws.receive_text()
    config = json.loads(config_raw)
    sample_rate = config.get("sample_rate", 48000)
    logger.info(f"STT session started, sample_rate={sample_rate}")

    audio_buffer = np.array([], dtype=np.float32)
    speech_buffer = np.array([], dtype=np.float32)
    is_speaking = False
    silence_samples = 0

    try:
        while True:
            data = await ws.receive_bytes()
            chunk = np.frombuffer(data, dtype=np.float32)

            # Resample to 16kHz for VAD and transcription
            chunk_16k = resample(chunk, sample_rate, 16000)
            audio_buffer = np.concatenate([audio_buffer, chunk_16k])

            while len(audio_buffer) >= VAD_CHUNK_SAMPLES:
                vad_chunk = audio_buffer[:VAD_CHUNK_SAMPLES]
                audio_buffer = audio_buffer[VAD_CHUNK_SAMPLES:]

                vad_tensor = torch.from_numpy(vad_chunk.copy())
                speech_prob = vad_model(vad_tensor, 16000).item()

                if speech_prob > 0.5:
                    is_speaking = True
                    silence_samples = 0
                    speech_buffer = np.concatenate([speech_buffer, vad_chunk])
                elif is_speaking:
                    speech_buffer = np.concatenate([speech_buffer, vad_chunk])
                    silence_samples += VAD_CHUNK_SAMPLES

                    if silence_samples >= int(16000 * SILENCE_THRESHOLD_S):
                        duration_s = len(speech_buffer) / 16000
                        if duration_s >= MIN_SPEECH_S:
                            segments, _ = whisper_model.transcribe(
                                speech_buffer, beam_size=WHISPER_BEAM_SIZE, language="en",
                                vad_filter=False,
                            )
                            text = " ".join(seg.text for seg in segments).strip()
                            if text:
                                await ws.send_json({
                                    "type": "transcript",
                                    "text": text,
                                    "is_final": True,
                                })
                                logger.info(f"Transcript: {text}")

                        speech_buffer = np.array([], dtype=np.float32)
                        is_speaking = False
                        silence_samples = 0

    except WebSocketDisconnect:
        logger.info("STT session ended")
    except Exception as e:
        logger.error(f"STT error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
