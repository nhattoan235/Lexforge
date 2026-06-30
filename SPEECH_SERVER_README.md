# Speech Recognition Backend Setup

## Overview

This backend uses **Google Cloud Speech-to-Text API** for speech-to-text conversion.

**Features:**
- ✅ Free: 60 minutes per month
- ✅ High accuracy
- ✅ Multiple language support
- ✅ No Python version dependencies

**Requirements:**
- Python 3.8+
- Google Cloud account (free tier)
- Service account credentials

## Installation

### 1. Create Google Cloud Project

1. Visit: https://console.cloud.google.com/
2. Sign up or log in with Google account
3. Click **"Create Project"**
4. Name it (e.g., "TOEIC App")
5. Click **"Create"**

### 2. Enable Speech-to-Text API

1. Search for **"Speech-to-Text API"**
2. Select it from results
3. Click **"Enable"**
4. Wait 1-2 minutes for activation

### 3. Create Service Account & Download Credentials

1. Go to **"Credentials"** (left menu)
2. Click **"Create Credentials"**
3. Select **"Service Account"**
4. Set name (e.g., "toeic-app")
5. Click **"Create and Continue"**
6. Click **"Continue"** (skip optional steps)
7. Click **"Go to service account"**
8. Go to **"Keys"** tab
9. Click **"Add Key"** → **"Create new key"**
10. Select **"JSON"**
11. Click **"Create"**
12. Save the JSON file to `d:\testAppTC\test2\toeic-app\`

### 4. Set Environment Variable

Create or edit `.env` file in this directory:

```
GOOGLE_APPLICATION_CREDENTIALS=D:\testAppTC\test2\toeic-app\google-credentials.json
```

Replace path with your actual credentials file path.

### 5. Install Python Dependencies

```bash
python -m pip install -r speech_requirements.txt
```

**Dependencies:**
- flask==2.3.3
- flask-cors==4.0.0
- google-cloud-speech==2.21.0
- python-dotenv==1.0.0

## Usage

### Start the Backend Server

```bash
python speech_server.py
```

**Expected output:**
```
🎤 Speech Recognition Server (Google Cloud Speech-to-Text)
============================================================
✅ Google Cloud Speech API configured
Free tier: 60 minutes/month
Starting on http://localhost:5000
Endpoint: POST /transcribe-blob
============================================================
```

### Start the Electron App

In a separate terminal:
```bash
npm run electron-dev
```

## How It Works

1. User clicks 🎤 button in AI Coach
2. Browser records audio (max 30 seconds)
3. Audio sent to Python backend
4. Backend sends to Google Cloud Speech API
5. Google Cloud returns transcribed text
6. Text appears in input field

## API Endpoints

### POST /transcribe-blob
- **FormData**: `audioBlob` field with audio data (WAV, MP3, etc.)
- **Returns**: `{success: true, text: "transcribed text"}` or error

### GET /health
- **Returns**: Server status and API availability

## Troubleshooting

### "Google Cloud Speech API not configured"
- Make sure `.env` file exists
- Verify GOOGLE_APPLICATION_CREDENTIALS path
- Restart the server after creating `.env`

### "Google Cloud credentials invalid"
- Check credentials JSON file path
- Verify file exists and is readable
- Download new credentials if needed

### "No module named 'google'"
- Install dependencies: `python -m pip install -r speech_requirements.txt`

### "Permission denied" when accessing microphone
- Windows: Settings → Privacy & Security → Microphone
- Allow the application to access microphone

### "API not found" or similar error
- Make sure Speech-to-Text API is enabled in Google Cloud Console
- Check project has billing enabled (free tier first)

## Performance

- **First request**: 2-3 seconds
- **Subsequent requests**: 1-2 seconds
- **Max audio**: 30 seconds per request

## Pricing - Free Tier!

Google Cloud Speech-to-Text offers:
- **Free tier**: 60 minutes per month
- **Paid**: $0.024 per 15 seconds (~$0.10/minute) after free tier

Examples:
- 10 seconds of audio within free tier = $0.00
- After 60 minutes/month: ~$0.016 per 10 seconds

---

## Comparison with Other Services

| Service | Free | Cost | Setup |
|---------|------|------|-------|
| Google Cloud Speech | ✅ 60 min/month | $0.024/15sec after | Medium |
| OpenAI Whisper | ❌ | $0.02/min | Simple |
| Azure Speech | ✅ 5 hours/month | $1/hour after | Medium |

---

## Support

For Google Cloud Speech-to-Text issues:
- Documentation: https://cloud.google.com/speech-to-text/docs
- Quotas & Limits: https://cloud.google.com/speech-to-text/quotas
- Pricing: https://cloud.google.com/speech-to-text/pricing

For server issues:
- Check Flask is running
- Verify internet connection
- Check credentials validity
