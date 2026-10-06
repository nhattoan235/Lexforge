const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual IPC handler without starting Electron or touching another app.
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const applySource = source.slice(source.indexOf("ipcMain.handle('assistant:writing-apply'"),
  source.indexOf("ipcMain.handle('assistant:get-state'"));
const positionSource = source.slice(source.indexOf('function positionWritingWindow('),
  source.indexOf('function showWritingSuggestion('));

function setup() {
  const actions = [];
  let handler;
  const context = vm.createContext({
    ipcMain: { handle: (_name, callback) => { handler = callback; } },
    assertWritingSender: () => {}, assistantEnabled: true,
    writingDraft: { revision: 7, canApply: true },
    currentWritingTranslation: 'Hello.', currentWritingSuggestion: 'Hello.',
    pendingWritingApply: null, dismissedWritingRevision: null,
    setTimeout, clearTimeout,
    clearWritingSuggestion: () => actions.push('clear'),
    writingWindow: {
      isDestroyed: () => false,
      hide: () => actions.push('hide'),
      show: () => actions.push('show'),
      focus: () => actions.push('focus'),
    },
    writingMonitorProcess: { stdin: { write: (line) => {
      assert.equal(actions[0], 'hide', 'Popup must release focus before the native command');
      actions.push(JSON.parse(line));
    } } },
  });
  vm.runInContext(applySource + '\n' + positionSource, context);
  const complete = (result) => {
    const pending = context.pendingWritingApply;
    context.pendingWritingApply = null;
    pending.resolve(result);
  };
  return { context, actions, complete, apply: () => handler({}, 7, 'replaceTranslation', 'Hello.') };
}

test('successful insertion hides popup, sends once, and clears only after confirmation', async () => {
  const harness = setup();
  const pending = harness.apply();
  assert.equal(harness.actions.length, 2);
  assert.equal(harness.actions[1].text, 'Hello.');
  harness.complete({ success: true });
  assert.equal((await pending).success, true);
  assert.deepEqual(harness.actions.filter(a => typeof a === 'string'), ['hide', 'clear']);
});

test('failed insertion restores the same popup without clearing the draft', async () => {
  const harness = setup();
  const pending = harness.apply();
  harness.complete({ success: false, error: 'focus lost' });
  assert.equal((await pending).error, 'focus lost');
  assert.deepEqual(harness.actions.filter(a => typeof a === 'string'), ['hide', 'show', 'focus']);
  assert.equal(harness.context.currentWritingTranslation, 'Hello.');
});

test('height events and double clicks cannot show popup or send twice during insertion', async () => {
  const harness = setup();
  const pending = harness.apply();
  // Any unguarded positioning would require screen/window APIs absent from this fixture.
  harness.context.positionWritingWindow(300, 7);
  assert.equal((await harness.apply()).success, false);
  assert.equal(harness.actions.length, 2);
  harness.complete({ success: true });
  await pending;
});

test('disconnected native helper restores the popup and releases the pending operation', async () => {
  const harness = setup();
  harness.context.writingMonitorProcess.stdin.write = () => { throw new Error('closed'); };
  assert.equal((await harness.apply()).success, false);
  assert.equal(harness.context.pendingWritingApply, null);
  assert.deepEqual(harness.actions, ['hide', 'show', 'focus']);
});
