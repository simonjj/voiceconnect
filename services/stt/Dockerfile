FROM nvcr.io/nvidia/pytorch:24.09-py3

WORKDIR /app

# faster-whisper, fastapi, etc. (torch/numpy already in NGC base)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Silero VAD requires torchaudio — pin to match NGC 24.09 PyTorch 2.5
RUN pip install --no-cache-dir torchaudio==2.5.0

# Pre-download Silero VAD so startup is fast
RUN python -c "import torch; torch.hub.load('snakers4/silero-vad', 'silero_vad', trust_repo=True)"

COPY stt_service.py .

EXPOSE 8001

# Whisper model is downloaded on first startup (~3GB for large-v3).
# To bake it in, uncomment:
# RUN python -c "from faster_whisper import WhisperModel; WhisperModel('large-v3', device='cpu')"

CMD ["python", "stt_service.py"]
