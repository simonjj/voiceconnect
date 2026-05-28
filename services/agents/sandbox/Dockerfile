# Sandbox-Agent: a generic Connect agent backed by Copilot CLI in an ACA Sandbox.
# Calls a public HTTP wrapper inside the sandbox; no aca CLI required.

FROM python:3.12-slim-trixie
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent.py .

ENV PORT=8020
EXPOSE 8020

CMD ["python", "agent.py"]
