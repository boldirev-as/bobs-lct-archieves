import io
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

import boto3
import pika
import psycopg2
import torch
import torch.nn.functional as F
from PIL import Image
from botocore.client import Config
from dotenv import load_dotenv
from openai import OpenAI
from tqdm import tqdm
from transformers import VisionEncoderDecoderModel, TrOCRProcessor

from kraken import blla
from kraken.lib import vgsl
from utils import crop_line, bbox_corners

load_dotenv()

S3_BUCKET_NAME = "documents"
executor = ThreadPoolExecutor(max_workers=2)

device = "cuda:0" if torch.cuda.is_available() else "cpu"


def log_pg_env():
    print("PG env:",
          {"host": os.getenv("POSTGRES_HOST"),
           "port": os.getenv("POSTGRES_PORT", "5432"),
           "db": os.getenv("POSTGRES_DB"),
           "user": os.getenv("POSTGRES_USER")})


def log_pg_identity(conn):
    with conn.cursor() as c:
        c.execute("select current_user, current_database(), inet_server_addr(), inet_server_port();")
        print("PG identity:", c.fetchone())


def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=f"{os.getenv('MINIO_ROOT_HOST')}:9000",
        aws_access_key_id=os.getenv('MINIO_ROOT_USER'),
        aws_secret_access_key=os.getenv('MINIO_ROOT_PASSWORD'),
        config=Config(signature_version='s3v4')
    )


def recognize_text(file_content, mime_type, model, processor, model_kraken):
    img = Image.open(io.BytesIO(file_content))
    width, height = img.size
    print("Starting kraken")
    seg_result = blla.segment(img, device=device, model=model_kraken)
    line_polys = [m.boundary for m in seg_result.lines]
    print("kraken completed", len(line_polys))

    crops = [crop_line(img, p, i) for i, p in enumerate(line_polys, start=1)]
    selected_line_polys = []
    selected_crops = []

    for i, crop in enumerate(crops):
        if crop.size[0] > 20:
            selected_crops.append(crop)
            selected_line_polys.append(line_polys[i])

    output = {
        "result": {
            "textAnnotation": {
                "width": str(width),
                "height": str(height),
                "blocks": [],
                "fullText": "",
                "entities": [],
                "tables": [],
                "rotate": "ANGLE_0",
                "markdown": "",
                "pictures": []
            },
            "pageNumber": 1,
            "type": "дело"
        }
    }

    bs = 4
    texts = []
    conf_per_image = []

    eos_id = None
    # пробуем взять из токенайзера или из конфигурации генерации
    if hasattr(processor, "tokenizer") and getattr(processor.tokenizer, "eos_token_id", None) is not None:
        eos_id = processor.tokenizer.eos_token_id
    elif getattr(model, "generation_config", None) is not None:
        eos_id = model.generation_config.eos_token_id

    def _normalize_eos(eos_id):
        if eos_id is None:
            return None
        if isinstance(eos_id, (list, tuple)):
            return eos_id[0] if len(eos_id) > 0 else None
        return eos_id

    eos_id = _normalize_eos(eos_id)

    with torch.inference_mode():
        for i in tqdm(range(0, len(selected_crops), bs)):
            batch = selected_crops[i:i + bs]
            inputs = processor(images=batch, return_tensors="pt", padding=True)
            pixel_values = inputs.pixel_values.to(device, non_blocking=True)
            out = model.generate(
                pixel_values,
                use_cache=True,
                num_beams=15,
                length_penalty=1.0,
                no_repeat_ngram_size=2,
                early_stopping=True,
                return_dict_in_generate=True,
                output_scores=True,
                num_return_sequences=8
            )

            best = out.sequences.view(-1, 8, out.sequences.size(-1))[:, 0, :]
            texts.extend(processor.batch_decode(best, skip_special_tokens=True))

            T = len(out.scores)
            BN = out.sequences.size(0)  # B * 8
            V = out.scores[0].size(-1)

            # [T, BN, V]
            step_logits = torch.stack(out.scores, dim=0).float()  # cast to float32 for stability
            step_logprobs = F.log_softmax(step_logits, dim=-1)  # [T, BN, V]

            # tokens generated on steps 0..T-1: [BN, T]
            token_ids = out.sequences[:, :T]

            # gather log p(token_t) for each step: [T, BN]
            gathered = torch.gather(step_logprobs, 2, token_ids.T.unsqueeze(-1)).squeeze(-1)  # [T, BN]

            # --- length computation (unchanged) ---
            if eos_id is not None:
                eos_mask = (token_ids == eos_id)  # [BN, T]
                has_eos = eos_mask.any(dim=1)
                first_eos = torch.where(
                    has_eos,
                    eos_mask.float().argmax(dim=1) + 1,  # include EOS
                    torch.full((token_ids.size(0),), T, device=token_ids.device, dtype=torch.long)
                )  # [BN]
                lengths = first_eos
            else:
                lengths = torch.full((token_ids.size(0),), T, device=token_ids.device, dtype=torch.long)

            arange_T = torch.arange(T, device=token_ids.device)
            mask = (arange_T.unsqueeze(0) < lengths.unsqueeze(1))  # [BN, T] (bool)

            # ---- SAFE masking (avoid 0 * -inf) ----
            gathered_bt = gathered.T  # [BN, T]
            gathered_bt = gathered_bt.masked_fill(~mask, 0.0)  # replace masked positions by 0

            sum_logp = gathered_bt.sum(dim=1)  # [BN]
            avg_logp = sum_logp / lengths.clamp_min(1)  # [BN]
            conf_all = avg_logp.exp()

            B = pixel_values.size(0)  # batch size
            conf_all = conf_all.view(B, 8)  # [batch, num_return_sequences]
            conf_best = 100 - (conf_all[:, 0] + 0.1)

            conf_per_image.extend(conf_best.tolist())
            print(i)

    for i, polygon in enumerate(selected_line_polys):
        bbox = bbox_corners(polygon)

        output["result"]["textAnnotation"]["blocks"].append({
            "boundingBox": {
                "vertices": [{"x": str(val[0]), "y": str(val[1])} for val in bbox]
            },
            "lines": [{
                "boundingBox": {
                    "vertices": [{"x": str(val[0]), "y": str(val[1])} for val in bbox],
                },
                "text": texts[i],
                "confidence": conf_per_image[i],
                "words": [],
                "entityIndex": "-1",
                "textSegments": [
                    {
                        "startIndex": "0",
                        "length": "1"
                    }
                ],
                "orientation": "ANGLE_0"
            }],
            "textSegments": [
                {
                    "startIndex": "0",
                    "length": "1"
                }
            ],
        })

    raw_text = "\n".join(texts)

    output['result']['textAnnotation']['fullText'] = raw_text
    output['result']['entities'] = []

    print(output)

    return output


