import type { MicVAD } from '@ricky0123/vad-web';

export const SILENCE_VAD_OPTIONS = {
  redemptionMs: 1500,
  minSpeechMs: 400,
  submitUserSpeechOnPause: false,
};

export async function startLocalVad(stream: MediaStream, onSpeechEnd: () => void): Promise<MicVAD> {
  const { MicVAD } = await import('@ricky0123/vad-web');
  const assets = new URL(`${process.env.PUBLIC_URL}/vad/`, window.location.href).href;
  const detector = await MicVAD.new({
    ...SILENCE_VAD_OPTIONS,
    model: 'v5',
    baseAssetPath: assets,
    onnxWASMBasePath: assets,
    ortConfig: ort => { ort.env.wasm.numThreads = 1; },
    getStream: async () => stream,
    pauseStream: async () => {},
    resumeStream: async () => stream,
    startOnLoad: false,
    onSpeechEnd,
  });
  try {
    await detector.start();
    return detector;
  } catch (error) {
    await detector.destroy();
    throw error;
  }
}
