// src/services/speech.ts

export const speechService = {
  speak: async (text: string, lang: 'en-US' | 'vi-VN' = 'en-US', rate = 0.9): Promise<void> => {
    // Dừng câu đang đọc dở trước đó
    speechService.stop();

    if (!('speechSynthesis' in window)) {
      console.warn("Trình duyệt không hỗ trợ Web Speech API");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate; // Tốc độ đọc (0.9 nghe rất tự nhiên)

    // Tìm và ép trình duyệt sử dụng giọng chuẩn, tự nhiên nhất của Google
    const voices = window.speechSynthesis.getVoices();
    
    if (lang === 'en-US') {
      // Ưu tiên giọng Google US English (Giọng nữ nghe rất mượt, ngắt nghỉ ổn)
      const googleVoice = voices.find(v => v.name === 'Google US English' || v.lang === 'en-US' && v.localService === false);
      if (googleVoice) {
        utterance.voice = googleVoice;
      }
    } else {
      // Nếu là tiếng Việt thì bốc giọng Google tiếng Việt
      const viVoice = voices.find(v => v.lang.startsWith('vi'));
      if (viVoice) utterance.voice = viVoice;
    }

    // Phát âm thanh
    window.speechSynthesis.speak(utterance);
  },

  stop: (): void => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  isSupported: (): boolean => true,
};

// Kích hoạt load giọng nói ngầm của trình duyệt
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}