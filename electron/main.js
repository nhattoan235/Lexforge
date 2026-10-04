const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;
let mainWindowRevealed = false;
let startupWindow;
let startupShownAt = 0;
let startupShownPromise = Promise.resolve();
let assistantWindow;
let selectionPreviewWindow;
let writingWindow;
let manualWritingPosition = null;
let positioningWritingWindow = false;
let lastProgrammaticWritingBounds = null;
let writingDragState = null;
let assistantTray;
let devSelectionMonitorPath;
let selectionMonitorProcess;
let selectionMonitorBuffer = '';
let outsideClickProcess;
let outsideClickBuffer = '';
let outsideClickRestartTimer = null;
let writingMonitorProcess;
let writingMonitorBuffer = '';
let selectionMonitorRestartTimer = null;
let writingMonitorRestartTimer = null;
let writingDraft = null;
let assistantTheme = 'light';
let writingTimer = null;
let writingAbort = null;
let writingRequestVersion = 0;
let dismissedWritingRevision = null;
let pendingWritingApply = null;
let failedWritingApplyRevision = null;
let pendingWritingFocus = null;
let currentWritingSuggestion = null;
let currentWritingTranslation = null;
let selectionMonitorReady = false;
let selectionMonitorMessage = 'Đang khởi tạo nhận diện vùng chọn…';
let writingMonitorReady = false;
let writingMonitorMessage = 'Đang khởi tạo hỗ trợ viết nhanh…';
let assistantWidgetPosition = null;
let assistantDragState = null;
let lastWidgetDragMovedAt = 0;
let lastAssistantPointerDownAt = 0;
let assistantCollapsedOrigin = null;
let assistantExpandedBounds = null;
let quickSelectionTimer = null;
let quickSelectionAbort = null;
let quickSelectionVersion = 0;
let quickSelectionBounds = null;
const quickTranslationCache = new Map();
let assistantEnabled = true;
let assistantExpanded = false;
let appIsQuitting = false;

const WIDGET_SIZE = 76;
const WIDGET_EDGE_GAP = 8;
const PANEL_SIZE = { width: 440, height: 740 };
const SELECTION_PREVIEW_WIDTH = 340;
const QUICK_SELECTION_DELAY_MS = 500;
// The native monitor already waits for a quiet typing interval before sending a draft.
const WRITING_PAUSE_MS = 0;
const WRITING_WINDOW_WIDTH = 420;
const STARTUP_MIN_DURATION_MS = 4000;
let assistantStartupScheduled = false;

function scheduleAssistantStartup() {
  if (assistantStartupScheduled || !assistantEnabled || appIsQuitting) return;
  assistantStartupScheduled = true;
  // Let the main renderer settle before starting the widget and native monitors.
  const delay = Math.max(0, 2500 - (Date.now() - startupShownAt));
  setTimeout(() => {
    if (appIsQuitting) return;
    createAssistantWindow();
    startSelectionMonitor();
    startWritingMonitor();
  }, delay);
}

function transitionToMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindowRevealed) return;
  mainWindowRevealed = true;
  const splash = startupWindow && !startupWindow.isDestroyed() ? startupWindow : null;
  // Prepare the maximized window behind the always-on-top splash first.
  mainWindow.showInactive();
  mainWindow.maximize();
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (splash && !splash.isDestroyed()) splash.close();
    mainWindow.focus();
  }, 250);
}

