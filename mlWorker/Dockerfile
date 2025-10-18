FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Библиотеки для Pillow/torchvision (jpeg/png/zlib/BLAS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl ca-certificates \
    libjpeg62-turbo-dev zlib1g-dev libpng-dev libopenblas-dev \
 && rm -rf /var/lib/apt/lists/*

# ВАЖНО: ставим torch и torchvision ОДНОЙ командой и с cpu-индекса
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.4.1 torchvision==0.19.1

# Остальные зависимости из requirements.txt
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
 && pip check


WORKDIR /app
COPY . .

CMD ["python", "main.py"]
