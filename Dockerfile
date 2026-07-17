FROM python:3.12-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfreetype6 libpng16-16 \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml README.md ./
COPY src ./src
COPY frontend/dist ./frontend/dist
RUN pip install --no-cache-dir -e .
ENV MPLBACKEND=Agg \
    FRAME2D_DB_PATH=/data/frame2d.sqlite3 \
    MPLCONFIGDIR=/tmp/matplotlib
EXPOSE 8002
CMD ["uvicorn", "frame2d.api:app", "--host", "0.0.0.0", "--port", "8002"]
