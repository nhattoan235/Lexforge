(() => {
  const toast = document.getElementById('toast');
  let toastTimer;
  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function markChanged(id) {
    const status = document.getElementById(id);
    status.textContent = 'Có thay đổi chưa lưu';
    status.className = 'save-status changed';
  }
  function markSaved(id) {
    const status = document.getElementById(id);
    status.textContent = 'Đã áp dụng trong bản xem trước';
    status.className = 'save-status saved';
  }
  const goal = document.getElementById('dailyGoal');
  const clampGoal = value => Math.max(5, Math.min(200, Number(value) || 5));
  document.getElementById('goalDown').addEventListener('click', () => { goal.value = clampGoal(Number(goal.value) - 1); markChanged('learningStatus'); });
  document.getElementById('goalUp').addEventListener('click', () => { goal.value = clampGoal(Number(goal.value) + 1); markChanged('learningStatus'); });
  goal.addEventListener('change', () => { goal.value = clampGoal(goal.value); markChanged('learningStatus'); });

  function toggleSwitch(button, statusId) {
    const enabled = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(enabled));
    button.classList.toggle('on', enabled);
    markChanged(statusId);
    return enabled;
  }
  document.getElementById('autoSpeak').addEventListener('click', event => toggleSwitch(event.currentTarget, 'learningStatus'));
  document.getElementById('autoVocab').addEventListener('click', event => {
    document.getElementById('categoryRow').hidden = !toggleSwitch(event.currentTarget, 'aiStatus');
  });
  document.getElementById('vocabCategory').addEventListener('change', () => markChanged('aiStatus'));
  document.getElementById('saveLearning').addEventListener('click', () => { markSaved('learningStatus'); notify('Đã áp dụng mục học tập trong bản xem trước.'); });
  document.getElementById('saveAi').addEventListener('click', () => {
    markSaved('aiStatus');
    notify('Đã áp dụng thiết lập AI trong bản xem trước. API key không được lưu.');
  });

  const apiKey = document.getElementById('apiKey');
  const keyStatus = document.getElementById('keyStatus');
  apiKey.addEventListener('input', () => {
    keyStatus.textContent = apiKey.value ? 'Đã nhập · chưa lưu' : 'Chưa cấu hình';
    keyStatus.classList.toggle('entered', Boolean(apiKey.value));
    markChanged('aiStatus');
  });
  document.getElementById('toggleKey').addEventListener('click', event => {
    const showing = apiKey.type === 'password';
    apiKey.type = showing ? 'text' : 'password';
    event.currentTarget.textContent = showing ? 'Ẩn' : 'Hiện';
  });

  document.querySelectorAll('.theme-choice').forEach(button => button.addEventListener('click', () => {
    const dark = button.dataset.theme === 'dark';
    document.body.classList.toggle('dark', dark);
    document.querySelectorAll('.theme-choice').forEach(choice => {
      choice.classList.toggle('active', choice === button);
      choice.setAttribute('aria-pressed', String(choice === button));
    });
  }));
  const dialog = document.getElementById('confirmDialog');
  document.getElementById('clearHistory').addEventListener('click', () => {
    document.getElementById('confirmTitle').textContent = 'Xóa lịch sử học?';
    document.getElementById('confirmText').textContent = 'Trong ứng dụng, thao tác này xóa phiên học và điểm game nhưng giữ nguyên từ vựng. Bản xem trước không xóa dữ liệu.';
    dialog.showModal();
  });
  document.getElementById('clearAll').addEventListener('click', () => {
    document.getElementById('confirmTitle').textContent = 'Xóa toàn bộ dữ liệu?';
    document.getElementById('confirmText').textContent = 'Trong ứng dụng, thao tác này xóa từ vựng, nhóm, lịch sử học và điểm game. Bản xem trước không xóa dữ liệu.';
    dialog.showModal();
  });
  document.getElementById('cancelConfirm').addEventListener('click', () => dialog.close());
  document.getElementById('ackConfirm').addEventListener('click', () => { dialog.close(); notify('Bản xem trước không xóa dữ liệu.'); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.querySelectorAll('.settings-rail a').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.settings-rail a').forEach(item => item.classList.toggle('active', item === link));
  }));
})();
