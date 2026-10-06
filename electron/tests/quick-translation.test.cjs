const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rendererSource = fs.readFileSync(path.join(__dirname, '../selection-preview.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

const englishFilterSource = mainSource.slice(mainSource.indexOf('function looksLikeEnglishSelection('),
  mainSource.indexOf('function scheduleQuickTranslation('));
const englishFilterContext = vm.createContext({});
vm.runInContext(englishFilterSource, englishFilterContext);

test('English filter accepts English with names and accents but rejects Vietnamese and URLs', () => {
  assert.equal(englishFilterContext.looksLikeEnglishSelection('I met José at the café yesterday.'), true);
  assert.equal(englishFilterContext.looksLikeEnglishSelection('Tôi muốn học tiếng Anh mỗi ngày.'), false);
  assert.equal(englishFilterContext.looksLikeEnglishSelection('https://example.com/hello'), false);
});

function renderer() {
  const nodes = {};
  for (const id of ['preview', 'translation', 'caption', 'speak-original', 'speak-translation', 'close-preview']) {
    nodes[id] = {
      dataset: {}, hidden: false, textContent: '', listeners: {},
      setAttribute(name, value) { this[name] = value; },
      addEventListener(event, listener) { this.listeners[event] = listener; },
      getBoundingClientRect: () => ({ height: 118 }),
    };
  }
  const reports = [], spoken = [];
  let receive, stops = 0, closes = 0;
  vm.runInNewContext(rendererSource, {
    document: {
      getElementById: id => nodes[id], querySelector: () => nodes.caption,
      documentElement: { dataset: {} },
    },
    // A hidden Electron renderer must not depend on this callback running.
    requestAnimationFrame: () => {},
    window: {
      popupSpeech: { stop: () => stops++, speak: (...args) => spoken.push(args) },
      selectionPreviewAPI: {
        onThemeChange: () => {}, getTheme: async () => 'light',
        onTranslation: callback => { receive = callback; },
        reportHeight: (...args) => reports.push(args),
        close: () => closes++,
      },
    },
  });
  return { nodes, reports, spoken, receive, stops: () => stops, closes: () => closes };
}

test('hidden preview reports height without waiting for an animation frame', () => {
  const h = renderer();
  h.receive({ original: 'Hello.', translation: 'Đang dịch…', version: 1, pending: true });
  assert.deepEqual(h.reports, [[122, 1]]);
  assert.equal(h.nodes.preview['aria-busy'], 'true');
});

test('selected English can be read while translation is pending or failed', () => {
  const h = renderer();
  for (const state of [{ pending: true }, { failed: true }]) {
    h.receive({ original: 'Hello world.', translation: 'Status message', version: 1, ...state });
    assert.equal(h.nodes['speak-original'].hidden, false);
    assert.equal(h.nodes['speak-translation'].hidden, true);
    h.nodes['speak-original'].listeners.click();
    assert.deepEqual(h.spoken.at(-1).slice(0, 2), ['Hello world.', 'en-US']);
  }
});

test('translation arrival preserves English playback; a new selection stops it', () => {
  const h = renderer();
  h.receive({ original: 'Hello.', translation: 'Đang dịch…', version: 1, pending: true });
  const stops = h.stops();
  h.receive({ original: 'Hello.', translation: 'Xin chào.', version: 1 });
  assert.equal(h.stops(), stops);
  assert.equal(h.nodes['speak-translation'].hidden, false);
  h.receive({ original: 'Goodbye.', translation: 'Đang dịch…', version: 2, pending: true });
  assert.equal(h.stops(), stops + 1);
});

test('quick preview closes only from its explicit close control', () => {
  const h = renderer();
  h.receive({ original: 'Hello.', translation: 'Xin chào.', version: 1 });
  h.nodes['close-preview'].listeners.pointerdown({ button: 0 });
  h.nodes['close-preview'].listeners.click();
  assert.equal(h.closes(), 1);
  assert.ok(h.stops() >= 1);
});

function scheduler(request) {
  const shown = [];
  let timer;
  const context = vm.createContext({
    quickSelectionVersion: 0, quickSelectionBounds: null, quickSelectionText: '',
    quickSelectionTimer: null, quickSelectionAbort: null, quickTranslationCache: new Map(),
    assistantEnabled: true, QUICK_SELECTION_DELAY_MS: 500,
    AbortController, isDev: false,
    clearQuickSelection: () => {
      context.quickSelectionAbort?.abort();
      context.quickSelectionVersion++;
    },
    looksLikeEnglishSelection: () => true,
    setTimeout: callback => { timer = callback; return 1; },
    screen: { getCursorScreenPoint: () => ({ x: 100, y: 100 }) },
    requestQuickTranslation: request,
    showQuickTranslation: (...args) => shown.push(args),
    getWritingTaskErrorMessage: () => 'Translation failed',
  });
  vm.runInContext(mainSource.slice(mainSource.indexOf('function scheduleQuickTranslation('),
    mainSource.indexOf('function showQuickTranslation(')), context);
  context.scheduleQuickTranslation({ text: 'Hello.', bounds: { x: 10, y: 10 } });
  return { context, shown, run: () => timer() };
}

test('popup appears before the network finishes and then receives the translation', async () => {
  let resolve;
  const h = scheduler(() => new Promise(r => { resolve = r; }));
  const pending = h.run();
  assert.deepEqual(h.shown, [['Đang dịch…', 1, false, true]]);
  resolve('Xin chào.');
  await pending;
  assert.deepEqual(h.shown.at(-1), ['Xin chào.', 1]);
});

test('empty response and network failure produce visible feedback', async () => {
  for (const request of [async () => '', async () => { throw new Error('network'); }]) {
    const h = scheduler(request);
    await h.run();
    assert.equal(h.shown.length, 2);
    assert.equal(h.shown.at(-1)[2], true);
  }
});

test('a response for a dismissed selection never replaces the current popup', async () => {
  let resolve;
  const h = scheduler(() => new Promise(r => { resolve = r; }));
  const pending = h.run();
  h.context.clearQuickSelection();
  resolve('Old translation');
  await pending;
  assert.equal(h.shown.length, 1);
});

test('an unrelated non-English selection cannot clear the active quick popup', () => {
  const scheduleSource = mainSource.slice(mainSource.indexOf('function scheduleQuickTranslation('),
    mainSource.indexOf('function showQuickTranslation('));
  let cleared = 0;
  const context = vm.createContext({
    assistantEnabled: true,
    looksLikeEnglishSelection: () => false,
    clearQuickSelection: () => cleared++,
    quickSelectionVersion: 3,
    quickSelectionBounds: { x: 1, y: 1 },
    quickSelectionText: 'Existing English.',
    quickSelectionAnchor: { x: 10, y: 10 },
    quickSelectionTimer: null,
    quickSelectionAbort: null,
    quickTranslationCache: new Map(),
    QUICK_SELECTION_DELAY_MS: 500,
    screen: { getCursorScreenPoint: () => ({ x: 20, y: 20 }) },
    setTimeout: () => 1, AbortController,
    requestQuickTranslation: async () => '', showQuickTranslation: () => {},
    getWritingTaskErrorMessage: () => '', isDev: false,
  });
  vm.runInContext(scheduleSource, context);
  context.scheduleQuickTranslation({ text: 'Tôi đang học tiếng Anh.', bounds: { x: 4, y: 5 } });
  assert.equal(cleared, 0);
  assert.equal(context.quickSelectionText, 'Existing English.');
  assert.equal(context.quickSelectionVersion, 3);
});

test('monitor clear dismisses the quick popup when selection is removed', () => {
  const handlerSource = mainSource.slice(mainSource.indexOf('function handleSelectionMonitorLine('),
    mainSource.indexOf('function startSelectionMonitor('));
  let cleared = 0;
  const context = vm.createContext({
    JSON, isDev: false,
    clearQuickSelection: () => cleared++,
    scheduleQuickTranslation: () => {},
    looksLikeEnglishSelection: () => true,
    selectionMonitorReady: false,
    selectionMonitorMessage: '',
    sendAssistantState: () => {},
  });
  vm.runInContext(handlerSource, context);
  context.handleSelectionMonitorLine('{"type":"clear"}');
  assert.equal(cleared, 1);
});

test('quick preview is positioned from the captured cursor on the same display', () => {
  const positionSource = mainSource.slice(mainSource.indexOf('function positionQuickTranslation('),
    mainSource.indexOf('function handleSelectionMonitorLine('));
  let bounds;
  const preview = {
    isDestroyed: () => false,
    setBounds: next => { bounds = next; },
    showInactive: () => {}, moveTop: () => {}, setAlwaysOnTop: () => {},
    isVisible: () => true, getBounds: () => bounds,
  };
  const context = vm.createContext({
    quickSelectionVersion: 2,
    quickSelectionBounds: { x: -4000, y: -4000, width: 1, height: 1 },
    quickSelectionAnchor: { x: 900, y: 700 },
    quickSelectionManualPosition: null,
    selectionPreviewWindow: preview,
    SELECTION_PREVIEW_WIDTH: 340,
    screen: { getDisplayNearestPoint: point => {
      assert.deepEqual(point, { x: 900, y: 700 });
      return { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
    } },
    clampBoundsToWorkArea: value => value,
    registerQuickTranslationCloseShortcut: () => {},
    isDev: false, console,
  });
  vm.runInContext(positionSource, context);
  context.positionQuickTranslation(102, 2);
  assert.equal(JSON.stringify(bounds), JSON.stringify({ x: 912, y: 718, width: 340, height: 102 }));
});

test('quick preview is opaque and does not activate the main app window', () => {
  const windowSource = mainSource.slice(mainSource.indexOf('function createSelectionPreviewWindow('),
    mainSource.indexOf('function clearQuickSelection('));
  assert.match(windowSource, /transparent:\s*false/);
  assert.match(windowSource, /focusable:\s*false/);
  assert.match(windowSource, /hasShadow:\s*true/);
});

test('quick preview registers Escape only while it is visible', () => {
  assert.match(mainSource, /QUICK_TRANSLATION_CLOSE_SHORTCUT\s*=\s*'Escape'/);
  assert.match(mainSource, /registerQuickTranslationCloseShortcut\(\);/);
  const clearSource = mainSource.slice(mainSource.indexOf('function clearQuickSelection('),
    mainSource.indexOf('function looksLikeEnglishSelection('));
  assert.match(clearSource, /globalShortcut\.unregister\(QUICK_TRANSLATION_CLOSE_SHORTCUT\)/);
});

test('floating assistant reapplies Windows topmost after showing and moving', () => {
  const helperSource = mainSource.slice(mainSource.indexOf('function keepAssistantAboveApps('),
    mainSource.indexOf('function resizeAssistantWindow('));
  assert.match(helperSource, /moveTop\(\)/);
  assert.match(helperSource, /setAlwaysOnTop\(true, 'screen-saver'\)/);
  assert.ok((mainSource.match(/keepAssistantAboveApps\(\);/g) || []).length >= 6);
});
