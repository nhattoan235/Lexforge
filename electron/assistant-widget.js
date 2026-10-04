(() => {
  const api = window.assistantAPI;
  const body = document.body;
  const launcherStage = document.getElementById('launcher-stage');
  const launcher = document.getElementById('launcher');
  const panel = document.getElementById('assistant-panel');
  const panelContent = document.querySelector('.panel-content');
  const toggleButton = document.getElementById('enabled-toggle');
  const statusLabel = document.getElementById('status-label');
  const statusCopy = document.getElementById('status-copy');
  const errorMessage = document.getElementById('error-message');
  const versionLabel = document.getElementById('version-label');
  const themeToggle = document.getElementById('theme-toggle');
  const themeSymbol = document.getElementById('theme-symbol');
  const themeLabel = document.getElementById('theme-label');
  const writingTask = document.getElementById('writing-task');
  const taskChoices = [...document.querySelectorAll('.task-choice')];
  const directionOptions = document.getElementById('direction-options');
  const directionSummary = document.getElementById('direction-summary');
  const directionSelect = document.getElementById('translation-direction');
  const taskHelp = document.getElementById('task-help');
  const writingInput = document.getElementById('writing-input');
  const characterCount = document.getElementById('character-count');
  const submitWriting = document.getElementById('submit-writing');
  const composerError = document.getElementById('composer-error');
  const translationView = document.getElementById('translation-view');
  const resultTitle = document.getElementById('result-title');
  const translationStatus = document.getElementById('translation-status');
  const originalLabel = document.getElementById('original-label');
  const translationOriginal = document.getElementById('translation-original');
  const outputLabel = document.getElementById('output-label');
  const translationOutput = document.getElementById('translation-output');
  const explanationSection = document.getElementById('result-explanation');
  const explanationCopy = document.getElementById('explanation-copy');
  const suggestionsSection = document.getElementById('result-suggestions');
  const suggestionsList = document.getElementById('suggestions-list');
  const vocabularySection = document.getElementById('result-vocabulary');
  const vocabularyList = document.getElementById('vocabulary-list');
  const translationError = document.getElementById('translation-error');
  const copyTranslationButton = document.getElementById('copy-translation');
  const translationCopied = document.getElementById('translation-copied');

  const taskUi = {
    translate: {
      label: 'Dịch',
      help: 'Nhập một từ, câu hoặc đoạn văn cần dịch.',
      placeholder: 'Nhập hoặc dán nội dung cần dịch…',
    },
    grammar: {
      label: 'Kiểm tra ngữ pháp',
      help: 'Nhập câu tiếng Anh để xem lỗi, bản sửa và giải thích ngắn.',
      placeholder: 'Ví dụ: She go to work every day.',
    },
    complete: {
      label: 'Hoàn chỉnh câu',
      help: 'Nhập câu đang viết dở hoặc ý chính cần diễn đạt thành câu.',
      placeholder: 'Ví dụ: If I had more time…',
    },
    write: {
      label: 'Viết câu tiếng Anh',
      help: 'Mô tả ý bằng tiếng Việt; trợ lý sẽ viết câu tiếng Anh và giải thích cấu trúc.',
      placeholder: 'Ví dụ: Tôi muốn nói rằng hôm qua tôi bận nên không thể gọi cho bạn.',
    },
  };

  let currentState = { enabled: true, expanded: false, version: '', selectionMonitoring: false };
  let currentTranslation = '';
  let suppressLauncherClickUntil = 0;

  function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', nextTheme);
    const nextLabel = nextTheme === 'dark' ? 'Sáng' : 'Tối';
    const nextIcon = nextTheme === 'dark' ? '☀' : '☾';
    themeLabel.textContent = nextLabel;
    themeSymbol.textContent = nextIcon;
    themeToggle.setAttribute('aria-label', `Chuyển sang giao diện ${nextLabel.toLowerCase()}`);
    themeToggle.title = `Chuyển sang giao diện ${nextLabel.toLowerCase()}`;
  }

  api.onThemeChange(applyTheme);
  api.getTheme().then(applyTheme).catch(() => applyTheme('light'));

  function renderState(nextState) {
    if (!nextState || typeof nextState.enabled !== 'boolean') return;
    currentState = { ...currentState, ...nextState };

    const isEnabled = currentState.enabled;
    body.classList.toggle('assistant-paused', !isEnabled);
    body.classList.toggle('assistant-expanded', Boolean(currentState.expanded));
    launcherStage.hidden = Boolean(currentState.expanded);
    panel.hidden = !currentState.expanded;
    panel.setAttribute('aria-hidden', String(!currentState.expanded));
    launcher.setAttribute('aria-label', currentState.expanded ? 'Thu gọn trợ lý tiếng Anh' : 'Mở trợ lý tiếng Anh');

    toggleButton.setAttribute('aria-checked', String(isEnabled));
    statusLabel.textContent = isEnabled ? 'Trợ lý đang bật' : 'Trợ lý đang tắt';
    statusCopy.textContent = !isEnabled
      ? 'Trợ lý đang tạm dừng. Bật lại để tiếp tục dùng.'
      : !currentState.selectionMonitoring
        ? (currentState.selectionMonitorMessage || 'Đang khởi tạo nhận diện vùng chọn…')
        : !currentState.writingMonitoring
          ? (currentState.writingMonitorMessage || 'Đang khởi tạo hỗ trợ viết nhanh…')
          : 'Sẵn sàng dịch vùng chọn và hỗ trợ viết.';
    versionLabel.textContent = currentState.version ? `v${currentState.version}` : '';
  }

  function appendTextList(list, values, createContent) {
    list.replaceChildren();
    values.forEach((value) => {
      const item = document.createElement('li');
      createContent(item, value);
      list.appendChild(item);
    });
  }

  function renderResult(result) {
    if (!result || typeof result !== 'object') return;
    body.classList.add('assistant-translation-mode');
    translationView.hidden = false;
    panelContent.scrollTop = 0;
    translationView.scrollTop = 0;
    errorMessage.hidden = true;
    translationOriginal.textContent = result.original || '';
    originalLabel.textContent = result.task ? 'Nội dung bạn nhập' : 'Nội dung đã chọn';
    resultTitle.textContent = result.taskLabel || (result.task ? taskUi[result.task]?.label : 'Bản dịch') || 'Kết quả';
    outputLabel.textContent = result.task === 'translate' || result.translation ? 'Bản dịch' : 'Đề xuất';
    translationOutput.textContent = '';
    translationError.hidden = true;
    translationCopied.hidden = true;
    copyTranslationButton.hidden = true;
    explanationSection.hidden = true;
    suggestionsSection.hidden = true;
    vocabularySection.hidden = true;
    appendTextList(suggestionsList, [], () => {});
    appendTextList(vocabularyList, [], () => {});
    currentTranslation = '';

    if (result.status === 'loading') {
      translationStatus.textContent = 'Đang xử lý…';
      translationOutput.textContent = 'Đang chờ kết quả từ Groq.';
      return;
    }

    if (result.status === 'error' || result.success === false) {
      translationStatus.textContent = 'Chưa hoàn tất';
      translationError.textContent = result.error || 'Đã xảy ra lỗi khi xử lý.';
      translationError.hidden = false;
      return;
    }

    const answer = typeof result.result === 'string' ? result.result : result.translation;
    if (!answer) {
      translationStatus.textContent = 'Chưa có kết quả';
      translationError.textContent = 'AI chưa trả về nội dung. Hãy thử lại.';
      translationError.hidden = false;
      return;
    }

    translationStatus.textContent = 'Hoàn tất';
    translationOutput.textContent = answer;
    currentTranslation = answer;
    copyTranslationButton.hidden = false;

    if (typeof result.explanation === 'string' && result.explanation.trim()) {
      explanationCopy.textContent = result.explanation.trim();
      explanationSection.hidden = false;
    }

    if (Array.isArray(result.suggestions) && result.suggestions.length) {
      appendTextList(suggestionsList, result.suggestions.slice(0, 2), (item, suggestion) => {
        item.textContent = suggestion;
      });
      suggestionsSection.hidden = false;
    }

    if (Array.isArray(result.vocabulary) && result.vocabulary.length) {
      appendTextList(vocabularyList, result.vocabulary.slice(0, 3), (item, vocabulary) => {
        const term = document.createElement('strong');
        term.textContent = `${vocabulary.term}: `;
        item.append(term, document.createTextNode(vocabulary.meaning));
        if (vocabulary.example) {
          const example = document.createElement('div');
          example.className = 'detail-copy';
          example.textContent = vocabulary.example;
          item.appendChild(example);
        }
      });
      vocabularySection.hidden = false;
    }
  }

  function updateTaskUi() {
    const task = taskUi[writingTask.value] ? writingTask.value : 'translate';
    const config = taskUi[task];
    taskChoices.forEach((choice) => choice.setAttribute('aria-pressed', String(choice.dataset.task === task)));
    directionOptions.hidden = task !== 'translate';
    if (task !== 'translate') directionOptions.open = false;
    taskHelp.textContent = config.help;
    writingInput.placeholder = config.placeholder;
    submitWriting.textContent = config.label;
  }

  function updateCharacterCount() {
    characterCount.textContent = `${writingInput.value.length} / 5000`;
  }

  async function runAction(action, failureMessage) {
    errorMessage.hidden = true;
    try {
      const nextState = await action();
      if (nextState) renderState(nextState);
    } catch (error) {
      showError(failureMessage || error.message || 'Không thể thực hiện thao tác.');
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  async function submitWritingTask() {
    composerError.hidden = true;
    const text = writingInput.value.trim();
    if (!text) {
      composerError.textContent = 'Hãy nhập từ, câu hoặc ý tưởng trước khi thực hiện.';
      composerError.hidden = false;
      writingInput.focus();
      return;
    }

    const input = {
      task: writingTask.value,
      direction: directionSelect.value,
      text,
    };
    submitWriting.disabled = true;
    renderResult({ status: 'loading', task: input.task, original: text });
    try {
      renderResult(await api.runWritingTask(input));
    } catch (_) {
      renderResult({
        status: 'error',
        task: input.task,
        original: text,
        error: 'Không gửi được yêu cầu. Hãy kiểm tra ứng dụng rồi thử lại.',
      });
    } finally {
      submitWriting.disabled = false;
    }
  }

  launcher.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary || currentState.expanded) return;
    launcher.classList.add('is-dragging');
    api.beginWidgetDrag();
  });
  document.addEventListener('pointerdown', () => api.pointerDown(), true);
  api.onWidgetDragFinished((moved) => {
    if (moved) suppressLauncherClickUntil = Date.now() + 350;
    launcher.classList.remove('is-dragging');
  });
  launcher.addEventListener('click', (event) => {
    if (Date.now() < suppressLauncherClickUntil) {
      event.preventDefault();
      return;
    }
    runAction(() => api.openPanel(), 'Không mở được bảng trợ lý.');
  });
  document.getElementById('collapse').addEventListener('click', () => runAction(() => api.collapsePanel(), 'Không thu gọn được trợ lý.'));
  themeToggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    api.setTheme(nextTheme).then(applyTheme);
  });
  toggleButton.addEventListener('click', () => runAction(
    () => api.setEnabled(!currentState.enabled),
    'Không lưu được trạng thái trợ lý.'
  ));
  document.getElementById('open-main').addEventListener('click', () => runAction(() => api.openMain(), 'Không mở được ứng dụng học tập.'));
  document.getElementById('quit').addEventListener('click', () => runAction(() => api.quit(), 'Không thể thoát ứng dụng.'));
  writingTask.addEventListener('change', updateTaskUi);
  taskChoices.forEach((choice) => choice.addEventListener('click', () => {
    writingTask.value = choice.dataset.task;
    updateTaskUi();
  }));
  directionSelect.addEventListener('change', () => {
    directionSummary.textContent = {
      auto: 'Tự nhận diện Anh ↔ Việt',
      'en-vi': 'Anh → Việt',
      'vi-en': 'Việt → Anh',
    }[directionSelect.value] || 'Tự nhận diện Anh ↔ Việt';
    directionOptions.open = false;
  });
  writingInput.addEventListener('input', updateCharacterCount);
  submitWriting.addEventListener('click', submitWritingTask);
  writingInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      submitWritingTask();
    }
  });
  document.getElementById('back-to-controls').addEventListener('click', () => {
    body.classList.remove('assistant-translation-mode');
    translationView.hidden = true;
    composerError.hidden = true;
    panelContent.scrollTop = 0;
    writingInput.focus();
  });
  copyTranslationButton.addEventListener('click', async () => {
    if (!currentTranslation) return;
    try {
      await api.copyText(currentTranslation);
      translationCopied.hidden = false;
    } catch (_) {
      translationError.textContent = 'Không sao chép được kết quả.';
      translationError.hidden = false;
    }
  });

  updateTaskUi();
  updateCharacterCount();
  api.onStateChange(renderState);
  api.getState()
    .then(renderState)
    .catch(() => showError('Không đọc được trạng thái trợ lý. Hãy khởi động lại ứng dụng.'));
})();