function createWindow() {
  mainWindowRevealed = false;
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 680,
    icon: path.join(__dirname, '../public/icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    show: false, backgroundColor: '#0f0f1a',
  });
  let loaded = false;
  let uiReady = false;
  let revealed = false;
  const revealWhenReady = () => {
    if (!loaded || !uiReady || revealed) return;
    revealed = true;
    startupShownPromise.then(() => {
      const delay = Math.max(0, STARTUP_MIN_DURATION_MS - (Date.now() - startupShownAt));
      setTimeout(() => transitionToMainWindow(), delay);
    });
  };
  mainWindow.webContents.once('did-finish-load', () => { loaded = true; revealWhenReady(); });
  const onUiReady = (event) => {
    if (event.sender !== mainWindow?.webContents) return;
    uiReady = true;
    clearTimeout(readinessFallback);
    revealWhenReady();
    ipcMain.removeListener('lexforge-ui-ready', onUiReady);
  };
  ipcMain.on('lexforge-ui-ready', onUiReady);
  mainWindow.webContents.once('did-fail-load', () => {
    loaded = true;
    uiReady = true;
    revealWhenReady();
  });
  const readinessFallback = setTimeout(() => {
    uiReady = true;
    revealWhenReady();
  }, 8000);
  mainWindow.once('closed', () => {
    clearTimeout(readinessFallback);
    ipcMain.removeListener('lexforge-ui-ready', onUiReady);
  });
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    if (process.env.LEXFORGE_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
  mainWindow.on('close', (event) => {
    if (!appIsQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createStartupWindow() {
  startupShownAt = 0;
  let resolveShown;
  startupShownPromise = new Promise(resolve => { resolveShown = resolve; });
  startupWindow = new BrowserWindow({
    width: 480, height: 320,
    icon: path.join(__dirname, '../public/icon.ico'),
    frame: false, resizable: false, maximizable: false,
    skipTaskbar: true, show: false, alwaysOnTop: true,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#0b3045',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  const splash = startupWindow;
  splash.loadFile(path.join(__dirname, 'startup.html')).then(() => {
    if (splash.isDestroyed()) return;
    // ready-to-show may fire before the splash HTML has painted on Windows.
    setTimeout(() => {
      if (splash.isDestroyed()) return;
      splash.show();
      startupShownAt = Date.now();
      resolveShown();
    }, 100);
  }).catch((error) => {
    console.error('Startup screen failed to load:', error);
    if (!splash.isDestroyed()) {
      splash.show();
      startupShownAt = Date.now();
      resolveShown();
    }
  });
  startupWindow.on('closed', () => {
    if (!startupShownAt) startupShownAt = Date.now();
    resolveShown();
    startupWindow = null;
  });
}

function showMainWindow() {
  if (!mainWindowRevealed && startupWindow && !startupWindow.isDestroyed()) {
    if (startupWindow.isVisible()) startupWindow.focus();
    return;
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(async () => {
    for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) {
      screen.on(eventName, keepAssistantWindowInWorkArea);
    }
    loadAssistantPreferences();
    createStartupWindow();
    await startupShownPromise;
    try { await initDatabase(); } catch (error) { console.error('Database startup failed:', error); }
    createAssistantTray();
    createWindow();
    scheduleAssistantStartup();
  });

  app.on('window-all-closed', () => {
    // The assistant widget and tray keep the app available after the study window is hidden.
    if (process.platform !== 'darwin' && !assistantWindow && !assistantTray) app.quit();
  });

  app.on('activate', () => {
    if (process.platform === 'darwin') showMainWindow();
  });
  app.on('before-quit', () => {
    appIsQuitting = true;
    if (assistantTray) {
      assistantTray.destroy();
      assistantTray = null;
    }
    stopSelectionMonitor();
    stopWritingMonitor();
    clearQuickSelection();
    stopOutsideClickWatcher();
  });
}

// ─── Desktop assistant widget and tray ────────────────────────────────────────
function assistantPreferencesPath() {
  return path.join(app.getPath('userData'), 'assistant-widget.json');
}

function loadAssistantPreferences() {
  try {
    const preferences = JSON.parse(fs.readFileSync(assistantPreferencesPath(), 'utf8'));
    if (typeof preferences.enabled === 'boolean') assistantEnabled = preferences.enabled;
    if (preferences.theme === 'light' || preferences.theme === 'dark') assistantTheme = preferences.theme;
    if (Number.isFinite(preferences.widgetPosition?.x) && Number.isFinite(preferences.widgetPosition?.y)) {
      assistantWidgetPosition = {
        x: Math.round(preferences.widgetPosition.x),
        y: Math.round(preferences.widgetPosition.y),
      };
    }
  } catch (_) {
    assistantEnabled = true;
  }
}

function saveAssistantPreferences() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const preferences = { enabled: assistantEnabled, theme: assistantTheme };
    if (assistantWidgetPosition) preferences.widgetPosition = assistantWidgetPosition;
    fs.writeFileSync(assistantPreferencesPath(), JSON.stringify(preferences, null, 2));
  } catch (error) {
    console.error('Could not save assistant preferences:', error.message);
  }
}

function setAssistantTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return assistantTheme;
  if (assistantTheme === theme) return assistantTheme;
  assistantTheme = theme;
  saveAssistantPreferences();
  for (const window of [mainWindow, assistantWindow, writingWindow, selectionPreviewWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
      window.webContents.send('assistant:theme-changed', assistantTheme);
  }
  return assistantTheme;
}

function getAssistantState() {
  return {
    enabled: assistantEnabled,
    expanded: assistantExpanded,
    version: app.getVersion(),
    selectionMonitoring: Boolean(selectionMonitorReady && selectionMonitorProcess && !selectionMonitorProcess.killed),
    selectionMonitorMessage,
    writingMonitoring: Boolean(writingMonitorReady && writingMonitorProcess && !writingMonitorProcess.killed),
    writingMonitorMessage,
  };
}

function sendAssistantState() {
  if (assistantWindow && !assistantWindow.isDestroyed() && !assistantWindow.webContents.isDestroyed()) {
    assistantWindow.webContents.send('assistant:state-changed', getAssistantState());
  }
}

function clampBoundsToWorkArea(bounds, anchor = null) {
  const point = anchor || { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const workArea = screen.getDisplayNearestPoint(point).workArea;
  return clampBoundsToArea(bounds, workArea);
}

function clampBoundsToArea(bounds, workArea) {
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - height);

  return {
    ...bounds,
    width,
    height,
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
  };
}

function snapWidgetBoundsToDisplay(bounds, display,
    pointerX = bounds.x + bounds.width / 2) {
  const withinWorkArea = clampBoundsToArea(bounds, display.workArea);
  const { workArea } = display;
  const gap = Math.min(WIDGET_EDGE_GAP, Math.max(0, (workArea.width - withinWorkArea.width) / 2));
  const onLeft = pointerX < display.bounds.x + display.bounds.width / 2;
  return {
    ...withinWorkArea,
    x: Math.round(onLeft
      ? workArea.x + gap
      : workArea.x + workArea.width - withinWorkArea.width - gap),
  };
}

function snapWidgetBounds(bounds) {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return snapWidgetBoundsToDisplay(bounds, screen.getDisplayNearestPoint(center));
}

function getInitialWidgetBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const defaultBounds = {
    x: workArea.x + workArea.width - WIDGET_SIZE - 24,
    y: workArea.y + workArea.height - WIDGET_SIZE - 24,
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
  };
  if (!assistantWidgetPosition) return snapWidgetBounds(defaultBounds);
  const savedBounds = { ...defaultBounds, ...assistantWidgetPosition };
  return isWidgetReachable(savedBounds)
    ? snapWidgetBounds(savedBounds)
    : snapWidgetBounds(defaultBounds);
}

function isWidgetReachable(bounds) {
  return screen.getAllDisplays().some(({ bounds: display }) => {
    const visibleWidth = Math.max(0, Math.min(bounds.x + bounds.width, display.x + display.width) - Math.max(bounds.x, display.x));
    const visibleHeight = Math.max(0, Math.min(bounds.y + bounds.height, display.y + display.height) - Math.max(bounds.y, display.y));
    return visibleWidth >= 32 && visibleHeight >= 32;
  });
}

function keepAssistantWindowInWorkArea() {
  if (!assistantWindow || assistantWindow.isDestroyed()) return;
  const bounds = assistantExpanded
    ? clampBoundsToWorkArea(assistantWindow.getBounds())
    : snapWidgetBounds(assistantWindow.getBounds());
  assistantWindow.setBounds(bounds, false);
  if (assistantExpanded) {
    assistantExpandedBounds = bounds;
  } else {
    assistantWidgetPosition = { x: bounds.x, y: bounds.y };
    saveAssistantPreferences();
  }
}

function resizeAssistantWindow(expanded) {
  if (!assistantWindow || assistantWindow.isDestroyed()) return;

  const current = assistantWindow.getBounds();
  const size = expanded ? PANEL_SIZE : { width: WIDGET_SIZE, height: WIDGET_SIZE };
  if (expanded && !assistantExpanded) {
    assistantCollapsedOrigin = { x: current.x, y: current.y };
  }
  const panelWasMoved = !expanded && assistantExpandedBounds && (
    current.x !== assistantExpandedBounds.x || current.y !== assistantExpandedBounds.y
  );
  const collapsedPosition = panelWasMoved
    ? { x: current.x + current.width - size.width, y: current.y + current.height - size.height }
    : (assistantCollapsedOrigin || { x: current.x + current.width - size.width, y: current.y + current.height - size.height });
  const proposedBounds = {
    x: expanded ? current.x + current.width - size.width : collapsedPosition.x,
    y: expanded ? current.y + current.height - size.height : collapsedPosition.y,
    width: size.width,
    height: size.height,
  };
  const bounds = expanded
    ? clampBoundsToWorkArea(proposedBounds)
    : snapWidgetBounds(proposedBounds);

  assistantExpanded = expanded;
  if (expanded) {
    clearQuickSelection();
    clearWritingSuggestion();
  }
  assistantWindow.setBounds(bounds, false);
  if (!expanded) {
    assistantCollapsedOrigin = null;
    assistantExpandedBounds = null;
    assistantWidgetPosition = { x: bounds.x, y: bounds.y };
    saveAssistantPreferences();
    assistantWindow.setAlwaysOnTop(true, 'floating');
    assistantWindow.showInactive();
  } else {
    assistantExpandedBounds = assistantWindow.getBounds();
    startOutsideClickWatcher();
  }
  sendAssistantState();
}

function collapseAssistantPanel() {
  if (!assistantWindow || assistantWindow.isDestroyed()) return;
  resizeAssistantWindow(false);
  assistantWindow.setAlwaysOnTop(true, 'floating');
  assistantWindow.showInactive();
  assistantWindow.moveTop();
}

function handleOutsideClickLine(line) {
  let event;
  try { event = JSON.parse(line); } catch (_) { return; }
  if (event.type === 'mouseMove') { moveAssistantDrag(event); return; }
  if (event.type === 'mouseUp') {
    moveAssistantDrag(event);
    finishAssistantDrag();
    return;
  }
  if (event.type !== 'mouseDown') return;
  if (/^(screenclippinghost|snippingtool)$/i.test(event.foregroundProcess || '')) return;
  if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) return;

  // The native monitor identifies the window under the pointer. This avoids
  // misclassifying clicks inside the panel on mixed-DPI displays.
  const inside = (window) => {
    if (event.targetWindow !== undefined) {
      return event.targetWindow === window.getNativeWindowHandle().readBigInt64LE().toString();
    }
    // Older helper binaries do not include targetWindow. Keep this fallback
    // for writing popups; never collapse the assistant on uncertain clicks.
    const bounds = screen.dipToScreenRect(window, window.getBounds());
    return event.x >= bounds.x && event.x < bounds.x + bounds.width &&
      event.y >= bounds.y && event.y < bounds.y + bounds.height;
  };
  if (assistantExpanded && assistantWindow && !assistantWindow.isDestroyed() &&
      assistantWindow.isVisible() && event.targetWindow !== undefined && !inside(assistantWindow)) {
    setTimeout(() => {
      if (assistantExpanded && assistantWindow && !assistantWindow.isDestroyed() &&
          assistantWindow.isVisible() && Date.now() - lastAssistantPointerDownAt > 150) {
        collapseAssistantPanel();
      }
    }, 80);
  }
  if (writingWindow && !writingWindow.isDestroyed() && writingWindow.isVisible() &&
      !inside(writingWindow)) {
    dismissedWritingRevision = writingDraft?.revision ?? null;
    clearWritingSuggestion();
  }
}

function startOutsideClickWatcher() {
  if (process.platform !== 'win32' || appIsQuitting || outsideClickProcess) return;
  if (outsideClickRestartTimer) {
    clearTimeout(outsideClickRestartTimer);
    outsideClickRestartTimer = null;
  }
  const executable = selectionMonitorExecutablePath();
  if (!fs.existsSync(executable)) return;

  outsideClickBuffer = '';
  try {
    const child = spawn(executable, ['--watch-clicks'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    outsideClickProcess = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      outsideClickBuffer += chunk;
      const lines = outsideClickBuffer.split(/\r?\n/);
      outsideClickBuffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) handleOutsideClickLine(line);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => console.warn('Outside click watcher:', chunk.trim().slice(0, 500)));
    child.on('error', (error) => {
      console.error('Could not start outside click watcher:', error.message);
      if (outsideClickProcess === child) {
        outsideClickProcess = null;
        scheduleOutsideClickWatcherRestart();
      }
    });
    child.on('close', () => {
      if (outsideClickProcess === child) {
        outsideClickProcess = null;
        scheduleOutsideClickWatcherRestart();
      }
    });
  } catch (error) {
    console.error('Could not start outside click watcher:', error.message);
    outsideClickProcess = null;
    scheduleOutsideClickWatcherRestart();
  }
}

function scheduleOutsideClickWatcherRestart() {
  if (appIsQuitting || outsideClickRestartTimer) return;
  outsideClickRestartTimer = setTimeout(() => {
    outsideClickRestartTimer = null;
    startOutsideClickWatcher();
  }, 2000);
}

function stopOutsideClickWatcher() {
  if (outsideClickRestartTimer) {
    clearTimeout(outsideClickRestartTimer);
    outsideClickRestartTimer = null;
  }
  const child = outsideClickProcess;
  outsideClickProcess = null;
  outsideClickBuffer = '';
  if (child && !child.killed) child.kill();
}

function showAssistantPanel() {
  if (!assistantWindow || assistantWindow.isDestroyed()) {
    createAssistantWindow();
  }

  if (assistantExpanded) {
    assistantWindow.setBounds(clampBoundsToWorkArea(assistantWindow.getBounds()), false);
  }
  assistantWindow.setAlwaysOnTop(true, 'floating');
  assistantWindow.show();
  assistantWindow.focus();
  if (!assistantExpanded) resizeAssistantWindow(true);
  sendAssistantState();
}

function showAssistantBubble() {
  if (!assistantWindow || assistantWindow.isDestroyed()) createAssistantWindow();
  if (assistantExpanded) resizeAssistantWindow(false);
  // Return the bubble to its default position when explicitly requested.
  const workArea = screen.getPrimaryDisplay().workArea;
  const x = workArea.x + workArea.width - WIDGET_SIZE - WIDGET_EDGE_GAP;
  const y = workArea.y + workArea.height - WIDGET_SIZE;
  assistantWindow.setPosition(x, y);
  assistantWidgetPosition = { x, y };
  saveAssistantPreferences();
  assistantWindow.setAlwaysOnTop(true, 'floating');
  assistantWindow.showInactive();
  assistantWindow.moveTop();
  sendAssistantState();
}

function createAssistantWindow() {
  if (assistantWindow && !assistantWindow.isDestroyed()) return assistantWindow;

  assistantExpanded = false;
  assistantWindow = new BrowserWindow({
    ...getInitialWidgetBounds(),
    title: 'Trợ lý tiếng Anh',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'assistant-widget-preload.js'),
    },
  });

  assistantWindow.setAlwaysOnTop(true, 'floating');
  assistantWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  assistantWindow.loadFile(path.join(__dirname, 'assistant-widget.html'));
  const revealAssistant = () => {
    if (!assistantWindow || assistantWindow.isDestroyed() || assistantWindow.isVisible()) return;
    assistantWindow.setAlwaysOnTop(true, 'floating');
    assistantWindow.showInactive();
    startOutsideClickWatcher();
    sendAssistantState();
  };
  assistantWindow.once('ready-to-show', revealAssistant);
  assistantWindow.webContents.once('did-finish-load', revealAssistant);
  assistantWindow.on('focus', () => {
    if (!assistantWindow || assistantWindow.isDestroyed()) return;
    assistantWindow.setAlwaysOnTop(true, 'floating');
  });
  assistantWindow.on('close', (event) => {
    if (appIsQuitting) return;
    event.preventDefault();
    if (isDev) console.warn('Ignored native assistant close; use the panel control to collapse it.');
  });
  assistantWindow.on('closed', () => {
    assistantWindow = null;
    assistantExpanded = false;
  });

  return assistantWindow;
}

function selectionMonitorExecutablePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'selection-monitor', 'Lexforge.SelectionMonitor.exe');
  }

  if (devSelectionMonitorPath) return devSelectionMonitorPath;
  const bin = path.join(__dirname, 'selection-monitor', 'bin', 'Release');
  const candidates = ['net10.0-windows', 'net10.0-windows-v2']
    .map(name => path.join(bin, name, 'Lexforge.SelectionMonitor.exe'))
    .filter(candidate => fs.existsSync(candidate))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!candidates.length) return path.join(bin, 'net10.0-windows', 'Lexforge.SelectionMonitor.exe');

  const sourceDir = path.dirname(candidates[0]);
  const runDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'lexforge-monitor-'));
  const name = 'Lexforge.SelectionMonitor';
  for (const extension of ['.exe', '.dll', '.deps.json', '.runtimeconfig.json']) {
    fs.copyFileSync(path.join(sourceDir, name + extension), path.join(runDir, name + extension));
  }
  devSelectionMonitorPath = path.join(runDir, name + '.exe');
  return devSelectionMonitorPath;
}

function createSelectionPreviewWindow() {
  if (selectionPreviewWindow && !selectionPreviewWindow.isDestroyed()) return selectionPreviewWindow;
  selectionPreviewWindow = new BrowserWindow({
    width: SELECTION_PREVIEW_WIDTH,
    height: 70,
    title: 'Bản dịch nhanh',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'selection-preview-preload.js'),
    },
  });
  selectionPreviewWindow.setIgnoreMouseEvents(true, { forward: true });
  selectionPreviewWindow.setAlwaysOnTop(true, 'floating');
  selectionPreviewWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  selectionPreviewWindow.loadFile(path.join(__dirname, 'selection-preview.html'));
  selectionPreviewWindow.on('close', (event) => {
    if (!appIsQuitting) event.preventDefault();
  });
  const preview = selectionPreviewWindow;
  preview.on('closed', () => {
    if (selectionPreviewWindow === preview) selectionPreviewWindow = null;
  });
  return selectionPreviewWindow;
}

function clearQuickSelection() {
  quickSelectionVersion++;
  if (quickSelectionTimer) clearTimeout(quickSelectionTimer);
  quickSelectionTimer = null;
  if (quickSelectionAbort) quickSelectionAbort.abort();
  quickSelectionAbort = null;
  quickSelectionBounds = null;
  const preview = selectionPreviewWindow;
  selectionPreviewWindow = null;
  if (preview && !preview.isDestroyed()) preview.destroy();
}

function looksLikeEnglishSelection(text) {
  const words = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
  return text.length <= 400 && words.length > 0 && words.length <= 80 &&
    /[A-Za-z]{2}/.test(text) && !/[À-ỹ]/u.test(text) &&
    !/https?:\/\/|www\.|@/.test(text);
}

function scheduleQuickTranslation(selection) {
  clearQuickSelection();
  if (!assistantEnabled || !looksLikeEnglishSelection(selection.text)) return;
  const version = quickSelectionVersion;
  quickSelectionBounds = selection.bounds;
  quickSelectionTimer = setTimeout(async () => {
    quickSelectionTimer = null;
    if (version !== quickSelectionVersion || !assistantEnabled) return;
    const cached = quickTranslationCache.get(selection.text);
    if (cached) {
      showQuickTranslation(cached, version);
      return;
    }
    const controller = new AbortController();
    quickSelectionAbort = controller;
    try {
      const translation = await requestQuickTranslation(selection.text, controller.signal);
      if (version !== quickSelectionVersion || !translation) return;
      quickTranslationCache.set(selection.text, translation);
      if (quickTranslationCache.size > 30) quickTranslationCache.delete(quickTranslationCache.keys().next().value);
      showQuickTranslation(translation, version);
    } catch (error) {
      if (!controller.signal.aborted) {
        if (isDev) console.warn('Quick translation unavailable:', error.message);
        showQuickTranslation(getWritingTaskErrorMessage(error), version, true);
      }
    } finally {
      if (quickSelectionAbort === controller) quickSelectionAbort = null;
    }
  }, QUICK_SELECTION_DELAY_MS);
}

function showQuickTranslation(translation, version, failed = false) {
  if (version !== quickSelectionVersion || !quickSelectionBounds) return;
  const preview = createSelectionPreviewWindow();
  const send = () => {
    if (version !== quickSelectionVersion || preview.isDestroyed()) return;
    preview.webContents.send('assistant:quick-translation', { translation, version, failed });
  };
  if (preview.webContents.isLoading()) preview.webContents.once('did-finish-load', send);
  else send();
}