def connect_to_rabbitmq():
    while True:
        try:
            credentials = pika.PlainCredentials(
                os.getenv("RABBITMQ_USER", "guest"),
                os.getenv("RABBITMQ_PASS", "guest"),
            )
            params = pika.ConnectionParameters(
                host=os.getenv("RABBITMQ_HOST", "localhost"),
                port=int(os.getenv("RABBITMQ_PORT", "5672")),
                virtual_host=os.getenv("RABBITMQ_VHOST", "/"),
                credentials=credentials,
                heartbeat=120,
                blocked_connection_timeout=300,
                connection_attempts=3,
                retry_delay=2,
            )
            conn = pika.BlockingConnection(params)
            print("Successfully connected to RabbitMQ")
            return conn
        except pika.exceptions.AMQPConnectionError as e:
            print(f"RabbitMQ not ready yet, waiting... ({e})")
            time.sleep(5)


def connect_to_postgres():
    while True:
        try:
            log_pg_env()
            conn = psycopg2.connect(
                dbname=os.getenv('POSTGRES_DB', 'db'),
                user=os.getenv('POSTGRES_USER', 'user'),
                password=os.getenv('POSTGRES_PASSWORD', 'password'),
                host=os.getenv('POSTGRES_HOST', 'postgres'),
                port=int(os.getenv('POSTGRES_PORT', '5432')),
                connect_timeout=10,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=3
            )
            conn.autocommit = True
            print("Successfully connected to PostgreSQL")
            log_pg_identity(conn)
            return conn
        except psycopg2.OperationalError:
            print("PostgreSQL not ready yet, waiting...")
            time.sleep(5)


