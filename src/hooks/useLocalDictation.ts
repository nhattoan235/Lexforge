import { useState, useRef, useEffect } from 'react';
import { startLocalVad } from '../services/localVad';
import { speechService } from '../services/speech';
import { notify } from '../components/Feedback/ToastHost';

export function useLocalDictation(onText: (text: string) => void, language: 'en' | 'auto' = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const busy = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  useEffect(() => () => recognitionRef.current?.cancel?.(), []);
  const startListening = async () => {
    if (busy.current) return;
    busy.current = true;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let vad: Awaited<ReturnType<typeof startLocalVad>> | undefined;
    let recordTimeout: ReturnType<typeof setTimeout> | undefined;
    const uploadController = new AbortController();
    const releaseMicrophone = () => {
      clearTimeout(recordTimeout);
      stream?.getTracks().forEach(track => track.stop());
      if (vad) {
        const detector = vad;
        vad = undefined;
        void detector.destroy().catch(() => {});
      }
    };
    const stopRecording = () => {
      clearTimeout(recordTimeout);
      if (recorder?.state === 'recording') recorder.stop();
      else {
        cancelled = true;
        releaseMicrophone();
        setIsListening(false);
        busy.current = false;
      }
    };
    recognitionRef.current = {
      stop: stopRecording,
      cancel: () => {
        cancelled = true;
        uploadController.abort();
        if (recorder?.state === 'recording') recorder.stop();
        releaseMicrophone();
        busy.current = false;
      },
    };
    setIsListening(true);
    speechService.stop();

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (cancelled) { releaseMicrophone(); return; }
      const mediaRecorder = new MediaRecorder(stream);
      recorder = mediaRecorder;
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = event => { audioChunks.push(event.data); };
      mediaRecorder.onstop = async () => {
        releaseMicrophone();
        if (cancelled) return;
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        audioChunks.length = 0;
        setIsListening(false);
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audioBlob', audioBlob, mediaRecorder.mimeType.includes('ogg') ? 'audio.ogg' : 'audio.webm');
          formData.append('language', language);
          const response = await fetch('http://127.0.0.1:5000/transcribe-blob', {
            method: 'POST', body: formData, signal: uploadController.signal,
          });
          const result = await response.json();
          if (result.success) onTextRef.current(result.text);
          else notify(result.errorCode === 'no-speech'
            ? 'Không nghe thấy giọng nói. Hãy nói to hơn và thử lại.'
            : result.error || 'Không nhận dạng được âm thanh.', 'error', 8000);
        } catch (error) {
          if (!cancelled) notify('Chưa kết nối được nhận dạng cục bộ. Hãy chạy start_speech_server.bat.', 'error', 8000);
        } finally {
          if (!cancelled) {
            setIsListening(false);
            setIsTranscribing(false);
            busy.current = false;
            recognitionRef.current = null;
          }
        }
      };
      // Silero runs locally and ends only a valid speech segment after 1.8 s of silence.
      vad = await startLocalVad(stream, stopRecording);
      if (cancelled) { releaseMicrophone(); return; }
      mediaRecorder.start();
      recordTimeout = setTimeout(stopRecording, 30000);
    } catch (error: any) {
      releaseMicrophone();
      if (cancelled) return;
      setIsListening(false);
      busy.current = false;
      recognitionRef.current = null;
      const message = error.name === 'NotAllowedError' ? 'Quyền micro bị từ chối. Hãy cho phép micro trong cài đặt.'
        : error.name === 'NotFoundError' ? 'Không tìm thấy micro. Hãy kiểm tra thiết bị âm thanh.'
        : 'Không khởi động được micro hoặc VAD cục bộ. Hãy thử lại.';
      notify(message, 'error', 8000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current?.stop) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };


  return { isListening, isTranscribing, start: startListening, stop: stopListening };
}