function positionQuickTranslation(height, version) {
  if (version !== quickSelectionVersion || !quickSelectionBounds || !selectionPreviewWindow || selectionPreviewWindow.isDestroyed()) return;
  const bounds = quickSelectionBounds;
  const topLeft = screen.screenToDipPoint({ x: bounds.x, y: bounds.y });
  const bottomRight = screen.screenToDipPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
  const selection = {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
  const workArea = screen.getDisplayNearestPoint({ x: selection.x, y: selection.y }).workArea;
  const width = Math.min(SELECTION_PREVIEW_WIDTH, workArea.width);
  const previewHeight = Math.min(Math.max(Math.round(height), 58), Math.min(230, workArea.height));
  const belowY = selection.y + selection.height + 8;
  const aboveY = selection.y - previewHeight - 10;
  const preferredY = belowY + previewHeight <= workArea.y + workArea.height ? belowY : aboveY;
  const x = Math.min(Math.max(selection.x, workArea.x), workArea.x + workArea.width - width);
  const y = Math.min(Math.max(preferredY, workArea.y), workArea.y + workArea.height - previewHeight);
  selectionPreviewWindow.setBounds({ x: Math.round(x), y: Math.round(y), width, height: previewHeight }, false);
  selectionPreviewWindow.showInactive();
}

function handleSelectionMonitorLine(line) {
  let event;
  try {
    event = JSON.parse(line);
  } catch (_) {
    return;
  }

  if (event.type === 'selection' && typeof event.text === 'string' && event.text.trim() && event.bounds) {
    scheduleQuickTranslation({ text: event.text.trim(), bounds: event.bounds });
  } else if (event.type === 'clear') {
    clearQuickSelection();
  } else if (event.type === 'ready') {
    selectionMonitorReady = true;
    selectionMonitorMessage = 'Đã kết nối nhận diện vùng chọn.';
    sendAssistantState();
  }
}

function startSelectionMonitor() {
  if (!assistantEnabled || process.platform !== 'win32' || appIsQuitting) return;
  if (selectionMonitorProcess && !selectionMonitorProcess.killed) return;
  if (selectionMonitorRestartTimer) clearTimeout(selectionMonitorRestartTimer);
  selectionMonitorRestartTimer = null;

  selectionMonitorReady = false;
  selectionMonitorMessage = 'Đang khởi tạo nhận diện vùng chọn…';
  const executable = selectionMonitorExecutablePath();
  if (!fs.existsSync(executable)) {
    console.warn('Selection monitor is not built yet. Run npm run build:selection-monitor:dev.');
    selectionMonitorMessage = isDev
      ? 'Chưa có bộ nhận diện vùng chọn. Hãy chạy npm run build:selection-monitor:dev.'
      : 'Không tìm thấy bộ nhận diện vùng chọn trong bản cài đặt.';
    sendAssistantState();
    return;
  }

  selectionMonitorBuffer = '';
  try {
    const child = spawn(executable, ['--ignore-pid', String(process.pid)], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    selectionMonitorProcess = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      selectionMonitorBuffer += chunk;
      const lines = selectionMonitorBuffer.split(/\r?\n/);
      selectionMonitorBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) handleSelectionMonitorLine(line);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => console.warn('Selection monitor:', chunk.trim().slice(0, 500)));
    child.on('error', (error) => {
      console.error('Could not start selection monitor:', error.message);
      if (selectionMonitorProcess !== child) return;
      selectionMonitorProcess = null;
      selectionMonitorReady = false;
      selectionMonitorMessage = 'Không khởi động được nhận diện vùng chọn. Hãy tắt rồi bật lại trợ lý.';
      clearQuickSelection();
      sendAssistantState();
      scheduleSelectionMonitorRestart();
    });
    child.on('close', (code) => {
      if (selectionMonitorProcess !== child) return;
      selectionMonitorProcess = null;
      selectionMonitorReady = false;
      selectionMonitorMessage = assistantEnabled
        ? `Nhận diện vùng chọn đã dừng${code === 0 ? '.' : ' bất ngờ. Hãy tắt rồi bật lại trợ lý.'}`
        : 'Trợ lý đang tắt.';
      clearQuickSelection();
      sendAssistantState();
      scheduleSelectionMonitorRestart();
    });
  } catch (error) {
    console.error('Could not start selection monitor:', error.message);
    selectionMonitorProcess = null;
    selectionMonitorReady = false;
    selectionMonitorMessage = 'Không khởi động được nhận diện vùng chọn. Hãy tắt rồi bật lại trợ lý.';
    sendAssistantState();
    scheduleSelectionMonitorRestart();
  }
}

function scheduleSelectionMonitorRestart() {
  if (!assistantEnabled || appIsQuitting || selectionMonitorRestartTimer) return;
  selectionMonitorRestartTimer = setTimeout(() => {
    selectionMonitorRestartTimer = null;
    startSelectionMonitor();
  }, 3000);
}

function stopSelectionMonitor() {
  if (selectionMonitorRestartTimer) clearTimeout(selectionMonitorRestartTimer);
  selectionMonitorRestartTimer = null;
  const child = selectionMonitorProcess;
  selectionMonitorProcess = null;
  selectionMonitorReady = false;
  selectionMonitorMessage = 'Trợ lý đang tắt.';
  selectionMonitorBuffer = '';
  clearQuickSelection();
  if (child && !child.killed) child.kill();
  sendAssistantState();
}

async function requestQuickTranslation(text, signal) {
  if (!db) throw new Error('DATABASE_NOT_READY');
  const settings = db.exec('SELECT SettingValue FROM UserSettings WHERE SettingKey = ?', ['groq_api_key']);
  const apiKey = settings[0]?.values?.[0]?.[0];
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('NO_GROQ_KEY');

  const requestController = new AbortController();
  const onAbort = () => requestController.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) requestController.abort();
  const timeout = setTimeout(() => requestController.abort(), 15_000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: requestController.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: 'Translate the English text into natural Vietnamese for a small on-screen preview. Output only the Vietnamese translation, with no labels, notes, quotes or Markdown. If the input is not English, output exactly SKIP.',
          },
          { role: 'user', content: text },
        ],
        reasoning_effort: 'low',
        temperature: 0.1,
        max_completion_tokens: 300,
      }),
    });
    if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);
    const data = await response.json();
    const translation = data.choices?.[0]?.message?.content?.trim();
    if (!translation || /^SKIP[.!]?$/i.test(translation)) return '';
    return translation.slice(0, 900);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', onAbort);
  }
}

function createWritingWindow() {
  if (writingWindow && !writingWindow.isDestroyed()) return writingWindow;
  writingWindow = new BrowserWindow({
    width: WRITING_WINDOW_WIDTH,
    height: 180,
    title: 'Hỗ trợ viết nhanh',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'writing-popup-preload.js'),
    },
  });
  writingWindow.setAlwaysOnTop(true, 'floating');
  writingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  writingWindow.loadFile(path.join(__dirname, 'writing-popup.html'));
  writingWindow.on('close', (event) => {
    if (!appIsQuitting) event.preventDefault();
  });
  writingWindow.on('move', () => {
    if (!positioningWritingWindow && writingWindow && !writingWindow.isDestroyed() && writingWindow.isVisible()) {
      const { x, y } = writingWindow.getBounds();
      if (lastProgrammaticWritingBounds?.x === x && lastProgrammaticWritingBounds?.y === y) return;
      manualWritingPosition = { x, y, revision: writingDraft?.revision };
    }
  });
  const popup = writingWindow;
  popup.on('closed', () => {
    if (writingWindow === popup) writingWindow = null;
    manualWritingPosition = null;
  });
  return writingWindow;
}

function clearWritingSuggestion() {
  writingRequestVersion++;
  if (writingTimer) clearTimeout(writingTimer);
  writingTimer = null;
  if (writingAbort) writingAbort.abort();
  writingAbort = null;
  currentWritingSuggestion = null;
  currentWritingTranslation = null;
  if (writingWindow && !writingWindow.isDestroyed()) writingWindow.hide();
}

function positionWritingWindow(height, revision) {
  if (!writingDraft || writingDraft.revision !== revision || !writingWindow || writingWindow.isDestroyed()) return;
  const bounds = writingDraft.bounds;
  const point = screen.screenToDipPoint({ x: bounds.x, y: bounds.y });
  const bottom = screen.screenToDipPoint({ x: bounds.x, y: bounds.y + bounds.height });
  const workArea = screen.getDisplayNearestPoint(point).workArea;
  const width = Math.min(WRITING_WINDOW_WIDTH, workArea.width);
  const popupHeight = Math.min(Math.max(Math.round(height), 116), Math.min(380, workArea.height));
  const belowY = Math.max(point.y, bottom.y) + 8;
  const aboveY = point.y - popupHeight - 8;
  const preferredY = belowY + popupHeight <= workArea.y + workArea.height ? belowY : aboveY;
  const preferredX = manualWritingPosition?.revision === revision ? manualWritingPosition.x : point.x;
  const preferredTop = manualWritingPosition?.revision === revision ? manualWritingPosition.y : preferredY;
  const x = Math.min(Math.max(preferredX, workArea.x), workArea.x + workArea.width - width);
  const y = Math.min(Math.max(preferredTop, workArea.y), workArea.y + workArea.height - popupHeight);
  positioningWritingWindow = true;
  try {
    lastProgrammaticWritingBounds = { x: Math.round(x), y: Math.round(y) };
    writingWindow.setBounds({ x: Math.round(x), y: Math.round(y), width, height: popupHeight }, false);
  }
  finally { positioningWritingWindow = false; }
  if (!writingWindow.isVisible()) {
    writingWindow.show();
    writingWindow.focus();
    if (writingMonitorProcess && !writingMonitorProcess.killed) {
      const handle = writingWindow.getNativeWindowHandle().readBigInt64LE().toString();
      writingMonitorProcess.stdin.write(`${JSON.stringify({ type: 'focusPopup', revision, window: handle })}\n`);
    }
  }
  startOutsideClickWatcher();
}

