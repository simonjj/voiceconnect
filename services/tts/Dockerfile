FROM nvcr.io/nvidia/pytorch:24.09-py3

WORKDIR /app

# kokoro, fastapi, etc. (torch/numpy already in NGC base)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Kokoro base model + default voice so startup is fast
RUN python -c "from kokoro import KPipeline; p = KPipeline(repo_id='hexgrad/Kokoro-82M', lang_code='a'); next(p('hello', voice='af_sky'))"

COPY tts_service.py .

EXPOSE 8002

CMD ["python", "tts_service.py"]
