(() => {
  const api = window.writingPopupAPI;
  const popup = document.getElementById('popup');
  const suggestion = document.getElementById('suggestion');
  const targetSentence = document.getElementById('target-sentence');
  const targetLabel = document.getElementById('target-label');
  const suggestionLabel = document.getElementById('suggestion-label');
  const shortcutHint = document.getElementById('shortcut-hint');
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
  const themeToggle = document.getElementById('theme-toggle');
  let revision = 0;
  let corrected = '';
  let english = '';
  let manual = false;
  let dragPointer = null;
  let dragOrigin = null;

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    const label = next === 'dark' ? '☀ Sáng' : '☾ Tối';
    themeToggle.textContent = label;
    themeToggle.setAttribute('aria-label', `Chuyển sang giao diện ${next === 'dark' ? 'sáng' : 'tối'}`);
    themeToggle.title = themeToggle.getAttribute('aria-label');
  }
  api.onThemeChange(applyTheme);
  api.getTheme().then(applyTheme).catch(() => applyTheme('light'));
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    api.setTheme(next).then(applyTheme);
  });

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
    const preserveInput = manual && payload.manual && revision === payload.revision;
    revision = payload.revision;
    manual = Boolean(payload.manual);
    const failed = typeof payload.failure === 'string' && Boolean(payload.failure);
    corrected = failed ? '' : payload.corrected;
    const hasTarget = Boolean(payload.original);
    targetLabel.hidden = !hasTarget;
    targetSentence.hidden = !hasTarget;
    targetSentence.textContent = payload.original || '';
    suggestionLabel.hidden = !hasTarget;
    suggestion.hidden = !hasTarget;
    suggestionLabel.textContent = failed ? 'Chưa thể tạo gợi ý' : 'Câu đề xuất';
    suggestion.dataset.failed = String(failed);
    suggestion.textContent = failed ? payload.failure : payload.checking ? 'Đang kiểm tra câu…' :
      corrected || (manual && hasTarget ? 'Câu này chưa cần sửa.' : '');
    acceptButton.hidden = failed || !corrected || payload.canApply === false;
    translateToggle.hidden = failed || manual;
    shortcutHint.hidden = failed && !manual;
    shortcutHint.textContent = manual
      ? 'Ctrl+Alt+W mở nhanh · Esc đóng · Ctrl+Alt+4 dịch · Ctrl+Alt+5 thay câu (nếu có câu đích)'
      : 'Ctrl+Alt+W mở nhanh · Esc đóng và trở về ô viết · Ctrl+Alt+1 áp dụng · 2 bỏ qua · 3 Việt → Anh · 4 dịch · 5 thay câu';
    insertButton.hidden = false;
    insertButton.innerHTML = hasTarget
      ? '✓ Thay câu đang viết <small>Ctrl+Alt+5</small>'
      : '✓ Chèn vào ô đang viết <small>Ctrl+Alt+5</small>';
    if (!preserveInput) {
      english = '';
      vietnameseInput.value = '';
      translationResult.hidden = true;
      vietnamesePanel.hidden = !manual;
      translateToggle.setAttribute('aria-expanded', String(manual));
    }
    error.textContent = '';
    error.hidden = true;
    reportHeight();
    if (manual && !preserveInput) setTimeout(() => vietnameseInput.focus(), 80);
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
    if (button && !button.disabled && !button.hidden) button.click();
  });
  vietnameseInput.addEventListener('input', () => {
    english = '';
    translationResult.hidden = true;
    showError('');
  });

  acceptButton.addEventListener('click', async () => {
    if (!corrected) return;
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
    const result = await api.apply(revision, 'replaceTranslation', english);
    insertButton.disabled = false;
    if (!result.success) showError(result.error || 'Không thay được câu đang viết.');
  });

})();
