(() => {
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let activeUtterance = null;
  let activeButton = null;

  function setButtonState(button, speaking) {
    if (!button) return;
    button.dataset.speaking = String(speaking);
    button.setAttribute('aria-pressed', String(speaking));
    const icon = button.querySelector('[data-speech-icon]');
    if (icon) icon.textContent = speaking ? '■' : '🔊';
  }

  function stop() {
    if (supported) window.speechSynthesis.cancel();
    setButtonState(activeButton, false);
    activeButton = null;
    activeUtterance = null;
  }

  function selectVoice(language) {
    const requested = language.toLowerCase();
    const base = requested.split('-')[0];
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => voice.localService && voice.lang.toLowerCase() === requested)
      || voices.find((voice) => voice.localService && voice.lang.toLowerCase().startsWith(base))
      || voices.find((voice) => voice.lang.toLowerCase() === requested)
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(base))
      || null;
  }

  function speak(text, language, button) {
    const value = typeof text === 'string' ? text.trim() : '';
    if (!supported || !value) return false;
    if (activeButton === button && window.speechSynthesis.speaking) {
      stop();
      return true;
    }

    stop();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = language;
    utterance.rate = language.toLowerCase().startsWith('vi') ? 0.95 : 0.9;
    const voice = selectVoice(language);
    if (voice) utterance.voice = voice;

    activeUtterance = utterance;
    activeButton = button || null;
    setButtonState(activeButton, true);
    const finish = () => {
      if (activeUtterance !== utterance) return;
      setButtonState(activeButton, false);
      activeButton = null;
      activeUtterance = null;
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  window.popupSpeech = { speak, stop, isSupported: () => supported };
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
})();
