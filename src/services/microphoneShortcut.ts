export function registerMicrophoneShortcut(toggle: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const isM = event.code === 'KeyM' || event.key.toLowerCase() === 'm';
    if (!isM || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.repeat) return;
    event.preventDefault();
    toggle();
  };
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
