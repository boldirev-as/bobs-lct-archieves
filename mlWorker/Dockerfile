FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime


RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libpq-dev \
    git \
    git-lfs \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ../../ml_worker /app

RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install \
        "transformers>=4.43.0" \
        "accelerate>=0.33.0" \
        "bitsandbytes>=0.43.0" \
        "peft>=0.11.0" \
        "torchvision" \
        "Pillow" \
        "tqdm" \
        "boto3" \
        "pika" \
        "python-dotenv" \
        "psycopg2-binary" \
        "kraken>=4.3.14"

RUN kraken --version || true

VOLUME ["/app/models/", "/app/checkpoint-200/"]

CMD ["python", "-c", "main.py"]
