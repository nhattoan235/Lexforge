"""Local-only speech recognition. Model download is a separate setup step."""
import io
import os
import threading
from pathlib import Path
from flask import Flask, Request, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge

MODEL_PATH = Path(__file__).resolve().parent / "models" / "small"

class MemoryRequest(Request):
    # Flask normally spools larger uploads to disk; keep microphone audio in RAM.
    def _get_file_stream(self, *args, **kwargs):
        return io.BytesIO()

def load_transcriber():
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    from faster_whisper import WhisperModel
    model = WhisperModel(str(MODEL_PATH), device="cpu", compute_type="int8", local_files_only=True)
    english_model = None
    english_path = MODEL_PATH.parent / "small.en"
    lock = threading.Lock()
    def transcribe(audio, language="en"):
        nonlocal english_model
        with lock:
            selected = model
            if language == "en" and english_path.is_dir():
                if english_model is None:
                    english_model = WhisperModel(str(english_path), device="cpu", compute_type="int8", local_files_only=True)
                selected = english_model
            segments, _ = selected.transcribe(audio, language=language, beam_size=1, vad_filter=True,
                                           condition_on_previous_text=False)
            return " ".join(segment.text.strip() for segment in segments).strip()
    return transcribe

def create_app(transcribe):
    app = Flask(__name__)
    app.request_class = MemoryRequest
    app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024
    CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000", "null"])

    @app.get("/health")
    def health():
        return jsonify(status="ok", service="faster-whisper", processing="local", model="small", ready=True)

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(error):
        return jsonify(success=False, error="Audio too large (maximum 8 MB).", errorCode="audio-too-large"), 413

    @app.post("/transcribe-blob")
    def transcribe_blob():
        if "audioBlob" not in request.files:
            return jsonify(success=False, error="No audio provided.", errorCode="invalid-audio"), 400
        with io.BytesIO(request.files["audioBlob"].read()) as audio:
            if not audio.getbuffer().nbytes:
                return jsonify(success=False, error="Empty audio.", errorCode="invalid-audio"), 400
            try:
                language = request.form.get("language", "en")
                if language not in ("en", "vi", "auto"):
                    return jsonify(success=False, error="Unsupported language.", errorCode="invalid-language"), 400
                text = transcribe(audio, None if language == "auto" else language)
            except Exception:
                # Do not log recordings or transcripts, including decoder error details.
                return jsonify(success=False, error="Cannot decode or recognize audio locally.", errorCode="transcription-error"), 500
        if not text:
            return jsonify(success=False, error="No speech detected.", errorCode="no-speech"), 400
        return jsonify(success=True, text=text)
    return app

if __name__ == "__main__":
    print("Loading local multilingual small model (CPU int8)...", flush=True)
    try:
        transcribe = load_transcriber()
    except Exception:
        raise SystemExit("Local model unavailable. Run .venv\\Scripts\\python.exe setup_speech_model.py first.")
    print("Local speech server ready: http://127.0.0.1:5000. Audio stays on this computer.", flush=True)
    create_app(transcribe).run(host="127.0.0.1", port=5000, debug=False)
