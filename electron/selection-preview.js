(() => {
  const preview = document.getElementById('preview');
  const translation = document.getElementById('translation');
  const caption = document.querySelector('.preview-caption');
  let version = 0;

  const applyTheme = (theme) => { document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light'; };
  window.selectionPreviewAPI.onThemeChange(applyTheme);
  window.selectionPreviewAPI.getTheme().then(applyTheme).catch(() => applyTheme('light'));

  window.selectionPreviewAPI.onTranslation(({ translation: text, version: nextVersion, failed }) => {
    version = nextVersion;
    preview.dataset.failed = String(Boolean(failed));
    caption.textContent = failed ? 'DỊCH NHANH · CẦN KIỂM TRA' : 'DỊCH NHANH';
    translation.textContent = text;
    requestAnimationFrame(() => {
      window.selectionPreviewAPI.reportHeight(Math.ceil(preview.getBoundingClientRect().height + 4), version);
    });
  });
})();