function showWritingSuggestion(corrected, revision, failure = '') {
  if (!writingDraft || writingDraft.revision !== revision || !assistantEnabled) return;
  manualWritingPosition = null;
  currentWritingSuggestion = corrected;
  const popup = createWritingWindow();
  const send = () => {
    if (!popup.isDestroyed() && writingDraft?.revision === revision) {
      popup.webContents.send('assistant:writing-suggestion', {
        revision,
        original: writingDraft.text,
        corrected,
        failure,
      });
    }
  };
  if (popup.webContents.isLoading()) popup.webContents.once('did-finish-load', send);
  else send();
}

async function requestGrammarSuggestion(text, signal) {
  if (!db) throw new Error('DATABASE_NOT_READY');
  const settings = db.exec('SELECT SettingValue FROM UserSettings WHERE SettingKey = ?', ['groq_api_key']);
  const apiKey = settings[0]?.values?.[0]?.[0];
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('NO_GROQ_KEY');

  const timeout = setTimeout(() => signal.abort(new Error('TIMEOUT')), 20_000);
  try {
    const messages = [
      { role: 'system', content: 'You are an English grammar assistant. Correct only genuine grammar or spelling errors in the supplied English sentence or unfinished sentence. If it is a clear unfinished fragment, complete it naturally without adding new facts. Preserve the writer’s meaning, names and tone. Do not suggest stylistic rewrites when grammar is already fine. Return only JSON: {"needsCorrection":true or false,"corrected":"one complete English line"}. If the text is not English or is already correct, set needsCorrection to false.' },
      { role: 'user', content: text },
    ];
    const request = (model) => fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: signal.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({
        model, messages,
        max_completion_tokens: 700,
      }),
    });
    let response = await request('openai/gpt-oss-20b');
    if (response.status === 400 || response.status === 403) response = await request('openai/gpt-oss-120b');
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      if (isDev) console.warn('Writing Groq request rejected:', response.status,
        errorBody?.error?.code || '', errorBody?.error?.type || '');
      throw new Error(`GROQ_HTTP_${response.status}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const json = content.match(/\{[\s\S]*\}/)?.[0] || '{}';
    const result = JSON.parse(json);
    const corrected = typeof result.corrected === 'string' ? result.corrected.trim() : '';
    if (result.needsCorrection !== true || !corrected || corrected === text ||
        corrected.length > 500 || /[\r\n]/.test(corrected)) return '';
    return corrected;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestVietnameseWriting(text) {
  if (!db) throw new Error('DATABASE_NOT_READY');
  const settings = db.exec('SELECT SettingValue FROM UserSettings WHERE SettingKey = ?', ['groq_api_key']);
  const apiKey = settings[0]?.values?.[0]?.[0];
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('NO_GROQ_KEY');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(25_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'Write a natural, grammatically correct English sentence that expresses the Vietnamese input. Preserve its meaning and tone. Output only the English sentence, without quotes, labels, explanation, or Markdown.' },
        { role: 'user', content: text },
      ],
      reasoning_effort: 'low',
      temperature: 0.25,
      max_completion_tokens: 350,
    }),
  });
  if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);
  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim();
  if (!result || result.length > 500 || /[\r\n]/.test(result)) throw new Error('INVALID_RESPONSE');
  return result;
}

function handleWritingMonitorLine(line) {
  let event;
  try { event = JSON.parse(line); } catch (_) { return; }
  if (event.type === 'writingReady') {
    writingMonitorReady = true;
    writingMonitorMessage = 'Hỗ trợ viết nhanh đã sẵn sàng.';
    sendAssistantState();
    return;
  }
  if (event.type === 'applyResult') {
    if (pendingWritingApply && pendingWritingApply.revision === event.revision) {
      failedWritingApplyRevision = event.success === true ? null : event.revision;
      pendingWritingApply.resolve({ success: event.success === true, error: event.error || '' });
      pendingWritingApply = null;
    }
    return;
  }
  if (event.type === 'focusResult') {
    if (pendingWritingFocus && pendingWritingFocus.revision === event.revision) {
      pendingWritingFocus.resolve(event.success === true);
      pendingWritingFocus = null;
    }
    return;
  }
  if (event.type === 'popupFocusResult') {
    if (event.success !== true && isDev) console.warn('Writing popup could not take keyboard focus.');
    return;
  }
  if (event.type === 'draftClear') {
    // Returning focus to an editor can temporarily hide its caret from UIA.
    // Preserve an apply error so the user can actually see why replacement failed.
    if (pendingWritingApply || failedWritingApplyRevision === writingDraft?.revision) return;
    writingDraft = null;
    clearWritingSuggestion();
    return;
  }
  if (event.type === 'draftInput') {
    if (!pendingWritingApply) {
      writingDraft = null;
      failedWritingApplyRevision = null;
      clearWritingSuggestion();
    }
    return;
  }
  if (event.type !== 'draft' || typeof event.text !== 'string' || !event.bounds ||
      !Number.isInteger(event.revision) || !assistantEnabled) return;

  writingDraft = { revision: event.revision, text: event.text, bounds: event.bounds };
  failedWritingApplyRevision = null;
  clearWritingSuggestion();
  if (!looksLikeEnglishSelection(event.text) || event.revision === dismissedWritingRevision) return;
  const requestVersion = writingRequestVersion;
  writingTimer = setTimeout(async () => {
    writingTimer = null;
    if (requestVersion !== writingRequestVersion || !writingDraft || writingDraft.revision !== event.revision) return;
    const controller = new AbortController();
    writingAbort = controller;
    try {
      const corrected = await requestGrammarSuggestion(event.text, controller);
      if (requestVersion === writingRequestVersion && corrected) showWritingSuggestion(corrected, event.revision);
    } catch (error) {
      if (!controller.signal.aborted || controller.signal.reason?.message === 'TIMEOUT') {
        if (isDev) console.warn('Writing suggestion unavailable:', error.message);
        showWritingSuggestion('', event.revision, getWritingTaskErrorMessage(error));
      }
    } finally {
      if (writingAbort === controller) writingAbort = null;
    }
  }, WRITING_PAUSE_MS);
}

function startWritingMonitor() {
  if (!assistantEnabled || process.platform !== 'win32' || appIsQuitting || writingMonitorProcess) return;
  if (writingMonitorRestartTimer) clearTimeout(writingMonitorRestartTimer);
  writingMonitorRestartTimer = null;
  const executable = selectionMonitorExecutablePath();
  if (!fs.existsSync(executable)) {
    writingMonitorMessage = 'Chưa có bộ hỗ trợ viết nhanh trên máy này.';
    sendAssistantState();
    return;
  }
  writingMonitorReady = false;
  writingMonitorMessage = 'Đang khởi tạo hỗ trợ viết nhanh…';
  writingMonitorBuffer = '';
  try {
    const child = spawn(executable, ['--watch-writing', '--ignore-pid', String(process.pid)], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    writingMonitorProcess = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      writingMonitorBuffer += chunk;
      const lines = writingMonitorBuffer.split(/\r?\n/);
      writingMonitorBuffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) handleWritingMonitorLine(line);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => console.warn('Writing monitor:', chunk.trim().slice(0, 500)));
    child.on('error', (error) => {
      if (writingMonitorProcess === child) writingMonitorProcess = null;
      writingMonitorReady = false;
      writingMonitorMessage = 'Không khởi động được hỗ trợ viết nhanh.';
      if (isDev) console.warn('Writing monitor unavailable:', error.message);
      writingDraft = null;
      clearWritingSuggestion();
      sendAssistantState();
      scheduleWritingMonitorRestart();
    });
    child.on('close', () => {
      if (writingMonitorProcess === child) writingMonitorProcess = null;
      writingMonitorReady = false;
      writingMonitorMessage = assistantEnabled ? 'Hỗ trợ viết nhanh đã dừng.' : 'Trợ lý đang tắt.';
      writingDraft = null;
      clearWritingSuggestion();
      sendAssistantState();
      scheduleWritingMonitorRestart();
    });
  } catch (error) {
    writingMonitorProcess = null;
    writingMonitorReady = false;
    writingMonitorMessage = 'Không khởi động được hỗ trợ viết nhanh.';
    if (isDev) console.warn('Writing monitor unavailable:', error.message);
    scheduleWritingMonitorRestart();
  }
}

function scheduleWritingMonitorRestart() {
  if (!assistantEnabled || appIsQuitting || writingMonitorRestartTimer) return;
  writingMonitorRestartTimer = setTimeout(() => {
    writingMonitorRestartTimer = null;
    startWritingMonitor();
  }, 3000);
}

function stopWritingMonitor() {
  if (writingMonitorRestartTimer) clearTimeout(writingMonitorRestartTimer);
  writingMonitorRestartTimer = null;
  const child = writingMonitorProcess;
  writingMonitorProcess = null;
  writingMonitorReady = false;
  writingMonitorMessage = 'Trợ lý đang tắt.';
  writingDraft = null;
  clearWritingSuggestion();
  if (pendingWritingApply) {
    pendingWritingApply.resolve({ success: false, error: 'Trợ lý đang tắt.' });
    pendingWritingApply = null;
  }
  if (pendingWritingFocus) {
    pendingWritingFocus.resolve(false);
    pendingWritingFocus = null;
  }
  if (child && !child.killed) child.kill();
  sendAssistantState();
}

const WRITING_TASKS = {
  translate: {
    label: 'Dịch',
    instruction: 'Dịch tự nhiên, giữ nguyên ý, giọng điệu và tên riêng. Với từ/cụm từ ngắn, nêu nghĩa thường gặp và tối đa ba mục từ vựng hữu ích.',
  },
  grammar: {
    label: 'Kiểm tra và sửa ngữ pháp',
    instruction: 'Kiểm tra ngữ pháp tiếng Anh. Đặt câu đã sửa vào result; nếu câu đã đúng, giữ nguyên ý và nêu trong explanation rằng câu đã đúng. Giải thích ngắn gọn bằng tiếng Việt, tập trung vào lỗi thực sự.',
  },
  complete: {
    label: 'Hoàn chỉnh câu',
    instruction: 'Hoàn chỉnh câu hoặc ý tiếng Anh thành một câu tự nhiên, đúng ngữ pháp, giữ đúng ý người học. Nếu đầu vào đã là câu hoàn chỉnh, đề xuất phiên bản tự nhiên hơn mà không đổi nghĩa.',
  },
  write: {
    label: 'Viết câu tiếng Anh',
    instruction: 'Diễn đạt ý tiếng Việt thành một đến ba câu tiếng Anh tự nhiên và đúng ngữ pháp. Giải thích ngắn cấu trúc được dùng bằng tiếng Việt và nêu tối đa ba từ/cụm từ hữu ích.',
  },
};

function getWritingTaskErrorMessage(error) {
  const code = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'TIMEOUT' : error.message;
  const messages = {
    DATABASE_NOT_READY: 'Cơ sở dữ liệu đang khởi động. Hãy thử lại sau ít giây.',
    NO_GROQ_KEY: 'Chưa có Groq API key. Hãy thêm khóa trong Cài Đặt.',
    INVALID_GROQ_KEY: 'Groq API key không hợp lệ. Hãy kiểm tra lại trong Cài Đặt.',
    GROQ_RATE_LIMIT: 'Groq đang giới hạn yêu cầu. Hãy đợi một chút rồi thử lại.',
    TIMEOUT: 'Yêu cầu mất quá nhiều thời gian. Hãy kiểm tra mạng rồi thử lại.',
    INVALID_RESPONSE: 'AI trả về kết quả chưa đúng định dạng. Hãy thử lại.',
    EMPTY_RESPONSE: 'AI chưa trả về nội dung. Hãy thử lại.',
  };
  const statusMatch = /^GROQ_HTTP_(\d{3})$/.exec(code || '');
  if (statusMatch?.[1] === '401') return 'Groq từ chối API key (HTTP 401). Hãy tạo khóa mới và lưu trong Cài Đặt.';
  if (statusMatch?.[1] === '403') return 'Groq chặn quyền dùng mô hình (HTTP 403). Hãy kiểm tra quyền mô hình của tổ chức hoặc dự án trên Groq.';
  if (statusMatch?.[1] === '400') return 'Groq từ chối định dạng yêu cầu (HTTP 400). Hãy kiểm tra log ứng dụng để biết mã lỗi.';
  if (statusMatch?.[1] === '429') return 'Groq đang giới hạn yêu cầu. Hãy đợi một chút rồi thử lại.';
  if (statusMatch) return `Groq trả về lỗi HTTP ${statusMatch[1]}. Hãy thử lại sau.`;
  return messages[code] || 'Không kết nối được Groq. Hãy kiểm tra mạng rồi thử lại.';
}

async function runWritingTask(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, error: 'Yêu cầu không hợp lệ.' };
  }

  const task = input.task;
  const original = typeof input.text === 'string' ? input.text.trim() : '';
  const taskDefinition = Object.prototype.hasOwnProperty.call(WRITING_TASKS, task) ? WRITING_TASKS[task] : null;
  if (!taskDefinition) return { success: false, error: 'Hãy chọn một công cụ hợp lệ.' };
  if (!original) return { success: false, error: 'Hãy nhập từ, câu hoặc ý tưởng trước khi thực hiện.' };
  if (original.length > 5000) return { success: false, error: 'Nội dung tối đa 5.000 ký tự.' };

  const directionInstructions = {
    auto: 'Tự nhận diện ngôn ngữ nguồn và dịch sang ngôn ngữ còn lại.',
    'en-vi': 'Dịch từ tiếng Anh sang tiếng Việt.',
    'vi-en': 'Dịch từ tiếng Việt sang tiếng Anh.',
  };
  const direction = input.direction || 'auto';
  if (task === 'translate' && !directionInstructions[direction]) {
    return { success: false, error: 'Hãy chọn chiều dịch hợp lệ.' };
  }

  try {
    if (!db) throw new Error('DATABASE_NOT_READY');
    const settings = db.exec('SELECT SettingValue FROM UserSettings WHERE SettingKey = ?', ['groq_api_key']);
    const apiKey = settings[0]?.values?.[0]?.[0];
    if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('NO_GROQ_KEY');

    const directionPrompt = task === 'translate' ? `\n${directionInstructions[direction]}` : '';
    const systemPrompt = `You are a concise English–Vietnamese language coach. ${taskDefinition.instruction}${directionPrompt}\nReturn only a valid JSON object with exactly these keys: {"result":"the main answer","explanation":"a brief Vietnamese explanation or empty string","suggestions":["optional alternative phrasing"],"vocabulary":[{"term":"English word or phrase","meaning":"Vietnamese meaning","example":"short English example"}]}. Keep result easy to copy. Use at most two suggestions and three vocabulary items. Use empty arrays when they do not help. Do not include Markdown fences.`;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: original },
        ],
        reasoning_effort: 'low',
        temperature: 0.25,
        max_completion_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.status === 401 || response.status === 403) throw new Error(`GROQ_HTTP_${response.status}`);
    if (response.status === 429) throw new Error('GROQ_RATE_LIMIT');
    if (!response.ok) throw new Error(`GROQ_HTTP_${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('EMPTY_RESPONSE');

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      throw new Error('INVALID_RESPONSE');
    }
    if (!parsed || typeof parsed.result !== 'string' || !parsed.result.trim()) {
      throw new Error('INVALID_RESPONSE');
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((item) => typeof item === 'string' && item.trim()).slice(0, 2)
      : [];
    const vocabulary = Array.isArray(parsed.vocabulary)
      ? parsed.vocabulary
        .filter((item) => item && typeof item.term === 'string' && typeof item.meaning === 'string')
        .slice(0, 3)
        .map((item) => ({
          term: item.term.slice(0, 120),
          meaning: item.meaning.slice(0, 240),
          example: typeof item.example === 'string' ? item.example.slice(0, 300) : '',
        }))
      : [];

    return {
      success: true,
      task,
      taskLabel: taskDefinition.label,
      original,
      result: parsed.result.trim(),
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation.trim().slice(0, 1200) : '',
      suggestions,
      vocabulary,
    };
  } catch (error) {
    return { success: false, error: getWritingTaskErrorMessage(error) };
  }
}

