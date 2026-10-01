import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Browser adapters simulate decode/canvas failure, while testing the actual
// upload gate. No native camera behavior is inferred from this test.
const source = await readFile(new URL('../../src/components/photo/imageCompressor.js', import.meta.url), 'utf8');
const { processImageForUpload } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('client never uploads an oversized original or canvas result after compression failure', async () => {
  const previous = { Image: globalThis.Image, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  try {
    const large = new File([new Uint8Array(4 * 1024 * 1024)], 'photo.jpg', { type: 'image/jpeg' });
    globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror()); } };
    assert.equal((await processImageForUpload(large)).ok, false);

    globalThis.Image = class {
      naturalWidth = 4000;
      naturalHeight = 3000;
      set src(value) { queueMicrotask(() => this.onload()); }
    };
    globalThis.document = { createElement: () => ({
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob: callback => callback(new Blob([new Uint8Array(4 * 1024 * 1024)])),
    }) };
    assert.equal((await processImageForUpload(large)).ok, false);
    const heic = new File([new Uint8Array(4 * 1024 * 1024)], 'photo.heic', { type: 'image/heic' });
    assert.equal((await processImageForUpload(heic)).ok, false);
  } finally {
    globalThis.Image = previous.Image;
    globalThis.document = previous.document;
    URL.createObjectURL = previous.create;
    URL.revokeObjectURL = previous.revoke;
  }
});
