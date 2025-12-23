# elevenlabs_service.py — Deepgram TTS with retry logic and chunking

import os
import re
import time
from typing import List

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
DEFAULT_VOICE_MODEL = "aura-2-odysseus-en"
DEEPGRAM_SPEAK_URL = "https://api.deepgram.com/v1/speak"

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds - reduced for faster retries
# Max characters per TTS request (Deepgram handles up to ~2000 chars well)
MAX_CHUNK_SIZE = 1500
# Timeout configuration - aggressive timeouts for faster failure detection
CONNECT_TIMEOUT = 10  # seconds - connection timeout
READ_TIMEOUT = 45  # seconds - read timeout (reduced from 90)


def chunk_by_sentence(text: str) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if s.strip()]


def chunk_text_for_tts(text: str, max_size: int = MAX_CHUNK_SIZE) -> List[str]:
    """Split text into chunks at sentence boundaries, respecting max size."""
    sentences = chunk_by_sentence(text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) + 1 <= max_size:
            current_chunk = f"{current_chunk} {sentence}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = sentence
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks if chunks else [text]


def ensure_sentence_endings(text: str) -> str:
    txt = re.sub(r'\s+', ' ', text).strip()
    if txt and txt[-1] not in ".!?":
        txt += "."
    return txt


def test_deepgram_connectivity() -> bool:
    """Quick health check to verify Deepgram API is reachable"""
    try:
        session = create_session_with_retries()
        # Use a minimal test request
        resp = session.post(
            DEEPGRAM_SPEAK_URL,
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "application/json",
            },
            params={
                "model": DEFAULT_VOICE_MODEL,
                "encoding": "mp3",
                "bit_rate": "32000",
            },
            json={"text": "Test."},
            timeout=(5, 10),  # Quick timeout for health check
        )
        session.close()
        return resp.ok
    except Exception as e:
        print(f"[TTS] Connectivity test failed: {str(e)[:100]}")
        return False


def create_session_with_retries():
    """Create a requests session with retry logic and connection pooling"""
    session = requests.Session()
    retry_strategy = Retry(
        total=2,  # Reduced from 3 for faster failure
        backoff_factor=0.5,  # Faster backoff
        status_forcelist=[429, 500, 502, 503, 504],
        raise_on_status=False,  # Don't raise on retry-able status codes
    )
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,  # Connection pooling
        pool_maxsize=10,
        pool_block=False
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def call_deepgram(text: str, model: str) -> bytes:
    """Call Deepgram TTS API with retry logic"""
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "application/json",
    }
    params = {
        "model": model,
        "encoding": "mp3",
        "bit_rate": "32000",
    }
    
    session = create_session_with_retries()
    resp = session.post(
        DEEPGRAM_SPEAK_URL, 
        headers=headers, 
        params=params, 
        json={"text": text},
        timeout=90
    )
    
    if not resp.ok:
        raise RuntimeError(f"Deepgram error {resp.status_code}: {resp.text}")
    return resp.content


def generate_voice_from_text(text: str, voice_id: str = DEFAULT_VOICE_MODEL) -> bytes:
    """Generate voice from text using Deepgram TTS with retry logic and chunking for long texts"""
    if not text.strip():
        return b""
    
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY not configured")

    text = ensure_sentence_endings(text)
    
    # For shorter texts, process directly
    if len(text) <= MAX_CHUNK_SIZE:
        return _generate_single_chunk(text, voice_id)
    
    # For longer texts, chunk and concatenate
    print(f"[TTS] Text length ({len(text)} chars) exceeds {MAX_CHUNK_SIZE}, chunking...")
    chunks = chunk_text_for_tts(text)
    print(f"[TTS] Split into {len(chunks)} chunks")
    
    all_audio = b""
    for i, chunk in enumerate(chunks, 1):
        print(f"[TTS] Processing chunk {i}/{len(chunks)} ({len(chunk)} chars)...")
        chunk_audio = _generate_single_chunk(chunk, voice_id)
        all_audio += chunk_audio
        print(f"[TTS] Chunk {i} complete: {len(chunk_audio)} bytes")
    
    print(f"[TTS] ✅ All chunks processed. Total audio: {len(all_audio)} bytes")
    return all_audio


def _generate_single_chunk(text: str, voice_id: str) -> bytes:
    """Generate audio for a single text chunk with retries and optimized timeouts"""
    last_error = None
    session = create_session_with_retries()  # Reuse session across retries
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[TTS] Attempt {attempt}/{MAX_RETRIES}: Generating audio...")
            start_time = time.time()
            
            resp = session.post(
                DEEPGRAM_SPEAK_URL,
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": "application/json",
                },
                params={
                    "model": voice_id,
                    "encoding": "mp3",
                    "bit_rate": "32000",
                },
                json={"text": text},
                stream=False,
                timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),  # (connect, read) timeouts
            )
            
            elapsed = time.time() - start_time
            print(f"[TTS] Request completed in {elapsed:.2f}s")

            if not resp.ok:
                error_detail = resp.text[:200] if resp.text else "No error details"
                raise RuntimeError(f"Deepgram TTS error {resp.status_code}: {error_detail}")

            audio_bytes = resp.content
            
            if len(audio_bytes) < 100:
                raise RuntimeError(f"Audio response too small: {len(audio_bytes)} bytes")
            
            print(f"[TTS] ✅ Audio generated successfully: {len(audio_bytes)} bytes in {elapsed:.2f}s")
            session.close()
            return audio_bytes
            
        except requests.exceptions.Timeout as e:
            last_error = e
            timeout_type = "connection" if "connect" in str(e).lower() else "read"
            print(f"[TTS] ❌ Attempt {attempt} failed: {timeout_type} timeout after {CONNECT_TIMEOUT if timeout_type == 'connection' else READ_TIMEOUT}s")
            
        except requests.exceptions.RequestException as e:
            last_error = e
            print(f"[TTS] ❌ Attempt {attempt} failed: Network error - {str(e)[:100]}")
            
        except Exception as e:
            last_error = e
            print(f"[TTS] ❌ Attempt {attempt} failed: {str(e)[:100]}")
        
        # Retry logic with exponential backoff
        if attempt < MAX_RETRIES:
            retry_delay = RETRY_DELAY * attempt  # 1s, 2s, 3s
            print(f"[TTS] Retrying in {retry_delay}s...")
            time.sleep(retry_delay)
        else:
            print(f"[TTS] ❌ All {MAX_RETRIES} attempts exhausted")
    
    # Close session after all retries
    session.close()
    
    # Provide helpful error message
    error_msg = str(last_error)
    if "timeout" in error_msg.lower():
        raise RuntimeError(f"Deepgram TTS timeout after {MAX_RETRIES} attempts. API may be slow or unresponsive.")
    elif "connection" in error_msg.lower():
        raise RuntimeError(f"Cannot connect to Deepgram API after {MAX_RETRIES} attempts. Check network connectivity.")
    else:
        raise last_error
