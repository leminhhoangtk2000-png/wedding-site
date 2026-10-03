import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {safePrintLayout,preparePrintFile} from '../../tools/photo-print/prepare-print.mjs';

test('invalid postcard sizes and unsafe margin settings fail before printing',()=>{
  for(const margin of [0,2,9,NaN,'4']) assert.throws(()=>safePrintLayout(1181,1748,'portrait',margin));
  assert.throws(()=>safePrintLayout(1748,1181,'portrait'));
});

for(const orientation of ['portrait','landscape']) {
  test(`native Mac ${orientation} print preserves all frame edges inside cream safe area`,{skip:process.platform!=='darwin'},async()=>{
    const root=await mkdtemp(join(tmpdir(),'photo-safe-'));
    try {
      const width=orientation==='portrait'?1181:1748,height=orientation==='portrait'?1748:1181;
      const input=join(root,'original.jpg'),output=join(root,'print.jpg');
      const red=await sharp({create:{width:width-40,height:height-40,channels:3,background:'#ff0000'}}).png().toBuffer();
      await sharp({create:{width,height,channels:3,background:'#00ff00'}})
        .composite([{input:red,left:20,top:20}]).withMetadata({density:300}).jpeg({quality:100}).toFile(input);
      const original=await readFile(input);
      await preparePrintFile(input,output,orientation);
      assert.deepEqual(await readFile(input),original);
      const metadata=await sharp(output).metadata();
      assert.equal(metadata.width,width);assert.equal(metadata.height,height);assert.equal(metadata.density,300);
      const layout=safePrintLayout(width,height,orientation);
      const x=Math.floor((width-layout.innerWidth)/2),y=Math.floor((height-layout.innerHeight)/2);
      assert.ok(x>=Math.ceil(width*4/(orientation==='portrait'?100:148)));
      assert.ok(y>=Math.ceil(height*4/(orientation==='portrait'?148:100)));
      const pixel=async(left,top)=>[...await sharp(output).extract({left,top,width:1,height:1}).removeAlpha().raw().toBuffer()];
      for(const [left,top] of [[5,5],[width-6,5],[5,height-6],[width-6,height-6]]) {
        const p=await pixel(left,top);for(let i=0;i<3;i++)assert.ok(Math.abs(p[i]-[251,245,235][i])<=4);
      }
      for(const [left,top] of [[x+5,y+5],[x+layout.innerWidth-6,y+5],[x+5,y+layout.innerHeight-6],[x+layout.innerWidth-6,y+layout.innerHeight-6]]) {
        const p=await pixel(left,top);assert.ok(p[1]>220 && p[0]<35 && p[2]<35,'original edge marker must remain visible');
      }
    }finally{await rm(root,{recursive:true,force:true});}
  });
}
