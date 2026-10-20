import io
import unittest
from speech_server import create_app

class LocalSpeechTests(unittest.TestCase):
    def setUp(self):
        self.received = []
        def transcribe(audio, language="en"):
            self.received.append(audio.read())
            return 'Hello, I am practicing English.'
        self.client = create_app(transcribe).test_client()

    def test_audio_is_passed_in_memory_to_local_transcriber(self):
        response = self.client.post('/transcribe-blob', data={'audioBlob': (io.BytesIO(b'webm-test'), 'audio.webm')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['text'], 'Hello, I am practicing English.')
        self.assertEqual(self.received, [b'webm-test'])

    def test_missing_and_empty_uploads_are_rejected(self):
        self.assertEqual(self.client.post('/transcribe-blob').status_code, 400)
        self.assertEqual(self.client.post('/transcribe-blob', data={'audioBlob': (io.BytesIO(b''), 'audio.webm')}).status_code, 400)
        self.assertEqual(self.received, [])

    def test_silence_has_no_speech_error(self):
        client = create_app(lambda audio, language: '').test_client()
        response = client.post('/transcribe-blob', data={'audioBlob': (io.BytesIO(b'audio'), 'audio.webm')})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['errorCode'], 'no-speech')

    def test_transcriber_failure_does_not_leak_details(self):
        def fail(audio, language):
            raise RuntimeError('private recording details')
        client = create_app(fail).test_client()
        response = client.post('/transcribe-blob', data={'audioBlob': (io.BytesIO(b'audio'), 'audio.webm')})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private recording details', response.get_data(as_text=True))

    def test_large_audio_is_rejected_before_transcription(self):
        response = self.client.post('/transcribe-blob', data=b'x' * (8 * 1024 * 1024 + 1), content_type='multipart/form-data; boundary=test')
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.received, [])

    def test_auto_language_uses_local_detection_and_invalid_values_are_rejected(self):
        languages = []
        client = create_app(lambda audio, language: languages.append(language) or 'Xin chào').test_client()
        response = client.post('/transcribe-blob', data={'language': 'auto', 'audioBlob': (io.BytesIO(b'audio'), 'audio.webm')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(languages, [None])
        invalid = client.post('/transcribe-blob', data={'language': 'remote', 'audioBlob': (io.BytesIO(b'audio'), 'audio.webm')})
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(languages, [None])

    def test_health_identifies_local_processing(self):
        self.assertEqual(self.client.get('/health').json['processing'], 'local')

if __name__ == '__main__':
    unittest.main()