function getTrayIcon() {
  const candidates = isDev
    ? [path.join(__dirname, '../public/icon.ico'), path.join(__dirname, '../build/icon.ico')]
    : [path.join(__dirname, '../build/icon.ico'), path.join(__dirname, '../public/icon.ico')];
  const iconPath = candidates.find((candidate) => fs.existsSync(candidate));
  return iconPath ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }) : nativeImage.createEmpty();
}

function updateAssistantTrayMenu() {
  if (!assistantTray) return;

  assistantTray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở bảng trợ lý', click: showAssistantPanel },
    { label: 'Mở TOEIC Vocab Master', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Bật trợ lý',
      type: 'checkbox',
      checked: assistantEnabled,
      click: (item) => setAssistantEnabled(item.checked),
    },
    { type: 'separator' },
    { label: 'Khởi động lại Lexforge', click: () => { app.relaunch(); app.quit(); } },
    { label: 'Thoát Lexforge', click: () => app.quit() },
  ]));
}

function createAssistantTray() {
  const trayIcon = getTrayIcon();
  if (trayIcon.isEmpty()) {
    console.warn('Tray icon could not be loaded; the floating assistant remains available.');
    return;
  }

  try {
    assistantTray = new Tray(trayIcon);
    assistantTray.setToolTip('TOEIC Vocab Master — Trợ lý tiếng Anh');
    assistantTray.on('click', showAssistantPanel);
    assistantTray.on('double-click', showAssistantPanel);
    updateAssistantTrayMenu();
  } catch (error) {
    assistantTray = null;
    console.error('Could not create assistant tray:', error.message);
  }
}

