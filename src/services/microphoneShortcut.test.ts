import { test, expect, jest, afterEach } from '@jest/globals';
import { registerMicrophoneShortcut } from './microphoneShortcut';

let cleanup = () => {};
afterEach(() => { cleanup(); document.body.innerHTML = ''; });

test('recognizes Ctrl Shift M even when the keyboard does not supply code', () => {
  const toggle = jest.fn();
  cleanup = registerMicrophoneShortcut(toggle);
  window.dispatchEvent(new KeyboardEvent('keydown', {key:'M',ctrlKey:true,shiftKey:true}));
  expect(toggle).toHaveBeenCalledTimes(1);
});

test('receives the shortcut before an input stops event propagation', () => {
  const toggle = jest.fn();
  cleanup = registerMicrophoneShortcut(toggle);
  const input = document.createElement('textarea'); document.body.append(input);
  input.addEventListener('keydown', event => event.stopPropagation());
  input.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyM',key:'M',ctrlKey:true,shiftKey:true,bubbles:true}));
  expect(toggle).toHaveBeenCalledTimes(1);
});

test('ignores repeated presses and other modifier combinations and removes its listener', () => {
  const toggle = jest.fn(); cleanup = registerMicrophoneShortcut(toggle);
  for (const modifiers of [{repeat:true},{altKey:true},{metaKey:true},{shiftKey:false}]) {
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyM',key:'M',ctrlKey:true,shiftKey:true,...modifiers}));
  }
  expect(toggle).not.toHaveBeenCalled();
  cleanup();
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyM',ctrlKey:true,shiftKey:true}));
  expect(toggle).not.toHaveBeenCalled();
});


test('explicit Ctrl Shift M still works while an IME is composing', () => {
  const toggle = jest.fn(); cleanup = registerMicrophoneShortcut(toggle);
  window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyM',key:'M',ctrlKey:true,shiftKey:true,isComposing:true}));
  expect(toggle).toHaveBeenCalledTimes(1);
});
