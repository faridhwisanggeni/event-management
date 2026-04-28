# syntax=docker/dockerfile:1.7
# Slim runtime — uvicorn worker is fine for our load (single concurrent
# concierge turn produces a handful of /score calls).
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first to maximise Docker layer cache hits when only app/ changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the package itself.
COPY app ./app

EXPOSE 8000

# Use 1 worker by default — bump via docker-compose `command` if needed.
# `--proxy-headers` lets us preserve client IP if we put a reverse proxy in front.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
