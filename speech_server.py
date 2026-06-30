#!/usr/bin/env python3
"""
Speech Recognition Backend using Google Cloud Speech-to-Text API
Free tier: 60 minutes per month
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import speech
from google.api_core import gapic_v1
import os
import io
from werkzeug.utils import secure_filename
import tempfile
import traceback
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()

# Initialize Google Cloud Speech client
try:
    speech_client = speech.SpeechClient()
    google_available = True
except Exception as e:
    print(f"⚠️ Google Cloud Speech client initialization failed: {e}")
    print("   Make sure GOOGLE_APPLICATION_CREDENTIALS is set")
    google_available = False
    speech_client = None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    status = "✅" if google_available else "❌"
    return jsonify({
        'status': 'ok',
        'service': 'Speech Recognition (Google Cloud)',
        'api_available': status
    })

@app.route('/transcribe-blob', methods=['POST'])
def transcribe_blob():
    """
    Transcribe audio using Google Cloud Speech-to-Text API
    Expected: 'audioBlob' in request.files
    Returns: JSON with transcribed text or error
    """
    if not google_available:
        return jsonify({
            'success': False,
            'error': 'Google Cloud Speech API not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable.',
            'errorCode': 'api-not-available'
        }), 500

    try:
        if 'audioBlob' not in request.files:
            return jsonify({'error': 'No audio blob provided'}), 400

        audio_file = request.files['audioBlob']
        audio_data = audio_file.read()

        if not audio_data:
            return jsonify({'error': 'Empty audio file'}), 400

        try:
            # Prepare audio for Google Cloud Speech API
            audio = speech.RecognitionAudio(content=audio_data)
            
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=48000,
                language_code='en-US',
                use_enhanced=False,  # Free tier doesn't support enhanced
            )

            # Call Google Cloud Speech-to-Text API
            response = speech_client.recognize(config=config, audio=audio)

            # Extract transcribed text
            transcript = ""
            if response.results:
                for result in response.results:
                    if result.alternatives:
                        transcript += result.alternatives[0].transcript + " "
            
            transcript = transcript.strip()
            
            if not transcript:
                return jsonify({
                    'success': False,
                    'error': 'No speech detected',
                    'errorCode': 'no-speech'
                }), 400

            return jsonify({
                'success': True,
                'text': transcript
            })

        except Exception as api_err:
            error_msg = str(api_err)
            print(f"Google API Error: {error_msg}")
            
            if 'UNAUTHENTICATED' in error_msg or 'permission' in error_msg.lower():
                return jsonify({
                    'success': False,
                    'error': 'Google Cloud credentials invalid. Check GOOGLE_APPLICATION_CREDENTIALS.',
                    'errorCode': 'auth-error'
                }), 401
            
            elif 'RESOURCE_EXHAUSTED' in error_msg or 'quota' in error_msg.lower():
                return jsonify({
                    'success': False,
                    'error': 'Google Cloud Speech API quota exceeded. Free tier: 60 min/month.',
                    'errorCode': 'quota-exceeded'
                }), 429
            
            else:
                return jsonify({
                    'success': False,
                    'error': f'Google Cloud API error: {error_msg}',
                    'errorCode': 'api-error'
                }), 500

    except Exception as e:
        print(f"Error: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e),
            'errorCode': 'server-error'
        }), 500

if __name__ == '__main__':
    print("🎤 Speech Recognition Server (Google Cloud Speech-to-Text)")
    print("=" * 60)
    
    if google_available:
        print("✅ Google Cloud Speech API configured")
    else:
        print("❌ Google Cloud Speech API NOT configured")
        print("   Setup instructions:")
        print("   1. Create Google Cloud project")
        print("   2. Enable Speech-to-Text API")
        print("   3. Create service account & download credentials")
        print("   4. Set: $env:GOOGLE_APPLICATION_CREDENTIALS='path/to/credentials.json'")
        print("   5. Restart this server")
    
    print()
    print("Free tier: 60 minutes/month")
    print("Starting on http://localhost:5000")
    print("Endpoint: POST /transcribe-blob")
    print("=" * 60)
    print()
    
    app.run(host='127.0.0.1', port=5000, debug=False)


