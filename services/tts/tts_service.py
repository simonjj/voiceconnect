"""
Connect TTS Service
Text-to-speech using Kokoro. Each agent gets a distinct voice.

Protocol:
  POST /synthesize { "text": "...", "voice_id": "af_sky", "speed": 1.0 }
  Returns: streaming binary PCM float32 at 24kHz
  Headers: X-Sample-Rate, X-Audio-Format
"""
import logging
import numpy as np
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from kokoro import KPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tts")

app = FastAPI(title="Connect TTS Service")

pipeline = None
SAMPLE_RATE = 24000  # Kokoro native output rate


class SynthRequest(BaseModel):
    text: str
    voice_id: str = "af_sky"
    speed: float = 1.0


@app.on_event("startup")
async def startup():
    global pipeline
    logger.info("Loading Kokoro TTS pipeline...")
    pipeline = KPipeline(lang_code="a")  # American English
    logger.info("Kokoro loaded — ready.")


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": pipeline is not None, "sample_rate": SAMPLE_RATE}


@app.get("/voices")
async def voices():
    return {
        "voices": [
            {"id": "af_sky", "name": "Sky", "gender": "female"},
            {"id": "af_bella", "name": "Bella", "gender": "female"},
            {"id": "am_adam", "name": "Adam", "gender": "male"},
            {"id": "am_michael", "name": "Michael", "gender": "male"},
            {"id": "bf_emma", "name": "Emma", "gender": "female"},
            {"id": "bm_george", "name": "George", "gender": "male"},
        ],
        "sample_rate": SAMPLE_RATE,
    }


@app.post("/synthesize")
async def synthesize(req: SynthRequest):
    def generate():
        for _graphemes, _phonemes, audio_chunk in pipeline(
            req.text, voice=req.voice_id, speed=req.speed
        ):
            if audio_chunk is not None and len(audio_chunk) > 0:
                pcm = audio_chunk.numpy().astype(np.float32)
                yield pcm.tobytes()

    return StreamingResponse(
        generate(),
        media_type="application/octet-stream",
        headers={
            "X-Sample-Rate": str(SAMPLE_RATE),
            "X-Audio-Format": "pcm-float32",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
