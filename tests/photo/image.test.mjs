import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { normalizePhoto,renderPrintPhoto,validateCrop } from '../../src/lib/photo/image.mjs';
test('EXIF rotation is normalized and portrait/landscape output matches preview',async()=>{
  const input=await sharp({create:{width:1480,height:1000,channels:3,background:'#ff0000'}}).withMetadata({orientation:6}).jpeg().toBuffer();
  const normalized=await normalizePhoto(input);assert.equal(normalized.width,1000);assert.equal(normalized.height,1480);
  const image=await renderPrintPhoto(normalized.bytes,{x:0,y:0,width:1,height:1},'portrait',1000,1480);
  const meta=await sharp(image).metadata();assert.equal(meta.width,1181);assert.equal(meta.height,1748);assert.equal(meta.density,300);
  assert.throws(()=>validateCrop({x:0,y:0,width:1,height:1},'landscape',1000,1480),/INVALID_CROP/);
});
test('reject out of bounds, invalid aspect and disguised non-image input',async()=>{
  for(const crop of [{x:-1,y:0,width:1,height:1},{x:0,y:0,width:NaN,height:1},{x:.8,y:0,width:.3,height:1},{x:0,y:0,width:1,height:.5}])assert.throws(()=>validateCrop(crop,'portrait',1000,1480),/INVALID_CROP/);
  await assert.rejects(normalizePhoto(Buffer.from('<svg><script>bad</script></svg>')),/INVALID_IMAGE/);
});