function setAssistantEnabled(enabled) {
  assistantEnabled = Boolean(enabled);
  saveAssistantPreferences();
  if (assistantEnabled) {
    createAssistantWindow();
    startSelectionMonitor();
    startWritingMonitor();
  } else {
    stopSelectionMonitor();
    stopWritingMonitor();
  }
  updateAssistantTrayMenu();
  sendAssistantState();
  return getAssistantState();
}

function assertAssistantSender(event) {
  if (!assistantWindow || event.sender.id !== assistantWindow.webContents.id) {
    throw new Error('Assistant widget IPC request came from an unexpected window.');
  }
}

function assertThemeSender(event) {
  const windows = [mainWindow, assistantWindow, writingWindow, selectionPreviewWindow];
  if (!windows.some(window => window && !window.isDestroyed() && event.sender.id === window.webContents.id))
    throw new Error('Theme IPC request came from an unexpected window.');
}

ipcMain.handle('assistant:get-theme', (event) => {
  assertThemeSender(event);
  return assistantTheme;
});
ipcMain.handle('assistant:set-theme', (event, theme) => {
  assertThemeSender(event);
  return setAssistantTheme(theme);
});

function moveAssistantDrag(point) {
  if (!assistantDragState || !assistantWindow || assistantWindow.isDestroyed() || assistantExpanded) return;
  const cursor = Number.isFinite(point?.x) && Number.isFinite(point?.y)
    ? point : screen.getCursorScreenPoint();
  const state = assistantDragState;
  if (!state.moved && Math.hypot(cursor.x - state.startX, cursor.y - state.startY) < 4) return;
  state.moved = true;
  state.pointerX = cursor.x;
  lastWidgetDragMovedAt = Date.now();
  const displays = screen.getAllDisplays();
  const displayUnderCursor = displays.find(({ bounds: displayBounds }) =>
    cursor.x >= displayBounds.x && cursor.x < displayBounds.x + displayBounds.width &&
    cursor.y >= displayBounds.y && cursor.y < displayBounds.y + displayBounds.height
  );
  if (displayUnderCursor) state.displayId = displayUnderCursor.id;
  const dragDisplay = displays.find(({ id }) => id === state.displayId) ||
    screen.getDisplayNearestPoint(cursor);
  state.displayId = dragDisplay.id;
  const next = snapWidgetBoundsToDisplay({
    width: state.width,
    height: state.height,
    x: Math.round(cursor.x - state.offsetX),
    y: Math.round(cursor.y - state.offsetY),
  }, dragDisplay, cursor.x);
  state.targetBounds = next;
  if (state.lastX !== next.x || state.lastY !== next.y) {
    assistantWindow.setPosition(next.x, next.y);
    state.lastX = next.x;
    state.lastY = next.y;
  }
}

function finishAssistantDrag(moved = false) {
  const state = assistantDragState;
  const didMove = Boolean(state?.moved || moved);
  assistantDragState = null;
  if (assistantWindow && !assistantWindow.isDestroyed() && !assistantWindow.webContents.isDestroyed()) {
    assistantWindow.webContents.send('assistant:drag-finished', didMove);
  }
  if (!didMove || !assistantWindow || assistantWindow.isDestroyed()) return;
  lastWidgetDragMovedAt = Date.now();
  const dragDisplay = screen.getAllDisplays().find(({ id }) => id === state?.displayId) ||
    screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const currentBounds = state?.targetBounds || assistantWindow.getBounds();
  const bounds = snapWidgetBoundsToDisplay(
    currentBounds, dragDisplay,
    state?.pointerX ?? currentBounds.x + currentBounds.width / 2);
  assistantWindow.setPosition(bounds.x, bounds.y);
  const { x, y } = bounds;
  assistantWidgetPosition = { x, y };
  saveAssistantPreferences();
  assistantWindow.setAlwaysOnTop(true, 'floating');
  assistantWindow.showInactive();
}

ipcMain.on('assistant:drag-start', (event) => {
  assertAssistantSender(event);
  if (!assistantWindow || assistantWindow.isDestroyed() || assistantExpanded) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = assistantWindow.getBounds();
  assistantDragState = {
    offsetX: cursor.x - bounds.x,
    offsetY: cursor.y - bounds.y,
    startX: cursor.x,
    startY: cursor.y,
    width: bounds.width,
    height: bounds.height,
    lastX: bounds.x,
    lastY: bounds.y,
    moved: false,
    displayId: screen.getDisplayNearestPoint(cursor).id,
  };
  startOutsideClickWatcher();
});
ipcMain.on('assistant:pointer-down', (event) => {
  assertAssistantSender(event);
  lastAssistantPointerDownAt = Date.now();
});
ipcMain.on('assistant:drag-move', (event) => {
  assertAssistantSender(event);
  moveAssistantDrag();
});
ipcMain.on('assistant:drag-end', (event, moved) => {
  assertAssistantSender(event);
  finishAssistantDrag(moved === true);
});

ipcMain.on('assistant:quick-preview-height', (event, height, version) => {
  if (!selectionPreviewWindow || event.sender.id !== selectionPreviewWindow.webContents.id) return;
  if (!Number.isFinite(height) || !Number.isInteger(version)) return;
  positionQuickTranslation(height, version);
});

function assertWritingSender(event) {
  if (!writingWindow || event.sender.id !== writingWindow.webContents.id) {
    throw new Error('Writing popup request came from an unexpected window.');
  }
}

ipcMain.on('assistant:writing-popup-height', (event, height, revision) => {
  assertWritingSender(event);
  if (Number.isFinite(height) && Number.isInteger(revision)) positionWritingWindow(height, revision);
});
ipcMain.on('assistant:writing-drag-start', (event) => {
  assertWritingSender(event);
  if (!writingWindow || writingWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = writingWindow.getBounds();
  writingDragState = { offsetX: cursor.x - bounds.x, offsetY: cursor.y - bounds.y };
});
ipcMain.on('assistant:writing-drag-move', (event) => {
  assertWritingSender(event);
  if (!writingDragState || !writingWindow || writingWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = writingWindow.getBounds();
  const next = clampBoundsToWorkArea({
    x: cursor.x - writingDragState.offsetX,
    y: cursor.y - writingDragState.offsetY,
    width: bounds.width,
    height: bounds.height,
  });
  writingWindow.setPosition(Math.round(next.x), Math.round(next.y));
  manualWritingPosition = { x: Math.round(next.x), y: Math.round(next.y), revision: writingDraft?.revision };
});
ipcMain.on('assistant:writing-drag-end', (event) => {
  assertWritingSender(event);
  writingDragState = null;
});
ipcMain.handle('assistant:writing-dismiss', async (event, revision) => {
  assertWritingSender(event);
  if (writingDraft?.revision === revision) {
    dismissedWritingRevision = revision;
    if (writingMonitorProcess && !pendingWritingFocus) {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (pendingWritingFocus?.revision === revision) pendingWritingFocus = null;
          resolve(false);
        }, 1_500);
        pendingWritingFocus = {
          revision,
          resolve: (focused) => { clearTimeout(timeout); resolve(focused); },
        };
        writingMonitorProcess.stdin.write(`${JSON.stringify({ type: 'restoreFocus', revision })}\n`);
      });
    }
  }
  clearWritingSuggestion();
});
ipcMain.handle('assistant:writing-translate', async (event, revision, text) => {
  assertWritingSender(event);
  if (!assistantEnabled || writingDraft?.revision !== revision || typeof text !== 'string' ||
      !text.trim() || text.length > 300) return { success: false, error: 'Nội dung không hợp lệ hoặc đã thay đổi.' };
  try {
    const translation = await requestVietnameseWriting(text.trim());
    if (writingDraft?.revision !== revision) return { success: false, error: 'Câu đang viết đã thay đổi.' };
    currentWritingTranslation = translation;
    return { success: true, translation };
  } catch (error) {
    return { success: false, error: getWritingTaskErrorMessage(error) };
  }
});
ipcMain.handle('assistant:writing-apply', async (event, revision, mode, text) => {
  assertWritingSender(event);
  if (!assistantEnabled || !writingMonitorProcess || !writingDraft || writingDraft.revision !== revision ||
      !['replace', 'replaceTranslation'].includes(mode) || typeof text !== 'string' ||
      (mode === 'replace' ? text !== currentWritingSuggestion : text !== currentWritingTranslation)) {
    return { success: false, error: 'Đề xuất đã cũ. Hãy chọn lại ô đang viết.' };
  }
  if (pendingWritingApply) return { success: false, error: 'Đang áp dụng đề xuất trước.' };
  const result = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (pendingWritingApply?.revision === revision) pendingWritingApply = null;
      resolve({ success: false, error: 'Ứng dụng đích phản hồi quá lâu.' });
    }, 15_000);
    pendingWritingApply = {
      revision,
      resolve: (value) => { clearTimeout(timeout); resolve(value); },
    };
    writingMonitorProcess.stdin.write(`${JSON.stringify({ type: 'apply', revision, mode, text })}\n`);
  });
  if (result.success) {
    dismissedWritingRevision = revision;
    clearWritingSuggestion();
  }
  return result;
});

