# elevenlabs_service.py — Deepgram TTS with retry logic

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
RETRY_DELAY = 2  # seconds


def chunk_by_sentence(text: str) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if s.strip()]


def ensure_sentence_endings(text: str) -> str:
    txt = re.sub(r'\s+', ' ', text).strip()
    if txt and txt[-1] not in ".!?":
        txt += "."
    return txt


def create_session_with_retries():
    """Create a requests session with retry logic"""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
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
        timeout=60
    )
    
    if not resp.ok:
        raise RuntimeError(f"Deepgram error {resp.status_code}: {resp.text}")
    return resp.content


def generate_voice_from_text(text: str, voice_id: str = DEFAULT_VOICE_MODEL) -> bytes:
    """Generate voice from text using Deepgram TTS with retry logic"""
    if not text.strip():
        return b""

    text = ensure_sentence_endings(text)
    
    last_error = None
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[TTS] Attempt {attempt}/{MAX_RETRIES}: Generating audio...")
            
            # Use non-streaming request for reliability
            session = create_session_with_retries()
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
                stream=False,  # Don't stream - get full response
                timeout=60,    # Longer timeout for TTS
            )

            if not resp.ok:
                raise RuntimeError(f"Deepgram TTS error {resp.status_code}: {resp.text}")

            audio_bytes = resp.content
            
            if len(audio_bytes) < 100:
                raise RuntimeError(f"Audio response too small: {len(audio_bytes)} bytes")
            
            print(f"[TTS] ✅ Audio generated successfully: {len(audio_bytes)} bytes")
            return audio_bytes
            
        except Exception as e:
            last_error = e
            print(f"[TTS] ❌ Attempt {attempt} failed: {str(e)}")
            
            if attempt < MAX_RETRIES:
                print(f"[TTS] Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
    
    # All retries failed
    print(f"[TTS] ❌ All {MAX_RETRIES} attempts failed")
    raise last_error
