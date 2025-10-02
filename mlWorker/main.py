import io
import subprocess
import tempfile

import pika
import psycopg2
import time
import json
import boto3
from PIL import Image
from botocore.client import Config
from dotenv import load_dotenv
import os

from yandex_gpt import build_entities
from vlm import load_model_and_processor, predict_one, DEFAULT_INSTRUCTION
from utils import bbox_corners
from make_paragraph import split_polygon_by_center_gap, line_polygons_to_paragraph_polygons

load_dotenv()

S3_BUCKET_NAME = "documents"


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


def recognize_text(file_content, mime_type, model, processor):
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_img:
        tmp_img.write(file_content)
        tmp_img_path = tmp_img.name

    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp_out:
        tmp_out_path = tmp_out.name

    try:
        subprocess.run(
            ["kraken", "-i", tmp_img_path, tmp_out_path, "segment", "-bl"],
            check=True
        )

        with open(tmp_out_path, "r", encoding="utf-8") as f:
            result = json.load(f)

        print(result)

    finally:
        os.remove(tmp_img_path)
        os.remove(tmp_out_path)

    # select polygons
    line_polys = []

    for box_meta in result['lines']:
        list_boundary = [list(x) for x in box_meta['boundary']]
        polygon = split_polygon_by_center_gap(list_boundary, 1000, 50)
        if polygon is None:
            line_polys.append(list_boundary)
        elif len(polygon) == 1:
            line_polys.append(polygon)
            line_polys[-1] = [[int(x[0]), int(x[1])] for x in line_polys[-1]]
        else:
            line_polys.extend(polygon)
            line_polys[-1] = [[int(x[0]), int(x[1])] for x in line_polys[-1]]
            line_polys[-2] = [[int(x[0]), int(x[1])] for x in line_polys[-2]]

    paragraph_polygons = line_polygons_to_paragraph_polygons(line_polys)

    img = Image.open(io.BytesIO(file_content))
    width, height = img.size

    output = {
        "result": {
            "textAnnotation": {
                "width": str(width),
                "height": str(height),
                "blocks": [],
                "fullText": "ф" * len(paragraph_polygons),
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

    full_text = ""

    for polygon in paragraph_polygons:
        bbox = bbox_corners(polygon)

        print((*bbox[0], *bbox[2]))
        cropped_img = img.crop((*bbox[0], *bbox[2]))

        out_text = predict_one(
            model, processor, cropped_img, DEFAULT_INSTRUCTION
        )

        full_text += out_text

        output["result"]["textAnnotation"]["blocks"].append({
            "boundingBox": {
                "vertices": [{"x": str(val[0]), "y": str(val[1])} for val in bbox]
            },
            "lines": [{
                "boundingBox": {
                    "vertices": [{"x": str(val[0]), "y": str(val[1])} for val in bbox],
                },
                "text": out_text,
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

    output['result']['textAnnotation']['fullText'] = full_text
    output['result']['entities'] = build_entities(full_text)['entities']

    print(output)

    return output


def connect_to_rabbitmq():
    while True:
        try:
            host = os.getenv("RABBITMQ_HOST", "localhost")
            port = int(os.getenv("RABBITMQ_PORT", 5672))
            user = os.getenv("RABBITMQ_USER", "guest")
            password = os.getenv("RABBITMQ_PASS", "guest")

            credentials = pika.PlainCredentials(user, password)
            params = pika.ConnectionParameters(host=host, port=port, credentials=credentials)

            connection = pika.BlockingConnection(params)
            print("Successfully connected to RabbitMQ")
            return connection
        except pika.exceptions.AMQPConnectionError:
            print("RabbitMQ not ready yet, waiting...")
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
    lora_path = '../../ml_worker/checkpoint-200/'
    model, processor = load_model_and_processor(
        model_path="./models/gemma-3-4b-it",
        lora_path=lora_path,
        merge_lora=True,
    )

    print("mlWorker started")
    s3_client = get_s3_client()
    rabbitmq_connection = connect_to_rabbitmq()
    postgres_connection = connect_to_postgres()
    conn_ref = {"conn": postgres_connection}

    channel = rabbitmq_connection.channel()
    channel.queue_declare(queue='doc_processing', durable=True)

    def callback(ch, method, properties, body):
        print("--------------------")
        message = json.loads(body.decode())
        doc_id = message.get('id')
        filepath = message.get('filepath').split('/')[-1]
        print(f" [x] Received message for document ID: {doc_id}")

        try:
            # 0. Check file type
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
                return  # Stop processing

            # 1. Update status to in-queue
            update_doc_status(conn_ref, doc_id, 'in-queue')

            # 2. Download file from S3
            print(f"Downloading {filepath} from S3...")
            response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=filepath)
            file_content = response['Body'].read()
            print("File downloaded.")

            # 3. Update status to processing and call OCR API
            print(f"Starting OCR processing for document {doc_id}...")
            update_doc_status(conn_ref, doc_id, 'processing')

            mime_type = supported_formats[file_ext]
            ocr_result = recognize_text(file_content, mime_type, model, processor)

            # 4. Finalize and update to done
            update_doc_status(conn_ref, doc_id, 'done', result=json.dumps(ocr_result))
            print(f"Finished processing for document {doc_id}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            print(f"Error processing document {doc_id}: {e}")
            try:
                update_doc_status(conn_ref, doc_id, 'fail', result=json.dumps({"error": str(e)}))
            finally:
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    channel.basic_consume(queue='doc_processing', on_message_callback=callback, auto_ack=False)

    print(' [*] Waiting for messages on "doc_processing" queue. To exit press CTRL+C')
    channel.start_consuming()


if __name__ == "__main__":
    main()
