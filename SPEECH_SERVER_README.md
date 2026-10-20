# Local speech recognition

Audio is processed by faster-whisper small (multilingual) on this computer (CPU int8).
There is no Google/Groq audio API, cloud fallback, recording file, or transcript log.
The server binds only to 127.0.0.1:5000. Uploads stay in memory (maximum 8 MB).
In Speaking mode, automatic Groq grammar checks are disabled. Pressing Send still
sends the recognized text and chat context to Groq for the conversation reply.

## One-time setup (Windows)

```bat
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r speech_requirements.txt
.venv\Scripts\python.exe setup_speech_model.py
```

Only the setup step downloads model files from Hugging Face into models/small.
The recognition server loads local files only, with Hugging Face offline mode enabled.
No API key, billing account, or CUDA installation is required for speech recognition.

## Run

Double-click start_speech_server.bat, then run npm run electron-dev in another terminal.
In AI Coach choose Luyen Noi, start a session, record up to 30 seconds. Silero VAD automatically stops after about 1.8 seconds
of silence following valid speech; manual stop remains available.
Wait for local transcription, review the text, and press Send if you want Groq to reply.
Keep the server window open while using the microphone.

GET http://127.0.0.1:5000/health reports processing=local and ready=true.
Recognition can take several seconds on CPU. Quality depends on microphone/noise/accent.
This converts speech to text; it does not score pronunciation.

## Checks

```bat
.venv\Scripts\python.exe -m unittest discover -v
npx tsc --noEmit
```

VAD assets are copied from npm dependencies into public/vad by prestart/prebuild.
They are served locally, without CDN requests. Run npm test -- --watchAll=false --runInBand
for the silence timing tests.

Notes request automatic language detection. AI Coach requests English; when an existing
models/small.en is present it remains the English recognizer. All models load locally.
