import { test, expect } from '@jest/globals';
import { FrameProcessor, defaultFrameProcessorOptions } from '@ricky0123/vad-web/dist/frame-processor';
import { Message } from '@ricky0123/vad-web/dist/messages';
import { SILENCE_VAD_OPTIONS } from './localVad';

async function detector() {
  let probability = 0;
  let endings = 0;
  const processor = new FrameProcessor(async () => ({ isSpeech: probability, notSpeech: 1 - probability }), () => {}, { ...defaultFrameProcessorOptions, ...SILENCE_VAD_OPTIONS }, 32);
  processor.resume();
  return {
    feed: async (speech: boolean, frames: number) => {
      probability = speech ? 0.99 : 0.01;
      for (let i = 0; i < frames; i++) await processor.process(new Float32Array(512), event => { if (event.msg === Message.SpeechEnd) endings++; });
    },
    endings: () => endings,
  };
}

test('waits for speech and ends after approximately 1.5 seconds of silence', async () => {
  expect(SILENCE_VAD_OPTIONS.redemptionMs).toBe(1500);
  const vad = await detector();
  await vad.feed(false, 100);
  expect(vad.endings()).toBe(0);
  await vad.feed(true, 20);
  await vad.feed(false, 45);
  expect(vad.endings()).toBe(0);
  await vad.feed(false, 2);
  expect(vad.endings()).toBe(1);
});

test('a short thinking pause resets when speech resumes', async () => {
  const vad = await detector();
  await vad.feed(true, 20);
  await vad.feed(false, 40);
  await vad.feed(true, 20);
  await vad.feed(false, 40);
  expect(vad.endings()).toBe(0);
  await vad.feed(false, 7);
  expect(vad.endings()).toBe(1);
});
