FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent.py .

EXPOSE 8010

ENV PORT=8010

CMD ["python", "agent.py"]
