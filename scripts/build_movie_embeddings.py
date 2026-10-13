#!/usr/bin/env python3
"""
=============================================================================
CINEVERSE — OFFLINE MOVIE EMBEDDINGS GENERATION PIPELINE
=============================================================================
Extracts MovieDNA for all 10,000 catalog titles from MySQL, constructs the
structured semantic representation (Title, Type, Genres, Description, Year,
Series structure), and computes 384-dimensional normalized embeddings using
the local 'all-MiniLM-L6-v2' sentence-transformers model.

Outputs:
  - data/movie_embeddings.bin       (Fast binary cache: content_ids + float32 vectors)
  - data/movie_embeddings_meta.json (Model metadata, dimensions, and integrity checks)
=============================================================================
"""

import os
import sys

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import json
import struct
import time
import numpy as np
from datetime import datetime
from dotenv import load_dotenv
import mysql.connector
from sentence_transformers import SentenceTransformer

# Load environment from backend/.env
env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(env_path)

DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT = int(os.getenv('DB_PORT', '3306'))
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'project')

MODEL_NAME = 'all-MiniLM-L6-v2'
EMBEDDING_DIM = 384
BATCH_SIZE = 128

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(DATA_DIR, exist_ok=True)
BIN_OUTPUT_PATH = os.path.join(DATA_DIR, 'movie_embeddings.bin')
META_OUTPUT_PATH = os.path.join(DATA_DIR, 'movie_embeddings_meta.json')


def build_semantic_text(dna: dict) -> str:
    """
    Constructs a clean, structured semantic text representation from MovieDNA.
    Focuses strictly on STORY, THEMES, CONTENT, and FORMAT.
    Explicitly excludes rating, platform, runtime (which are handled by dedicated scoring features).
    """
    title = dna.get('title', 'Unknown Title')
    content_type = dna.get('type', 'Movie')
    genres = dna.get('genres', [])
    genre_str = ', '.join(genres) if genres else 'Unclassified'
    desc = dna.get('description') or 'No synopsis available.'
    year = dna.get('release_year') or 'Unknown'

    lines = [
        f"Title:\n{title}",
        f"Type:\n{content_type}",
        f"Genres:\n{genre_str}",
        f"Description:\n{desc}",
        f"Year:\n{year}"
    ]

    # For series, add structural context if available
    if content_type == 'Series':
        meta = dna.get('series_metadata') or {}
        parts = []
        if meta.get('total_seasons'):
            parts.append(f"{meta['total_seasons']} seasons")
        if meta.get('total_episodes'):
            parts.append(f"{meta['total_episodes']} episodes")
        if meta.get('avg_episode_duration'):
            parts.append(f"approx {meta['avg_episode_duration']} min per episode")
        if parts:
            lines.append(f"Format:\n{', '.join(parts)}")

    return '\n\n'.join(lines)


def main():
    print("=" * 70)
    print("[CINEVERSE] OFFLINE MOVIE EMBEDDINGS GENERATION PIPELINE")
    print("=" * 70)
    start_time = time.time()

    # 1. Connect to MySQL and fetch Movie DNA
    print(f"\n[1/4] Connecting to MySQL database '{DB_NAME}' at {DB_HOST}:{DB_PORT}...")
    conn = mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    cursor = conn.cursor(dictionary=True)

    print("Fetching MovieDNA records from 'content_dna'...")
    cursor.execute("SELECT content_id, dna_json FROM content_dna ORDER BY content_id ASC")
    rows = cursor.fetchall()
    total_records = len(rows)
    print(f">> Retrieved {total_records} MovieDNA records.")
    cursor.close()
    conn.close()

    if total_records == 0:
        print("[ERROR] content_dna table is empty! Run build_movie_dna.js first.")
        sys.exit(1)

    # 2. Build semantic texts
    print("\n[2/4] Constructing structured semantic representations...")
    content_ids = []
    semantic_texts = []
    for row in rows:
        dna = row['dna_json']
        if isinstance(dna, str):
            dna = json.loads(dna)
        cid = row['content_id']
        content_ids.append(cid)
        semantic_texts.append(build_semantic_text(dna))

    print(f"✓ Built semantic texts for {len(semantic_texts)} titles.")
    print("Sample representation for content_id", content_ids[0], ":")
    print("-" * 50)
    print(semantic_texts[0][:300] + "...")
    print("-" * 50)

    # 3. Load embedding model and encode in batches
    print(f"\n[3/4] Loading local embedding model '{MODEL_NAME}'...")
    model = SentenceTransformer(MODEL_NAME)
    print(f"✓ Model loaded (dimension: {EMBEDDING_DIM}). Generating embeddings in batches of {BATCH_SIZE}...")

    embeddings = model.encode(
        semantic_texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        normalize_embeddings=True  # Unit vectors for fast dot-product cosine similarity
    )
    embeddings = np.array(embeddings, dtype=np.float32)
    print(f">> Generated embedding matrix shape: {embeddings.shape}")

    # 4. Save binary cache and metadata
    print(f"\n[4/4] Writing binary cache to: {BIN_OUTPUT_PATH}")
    # Binary layout:
    # Header: Magic 4B ('CIN1') + count (int32) + dim (int32)
    # content_ids: count * int32
    # vectors: count * dim * float32
    with open(BIN_OUTPUT_PATH, 'wb') as f:
        f.write(b'CIN1')
        f.write(struct.pack('<ii', total_records, EMBEDDING_DIM))
        for cid in content_ids:
            f.write(struct.pack('<i', int(cid)))
        f.write(embeddings.tobytes())

    bin_size_mb = os.path.getsize(BIN_OUTPUT_PATH) / (1024 * 1024)
    print(f">> Binary cache written ({bin_size_mb:.2f} MB).")

    meta = {
        'model_name': MODEL_NAME,
        'embedding_dimension': EMBEDDING_DIM,
        'total_records': total_records,
        'normalized': True,
        'metric': 'cosine',
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'binary_file': 'movie_embeddings.bin',
        'binary_size_bytes': os.path.getsize(BIN_OUTPUT_PATH),
        'first_content_id': content_ids[0],
        'last_content_id': content_ids[-1]
    }
    with open(META_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)

    elapsed = time.time() - start_time
    print(f">> Metadata written to: {META_OUTPUT_PATH}")
    print("\n" + "=" * 70)
    print(f"[SUCCESS] OFFLINE EMBEDDINGS COMPLETE in {elapsed:.2f}s ({total_records/elapsed:.1f} titles/sec)")
    print("=" * 70)


if __name__ == '__main__':
    main()
