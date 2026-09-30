(() => {
  const api = window.writingPopupAPI;
  const popup = document.getElementById('popup');
  const suggestion = document.getElementById('suggestion');
  const error = document.getElementById('error');
  const vietnamesePanel = document.getElementById('vietnamese-panel');
  const vietnameseInput = document.getElementById('vietnamese-input');
  const translationResult = document.getElementById('translation-result');
  const englishOutput = document.getElementById('english-output');
  const acceptButton = document.getElementById('accept');
  const translateButton = document.getElementById('translate');
  const insertButton = document.getElementById('insert');
  const translateToggle = document.getElementById('translate-toggle');
  const dragHandle = document.querySelector('.popup-top');
  let revision = 0;
  let corrected = '';
  let english = '';
  let dragPointer = null;
  let dragOrigin = null;

  dragHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    dragPointer = event.pointerId;
    dragOrigin = { x: event.screenX, y: event.screenY };
    dragHandle.setPointerCapture(event.pointerId);
    api.beginDrag();
  });
  dragHandle.addEventListener('pointermove', (event) => {
    if (event.pointerId !== dragPointer || !dragOrigin) return;
    if (Math.hypot(event.screenX - dragOrigin.x, event.screenY - dragOrigin.y) >= 3) api.moveDrag();
  });
  const endDrag = (event) => {
    if (event.pointerId !== dragPointer) return;
    dragPointer = null;
    dragOrigin = null;
    api.endDrag();
  };
  dragHandle.addEventListener('pointerup', endDrag);
  dragHandle.addEventListener('pointercancel', endDrag);
  dragHandle.addEventListener('lostpointercapture', endDrag);

  function reportHeight() {
    api.reportHeight(Math.ceil(popup.scrollHeight + 4), revision);
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
    reportHeight();
  }

  api.onSuggestion((payload) => {
    revision = payload.revision;
    corrected = payload.corrected;
    english = '';
    suggestion.textContent = corrected;
    vietnameseInput.value = '';
    vietnamesePanel.hidden = true;
    translationResult.hidden = true;
    translateToggle.setAttribute('aria-expanded', 'false');
    showError('');
    reportHeight();
  });

  const dismiss = () => api.dismiss(revision);
  document.getElementById('dismiss').addEventListener('click', dismiss);
  document.getElementById('dismiss-secondary').addEventListener('click', dismiss);
  translateToggle.addEventListener('click', () => {
    vietnamesePanel.hidden = !vietnamesePanel.hidden;
    translateToggle.setAttribute('aria-expanded', String(!vietnamesePanel.hidden));
    reportHeight();
    if (!vietnamesePanel.hidden) vietnameseInput.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (!event.ctrlKey || !event.altKey || event.metaKey || event.repeat) return;
    const action = event.key;
    if (!['1', '2', '3', '4', '5'].includes(action)) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === '2') { dismiss(); return; }
    const button = action === '1' ? acceptButton : action === '3' ? translateToggle :
      action === '4' && !vietnamesePanel.hidden ? translateButton :
        action === '5' && !translationResult.hidden ? insertButton : null;
    if (button && !button.disabled) button.click();
  });
  vietnameseInput.addEventListener('input', () => {
    english = '';
    translationResult.hidden = true;
    showError('');
  });

  acceptButton.addEventListener('click', async () => {
    acceptButton.disabled = true;
    const result = await api.apply(revision, 'replace', corrected);
    acceptButton.disabled = false;
    if (!result.success) showError(result.error || 'Không áp dụng được câu đề xuất.');
  });

  translateButton.addEventListener('click', async () => {
    const text = vietnameseInput.value.trim();
    if (!text) { showError('Hãy nhập từ hoặc câu tiếng Việt.'); return; }
    showError('');
    translateButton.disabled = true;
    translateButton.textContent = 'Đang dịch…';
    const result = await api.translate(revision, text);
    translateButton.disabled = false;
    translateButton.textContent = 'Dịch sang tiếng Anh';
    if (!result.success) { showError(result.error || 'Không dịch được.'); return; }
    english = result.translation;
    englishOutput.textContent = english;
    translationResult.hidden = false;
    reportHeight();
    setTimeout(() => popup.scrollTo({ top: popup.scrollHeight, behavior: 'smooth' }), 80);
  });

  insertButton.addEventListener('click', async () => {
    if (!english) return;
    insertButton.disabled = true;
    const result = await api.apply(revision, 'insert', english);
    insertButton.disabled = false;
    if (!result.success) showError(result.error || 'Không chèn được câu tiếng Anh.');
  });
})();
