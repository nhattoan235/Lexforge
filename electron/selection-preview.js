(() => {
  const preview = document.getElementById('preview');
  const translation = document.getElementById('translation');
  const caption = document.querySelector('.preview-caption');
  const speakOriginal = document.getElementById('speak-original');
  const speakTranslation = document.getElementById('speak-translation');
  const closePreview = document.getElementById('close-preview');
  let version = 0;
  let originalText = '';
  let translatedText = '';
  let closePointerArmed = false;

  const applyTheme = (theme) => { document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light'; };
  window.selectionPreviewAPI.onThemeChange(applyTheme);
  window.selectionPreviewAPI.getTheme().then(applyTheme).catch(() => applyTheme('light'));

  speakOriginal.addEventListener('click', () => window.popupSpeech.speak(originalText, 'en-US', speakOriginal));
  speakTranslation.addEventListener('click', () => window.popupSpeech.speak(translatedText, 'vi-VN', speakTranslation));
  closePreview.addEventListener('pointerdown', (event) => {
    closePointerArmed = event.button === 0;
  });
  closePreview.addEventListener('click', () => {
    if (!closePointerArmed) return;
    closePointerArmed = false;
    window.popupSpeech.stop();
    window.selectionPreviewAPI.close();
  });

  window.selectionPreviewAPI.onTranslation(({ original, translation: text, version: nextVersion, failed, pending }) => {
    const nextOriginal = original || '';
    const nextTranslation = failed || pending ? '' : text || '';
    if (version !== nextVersion || originalText !== nextOriginal ||
        (translatedText !== nextTranslation && speakTranslation.dataset.speaking === 'true')) {
      window.popupSpeech.stop();
    }
    version = nextVersion;
    originalText = nextOriginal;
    translatedText = nextTranslation;
    preview.dataset.failed = String(Boolean(failed));
    preview.setAttribute('aria-busy', String(Boolean(pending)));
    caption.textContent = failed ? 'DỊCH NHANH · CẦN KIỂM TRA' : 'DỊCH NHANH';
    translation.textContent = text;
    speakOriginal.hidden = !originalText;
    speakTranslation.hidden = !translatedText;
    // The main process shows this initially hidden window only after this report.
    // Waiting for requestAnimationFrame here can prevent the window ever showing.
    window.selectionPreviewAPI.reportHeight(Math.ceil(preview.getBoundingClientRect().height + 4), version);
  });
})();
