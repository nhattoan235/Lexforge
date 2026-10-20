const fs = require('node:fs');
const path = require('node:path');
const destination = path.join(__dirname, '..', 'public', 'vad');
fs.mkdirSync(destination, { recursive: true });
const vad = path.dirname(require.resolve('@ricky0123/vad-web'));
const ort = path.dirname(require.resolve('onnxruntime-web/wasm'));
for (const [directory, files] of [
  [vad, ['silero_vad_v5.onnx', 'vad.worklet.bundle.min.js']],
  [ort, ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']],
]) {
  for (const file of files) fs.copyFileSync(path.join(directory, file), path.join(destination, file));
}
console.log('Local VAD assets ready.');