ipcMain.handle('assistant:get-state', (event) => {
  assertAssistantSender(event);
  return getAssistantState();
});
ipcMain.handle('assistant:set-enabled', (event, enabled) => {
  assertAssistantSender(event);
  return setAssistantEnabled(enabled);
});
ipcMain.handle('assistant:open-panel', (event) => {
  assertAssistantSender(event);
  if (Date.now() - lastWidgetDragMovedAt < 300) return getAssistantState();
  showAssistantPanel();
  return getAssistantState();
});
ipcMain.handle('assistant:show-from-main', (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Assistant open request came from an unexpected window.');
  }
  showAssistantBubble();
  return getAssistantState();
});
ipcMain.handle('assistant:collapse-panel', (event) => {
  assertAssistantSender(event);
  collapseAssistantPanel();
  return getAssistantState();
});
ipcMain.handle('assistant:open-main', (event) => {
  assertAssistantSender(event);
  showMainWindow();
});
ipcMain.handle('assistant:quit', (event) => {
  assertAssistantSender(event);
  app.quit();
});
ipcMain.handle('assistant:run-writing-task', async (event, input) => {
  assertAssistantSender(event);
  return runWritingTask(input);
});
ipcMain.handle('assistant:copy-text', (event, text) => {
  assertAssistantSender(event);
  if (typeof text !== 'string' || text.length > 10_000) throw new Error('Invalid copy request.');
  clipboard.writeText(text);
  return { success: true };
});

// ─── sql.js SQLite (Pure JavaScript - No build tools needed!) ─────────────────
const initSqlJs = require('sql.js');

const userDataPath = app.getPath('userData');
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
const DB_PATH = path.join(userDataPath, 'vocab.db');

let db = null;
let SQL = null;

async function initDatabase() {
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`PRAGMA foreign_keys = ON;`);
  createTables();
  migrateSchema();
  saveDb(); // Save initial state
  console.log('✅ sql.js DB initialized at:', DB_PATH);

  // Mutating IPC queries persist immediately; avoid exporting the whole DB every 30 seconds.
}

function migrateSchema() {
  try {
    const res = db.exec("PRAGMA table_info('StudySessionsLSTM');");
    const columns = res.length > 0 ? res[0].values.map(row => row[1]) : [];
    if (columns.length === 0) {
      db.run(`CREATE TABLE IF NOT EXISTS StudySessionsLSTM (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        WordId INTEGER REFERENCES Words(Id) ON DELETE CASCADE,
        GroupId INTEGER REFERENCES WordGroups(Id) ON DELETE SET NULL,
        Correct INTEGER DEFAULT 0,
        ViewedCount INTEGER DEFAULT 0,
        CorrectCount INTEGER DEFAULT 0,
        Mode TEXT DEFAULT 'flashcard',
        Timestamp TEXT DEFAULT (datetime('now'))
      );`);
    } else if (!columns.includes('Mode')) {
      db.run(`ALTER TABLE StudySessionsLSTM ADD COLUMN Mode TEXT DEFAULT 'flashcard';`);
    }
  } catch (err) {
    console.warn('Schema migration error:', err.message);
  }
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Save DB error:', e.message);
  }
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS WordGroups (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      Description TEXT DEFAULT '',
      Color TEXT DEFAULT '#4f46e5',
      Icon TEXT DEFAULT '📖',
      CreatedAt TEXT DEFAULT (datetime('now')),
      UpdatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS Words (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      GroupId INTEGER REFERENCES WordGroups(Id) ON DELETE CASCADE,
      English TEXT NOT NULL,
      Vietnamese TEXT NOT NULL,
      Pronunciation TEXT DEFAULT '',
      PartOfSpeech TEXT DEFAULT '',
      Example TEXT DEFAULT '',
      ExampleVi TEXT DEFAULT '',
      Level INTEGER DEFAULT 0,
      NextReview TEXT DEFAULT (datetime('now')),
      TotalReviews INTEGER DEFAULT 0,
      CorrectReviews INTEGER DEFAULT 0,
      CreatedAt TEXT DEFAULT (datetime('now')),
      UpdatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS StudySessionsLSTM (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      WordId INTEGER REFERENCES Words(Id) ON DELETE CASCADE,
      GroupId INTEGER REFERENCES WordGroups(Id) ON DELETE SET NULL,
      Correct INTEGER DEFAULT 0,
      ViewedCount INTEGER DEFAULT 0,
      CorrectCount INTEGER DEFAULT 0,
      Mode TEXT DEFAULT 'flashcard',
      Timestamp TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS StudySessions (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Mode TEXT NOT NULL,
      Score INTEGER DEFAULT 0,
      TotalWords INTEGER DEFAULT 0,
      CorrectWords INTEGER DEFAULT 0,
      DurationSeconds INTEGER DEFAULT 0,
      GroupIds TEXT DEFAULT '',
      CreatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS GameScores (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      GameType TEXT NOT NULL,
      Score INTEGER DEFAULT 0,
      Level INTEGER DEFAULT 1,
      WordsTyped INTEGER DEFAULT 0,
      Accuracy REAL DEFAULT 0,
      DurationSeconds INTEGER DEFAULT 0,
      CreatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS UserSettings (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SettingKey TEXT NOT NULL UNIQUE,
      SettingValue TEXT DEFAULT '',
      UpdatedAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS DailyGoals (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      GoalDate TEXT DEFAULT (date('now')),
      TargetWords INTEGER DEFAULT 20,
      ReviewedWords INTEGER DEFAULT 0,
      IsCompleted INTEGER DEFAULT 0
    );
  `);
}

// Convert sql.js result to array of objects
function resultToObjects(res) {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('db-connect', () => ({ success: !!db, error: db ? undefined : 'Database not ready' }));
ipcMain.handle('db-status', () => ({ connected: !!db }));
ipcMain.handle('db-get-path', () => DB_PATH);

ipcMain.handle('db-query', (event, query, params = []) => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    
    const sql = query.trim().toUpperCase();
    const isSelect = sql.startsWith('SELECT') || sql.startsWith('PRAGMA') || sql.startsWith('WITH');
    
    if (isSelect) {
      const res = db.exec(query, params);
      return { success: true, data: resultToObjects(res), rowsAffected: [0] };
    } else {
      db.run(query, params);
      const changes = db.getRowsModified();
      const lastId = db.exec('SELECT last_insert_rowid() as id');
      const lastInsertId = lastId.length > 0 ? lastId[0].values[0][0] : null;
      
      // For INSERT, return the inserted row
      if (sql.startsWith('INSERT') && lastInsertId) {
        const table = query.match(/INTO\s+(\w+)/i)?.[1];
        if (table) {
          const row = db.exec(`SELECT * FROM ${table} WHERE Id = ?`, [lastInsertId]);
          saveDb();
          return { success: true, data: resultToObjects(row), rowsAffected: [changes] };
        }
      }
      
      saveDb();
      return { success: true, data: [], rowsAffected: [changes] };
    }
  } catch (err) {
    console.error('DB Error:', err.message, '\nQuery:', query.substring(0, 100));
    return { success: false, error: err.message };
  }
});
