import uuid
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import FastAPI, UploadFile, File, HTTPException
import pika
import psycopg2
import os
from psycopg2 import OperationalError
from psycopg2.errors import DuplicateObject
import json
import time

S3_BUCKET_NAME = "documents"

app = FastAPI()

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url='http://minio:9000',
        aws_access_key_id=os.getenv('MINIO_ROOT_USER'),
        aws_secret_access_key=os.getenv('MINIO_ROOT_PASSWORD'),
        config=Config(signature_version='s3v4')
    )

def init_s3():
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=S3_BUCKET_NAME)
        print(f"S3 bucket '{S3_BUCKET_NAME}' already exists.")
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            s3.create_bucket(Bucket=S3_BUCKET_NAME)
            print(f"S3 bucket '{S3_BUCKET_NAME}' created.")
        else:
            raise

    # Set bucket policy to allow public read
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": "*",
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{S3_BUCKET_NAME}/*"]
            }
        ]
    }
    s3.put_bucket_policy(Bucket=S3_BUCKET_NAME, Policy=json.dumps(policy))
    print(f"Public read policy set for bucket '{S3_BUCKET_NAME}'.")

def init_db():
    # Wait for PostgreSQL to be ready
    print("Waiting for PostgreSQL to be ready...")
    for i in range(30):  # Try for 30 seconds
        conn = get_db_connection()
        if conn:
            break
        print(f"Attempt {i+1}/30: PostgreSQL not ready, waiting 1 second...")
        time.sleep(1)
    
    if not conn:
        # Server will fail to start if it cannot connect to DB
        raise Exception("Could not connect to database to initialize tables.")
    
    with conn.cursor() as cur:
        # Create custom ENUM type for document status if it doesn't exist
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
                    CREATE TYPE document_status AS ENUM ('uploading', 'in-queue', 'processing', 'done', 'fail');
                END IF;
            END$$;
        """)
        print("Checked for document_status type.")
        
        # Create documents table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filepath TEXT NOT NULL,
                hash TEXT NOT NULL,
                status document_status NOT NULL,
                result JSONB
            );
        """)
        print("Table 'documents' is ready.")
    
    conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_event():
    print("Application startup: Initializing S3...")
    init_s3()
    print("S3 initialization complete.")
    print("Application startup: Initializing database...")
    init_db()
    print("Database initialization complete.")

def get_db_connection():
    try:
        # Debug: print environment variables
        print(f"POSTGRES_USER: {os.getenv('POSTGRES_USER', 'user')}")
        print(f"POSTGRES_PASSWORD: {os.getenv('POSTGRES_PASSWORD', 'password')}")
        print(f"POSTGRES_DB: {os.getenv('POSTGRES_DB', 'db')}")
        
        conn = psycopg2.connect(
            dbname=os.getenv('POSTGRES_DB', 'db'),
            user=os.getenv('POSTGRES_USER', 'user'),
            password=os.getenv('POSTGRES_PASSWORD', 'password'),
            host='postgres'
        )
        return conn
    except OperationalError as e:
        print(f"Could not connect to PostgreSQL database: {e}")
        return None

@app.post("/upload-doc")
async def upload_doc(file: UploadFile = File(...)):
    doc_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    filepath = f"{doc_id}{file_extension}"
    
    # 1. Upload to S3
    s3 = get_s3_client()
    try:
        s3.upload_fileobj(file.file, S3_BUCKET_NAME, filepath)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {e}")

    # 2. Create DB record
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (id, filepath, hash, status) VALUES (%s, %s, %s, %s)",
            (doc_id, filepath, doc_id, 'uploading')
        )
    conn.commit()
    conn.close()

    # 3. Send message to RabbitMQ
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters('rabbitmq'))
        channel = connection.channel()
        channel.queue_declare(queue='doc_processing', durable=True)
        message = {
            "id": doc_id,
            "filepath": filepath,
            "hash": doc_id
        }
        channel.basic_publish(exchange='',
                              routing_key='doc_processing',
                              body=json.dumps(message).encode(),
                              properties=pika.BasicProperties(delivery_mode=2))
        connection.close()
    except pika.exceptions.AMQPConnectionError:
        # Here we should ideally handle the failure, e.g., by setting doc status to 'fail'
        raise HTTPException(status_code=500, detail="Could not send message to the processing queue")

    return {"id": doc_id}

@app.get("/recognition-status/{doc_id}")
def recognition_status(doc_id: str):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    with conn.cursor() as cur:
        cur.execute("SELECT id, status, filepath, result FROM documents WHERE id = %s", (doc_id,))
        doc = cur.fetchone()
    
    conn.close()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": doc[0],
        "status": doc[1],
        "filepath": f"/s3/{S3_BUCKET_NAME}/{doc[2]}",
        "result": doc[3]
    }

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/send-message/{message}")
def send_message(message: str):
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters('rabbitmq'))
        channel = connection.channel()
        channel.queue_declare(queue='hello')
        channel.basic_publish(exchange='',
                              routing_key='hello',
                              body=message.encode())
        connection.close()
        return {"status": "Message sent", "message": message}
    except pika.exceptions.AMQPConnectionError:
        return {"status": "error", "message": "Could not connect to RabbitMQ"}

@app.get("/db-check")
def db_check():
    conn = get_db_connection()
    if conn:
        conn.close()
        return {"status": "Successfully connected to PostgreSQL"}
    else:
        return {"status": "Failed to connect to PostgreSQL"}