import random
from psycopg2 import OperationalError, InterfaceError, errors

RETRIABLE_PG_ERRORS = (
    OperationalError,
    InterfaceError,
    errors.DeadlockDetected,
    errors.SerializationFailure,
    errors.TransactionRollbackError,
    errors.InFailedSqlTransaction,
)


def update_doc_status(conn_ref, doc_id, status, result=None, retries=5, base_delay=0.2):
    payload = (status, result, doc_id) if result is not None else (status, doc_id)
    sql = "UPDATE documents SET status = %s, result = %s WHERE id = %s" if result is not None \
        else "UPDATE documents SET status = %s WHERE id = %s"

    for attempt in range(retries + 1):
        try:
            with conn_ref["conn"].cursor() as cur:
                cur.execute(sql, payload)
            print(f"Updated document {doc_id} -> '{status}'")
            return
        except RETRIABLE_PG_ERRORS as e:
            print(f"PG write failed ({type(e).__name__}: {e}). Reconnecting... [{attempt + 1}/{retries}]")

            try:
                conn_ref["conn"].close()
            except Exception:
                pass
            conn_ref["conn"] = connect_to_postgres()

            if attempt < retries:
                delay = base_delay * (2 ** attempt) + random.uniform(0, base_delay)
                time.sleep(delay)
                continue
            else:
                break
    raise RuntimeError("Failed to update document status after retries")


def main():
    model = VisionEncoderDecoderModel.from_pretrained("Kansallisarkisto/cyrillic-htr-model").to(device).eval()
    processor = TrOCRProcessor.from_pretrained(
        "Kansallisarkisto/cyrillic-htr-model",
        subfolder="processor",
        use_fast=True
    )

    model_kraken = vgsl.TorchVGSLModel.load_model('kraken/blla.mlmodel')

    print("mlWorker started")
    s3_client = get_s3_client()
    rabbitmq_connection = connect_to_rabbitmq()
    postgres_connection = connect_to_postgres()
    conn_ref = {"conn": postgres_connection}

    channel = rabbitmq_connection.channel()
    channel.queue_declare(queue='doc_processing', durable=True)
    channel.basic_qos(prefetch_count=1)

    def callback(ch, method, properties, body):
        print("--------------------")
        message = json.loads(body.decode())
        doc_id = message.get('id')
        filepath = message.get('filepath').split('/')[-1]
        print(f" [x] Received message for document ID: {doc_id}")

        # try:
        supported_formats = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
        }
        file_ext = os.path.splitext(filepath)[1].lower()

        if file_ext not in supported_formats:
            error_message = f"Unsupported file type: {file_ext}. Supported formats are {list(supported_formats.keys())}"
            print(error_message)
            update_doc_status(conn_ref, doc_id, 'fail', result=json.dumps({"error": error_message}))
            return

        update_doc_status(conn_ref, doc_id, 'in-queue')

        print(f"Downloading {filepath} from S3...")
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=filepath)
        file_content = response['Body'].read()
        print("File downloaded.")

        print(f"Starting OCR processing for document {doc_id}...")
        update_doc_status(conn_ref, doc_id, 'processing')

        mime_type = supported_formats[file_ext]
        future = executor.submit(recognize_text, file_content, mime_type, model, processor, model_kraken)

        try:
            while not future.done():
                ch.connection.process_data_events(time_limit=1)
                time.sleep(0.1)
            ocr_result = future.result()
        except Exception as task_err:
            raise task_err

        update_doc_status(conn_ref, doc_id, 'done', result=json.dumps(ocr_result))
        print(f"Finished processing for document {doc_id}")
        ch.basic_ack(delivery_tag=method.delivery_tag)

        # except Exception as e:
        #     print(f"Error processing document {doc_id}: {e}")
        #     try:
        #         update_doc_status(conn_ref, doc_id, 'fail', result=json.dumps({"error": str(e)}))
        #     finally:
        #         try:
        #             ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        #         except pika.exceptions.StreamLostError:
        #             pass

    channel.basic_consume(queue='doc_processing', on_message_callback=callback, auto_ack=False)

    print(' [*] Waiting for messages on "doc_processing" queue. To exit press CTRL+C')
    channel.start_consuming()


if __name__ == "__main__":
    main()
