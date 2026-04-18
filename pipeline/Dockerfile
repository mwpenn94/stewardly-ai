FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    mysql-connector-python fastapi uvicorn python-multipart pyyaml

COPY . /app/pipeline/
COPY ../backend/ /app/backend/

RUN mkdir -p /app/pipeline/data/raw /app/pipeline/data/enriched \
    /app/pipeline/data/scored /app/pipeline/data/reference

ENV PYTHONPATH=/app/pipeline:/app/backend
EXPOSE 8100

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8100"]
