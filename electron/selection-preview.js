(() => {
  const preview = document.getElementById('preview');
  const translation = document.getElementById('translation');

  window.selectionPreviewAPI.onTranslation(({ translation: text, version }) => {
    translation.textContent = text;
    requestAnimationFrame(() => {
      window.selectionPreviewAPI.reportHeight(Math.ceil(preview.getBoundingClientRect().height + 4), version);
    });
  });
})();
