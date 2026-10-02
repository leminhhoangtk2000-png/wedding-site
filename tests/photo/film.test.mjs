import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DEFAULT_PRESETS, V1_PRESETS, V2_PRESETS, FILM_STOCK_PRESETS, LEGACY_PRESETS, defaultAdjustments, computeEffectiveFilter, transformPixels, validatePresets, canonicalFilter, FRAMES } from '../../src/lib/photo/film.mjs';
import { renderPrintPhoto } from '../../src/lib/photo/image.mjs';
const pixels=()=>new Uint8ClampedArray([246,246,246,255,186,124,94,255,40,65,110,255,15,16,18,255]);

test('zero color intensity is identity; monochrome stays neutral at every intensity',()=>{
  for(const p of DEFAULT_PRESETS) {
    const data=pixels();transformPixels(data,4,1,computeEffectiveFilter(p,{intensity:0,brightness:0,warmth:0}),42);
    if(!p.monochrome)assert.deepEqual(data,pixels());
    else for(const intensity of [0,30,100]) {
      const mono=pixels();transformPixels(mono,4,1,computeEffectiveFilter(p,{intensity,brightness:20,warmth:50}),42);
      for(let i=0;i<mono.length;i+=4){assert.equal(mono[i],mono[i+1]);assert.equal(mono[i],mono[i+2]);}
    }
  }
});
test('grain is reproducible, shadows suppress grain, white highlights resist amber tint',()=>{
  const golden=DEFAULT_PRESETS.find(p=>p.id==='golden_memory');
  const f=computeEffectiveFilter(golden,defaultAdjustments(golden));
  const one=pixels(),two=pixels();transformPixels(one,4,1,f,123);transformPixels(two,4,1,f,123);assert.deepEqual(one,two);
  assert.ok(Math.abs(one[0]-one[2])<=1,'neutral white must not become yellow');
  const dark=new Uint8ClampedArray([5,5,5,255]),noGrain=dark.slice();
  transformPixels(dark,1,1,{...f,grain:50},123);transformPixels(noGrain,1,1,{...f,grain:0},123);assert.deepEqual(dark,noGrain);
  const signatures=DEFAULT_PRESETS.map(p=>{const d=pixels();transformPixels(d,4,1,computeEffectiveFilter(p,defaultAdjustments(p)),99);return String(d);});
  assert.equal(new Set(signatures).size,DEFAULT_PRESETS.length,'looks must be visibly distinct on skin/color swatches');
});
test('preset validation prevents profile injection, invalid ranges, disabled defaults and forged computed values',()=>{
  const cloned=structuredClone(DEFAULT_PRESETS);cloned[1].profile='invented';
  assert.equal(validatePresets(cloned)[1].profile,'astia_v2');
  for(const change of [p=>p[0].settings.grain=999,p=>p[1].enabled=false,p=>p[2].isDefault=true,p=>p[0].settings.brightness=1,p=>p[0].enabled=false]){
    const bad=structuredClone(DEFAULT_PRESETS);change(bad);assert.throws(()=>validatePresets(bad),/INVALID_FILTER/);
  }
  assert.deepEqual(canonicalFilter({preset_id:'soft_wedding',config_version:1,adjustments:{intensity:70,brightness:0,warmth:0},computed:{brightness:50}}),{preset_id:'soft_wedding',config_version:1,adjustments:{intensity:70,brightness:0,warmth:0}});
  assert.ok(LEGACY_PRESETS.some(p=>p.id==='warm_film'));
});
test('framed print uses the shared transform and preserves floral pixels across presets',async()=>{
  for(const orientation of ['portrait','landscape']) {
    const f=FRAMES[orientation],w=orientation==='portrait'?1000:1480,h=orientation==='portrait'?1480:1000;
    const input=await sharp({create:{width:w,height:h,channels:3,background:'#ba7c5e'}}).png().toBuffer();
    const crop={x:0,y:0,width:1,height:1};
    const prints=[];
    for(const p of DEFAULT_PRESETS.filter(p=>['natural','soft_wedding','timeless_bw',...FILM_STOCK_PRESETS.map(stock=>stock.id)].includes(p.id))) {
      const computed=computeEffectiveFilter(p,defaultAdjustments(p));
      const jpeg=await renderPrintPhoto(input,crop,orientation,w,h,{computed,seed:99});
      const meta=await sharp(jpeg).metadata();assert.equal(meta.width,f.width);assert.equal(meta.height,f.height);assert.equal(meta.density,300);
      const border=await sharp(jpeg).extract({left:0,top:0,width:f.width,height:100}).raw().toBuffer();prints.push(border);
      const center=await sharp(jpeg).extract({left:f.left+Math.floor(f.photoWidth/2),top:f.top+Math.floor(f.photoHeight/2),width:1,height:1}).raw().toBuffer();
      const expected=new Uint8ClampedArray([186,124,94,255]);transformPixels(expected,1,1,{...computed,grain:0},99);
      for(let c=0;c<3;c++)assert.ok(Math.abs(center[c]-expected[c])<=4,`browser/server color difference: ${center} vs ${expected}`);
    }
    assert.deepEqual(prints[0],prints[1]);assert.deepEqual(prints[1],prints[2]);
  }
});
test('versioned config keeps history, blocks anonymous use, and protects stale admin edits',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
    for(const file of ['20261002_photo_printing.sql','20261002_photo_film_presets.sql'])await pg.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
    const cmd=async(action,payload={})=>(await pg.query('select photo_print_film_command($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
    const historical=await cmd('preset_config');assert.deepEqual(historical.presets,V1_PRESETS);
    await pg.exec(await readFile(new URL('../../supabase/migrations/20261002_photo_film_looks_v2.sql',import.meta.url),'utf8'));
    const previous=await cmd('preset_config');assert.deepEqual(previous.presets,V2_PRESETS);
    await pg.exec(await readFile(new URL('../../supabase/migrations/20261002_photo_film_stocks_v3.sql',import.meta.url),'utf8'));
    const first=await cmd('preset_config');assert.deepEqual(first.presets,DEFAULT_PRESETS);assert.equal(first.version,3);
    assert.deepEqual(await cmd('preset_config',{version:2}),previous);
    assert.deepEqual(await cmd('preset_config',{version:1}),historical);
    const next=structuredClone(first.presets);next[1].settings.brightness=10;
    const payload={presets:next,expected_version:3,operation_key:randomUUID()};
    assert.equal((await cmd('save_presets',payload)).version,4);
    assert.equal((await cmd('save_presets',payload)).version,4);
    assert.deepEqual(await cmd('preset_config',{version:3}),first);
    await assert.rejects(cmd('save_presets',{...payload,operation_key:randomUUID()}),/CONFIG_STALE/);
    await pg.exec(await readFile(new URL('../../supabase/migrations/20261002_remove_photo_quota_limit.sql',import.meta.url),'utf8'));
    assert.equal((await cmd('preset_config')).version,4);
    await pg.exec('set role anon');
    await assert.rejects(cmd('preset_config'),/permission denied/);
    await assert.rejects(pg.query('select * from photo_print_preset_versions'),/permission denied/);
  }finally{await pg.close();}
});

test('revised color presets have meaningful separation at default guest strengths',()=>{
  // Skin, blue decor, foliage, amber lighting and neutral midtone: avoid mere uniqueness.
  const source=new Uint8ClampedArray([186,124,94,255,40,65,110,255,60,125,70,255,160,120,65,255,100,100,100,255]);
  const looks=V2_PRESETS.filter(p=>!p.monochrome&&p.id!=='natural').map(p=>{
    const data=source.slice();transformPixels(data,5,1,{...computeEffectiveFilter(p),grain:0});return {p,data};
  });
  for(let i=0;i<looks.length;i++)for(let j=i+1;j<looks.length;j++){
    let difference=0;for(let c=0;c<source.length;c++)if(c%4!==3)difference+=Math.abs(looks[i].data[c]-looks[j].data[c]);
    assert.ok(difference/15>=6,`${looks[i].p.id} and ${looks[j].p.id} are too similar`);
  }
  for(const {p} of looks){
    const whites=new Uint8ClampedArray([235,235,235,255,246,246,246,255,255,255,255,255]);
    transformPixels(whites,3,1,{...computeEffectiveFilter(p),grain:0});
    for(let i=0;i<12;i+=4)assert.ok(Math.max(...whites.slice(i,i+3))-Math.min(...whites.slice(i,i+3))<=1,`${p.id} tints whites`);
    assert.ok(whites[0]<whites[4]&&whites[4]<whites[8],`${p.id} clips white detail`);
  }
});
test('catalog upgrade preserves operator settings, default selection and historical rendering',async()=>{
  const pg=new PGlite();
  try{
    await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
    for(const file of ['20261002_photo_printing.sql','20261002_photo_film_presets.sql'])await pg.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
    const custom=structuredClone(V1_PRESETS);custom[1].settings.brightness=17;custom[1].isDefault=false;custom[2].isDefault=true;custom[4].enabled=false;
    await pg.query('insert into photo_print_preset_versions(version,presets) values(2,$1)',[JSON.stringify(custom)]);
    const oldPixels=pixels();transformPixels(oldPixels,4,1,computeEffectiveFilter(custom[1]),42);
    await pg.exec(await readFile(new URL('../../supabase/migrations/20261002_photo_film_looks_v2.sql',import.meta.url),'utf8'));
    const rows=(await pg.query('select version,presets from photo_print_preset_versions order by version')).rows;
    assert.deepEqual(rows[1].presets,custom);assert.equal(rows[2].version,3);
    for(let i=0;i<custom.length;i++)for(const key of ['settings','enabled','isDefault','defaultIntensity'])assert.deepEqual(rows[2].presets[i][key],custom[i][key]);
    assert.equal(rows[2].presets[1].profile,'astia_v2');
    const restored=pixels();transformPixels(restored,4,1,computeEffectiveFilter(rows[1].presets[1]),42);assert.deepEqual(restored,oldPixels);
    await pg.exec(await readFile(new URL('../../supabase/migrations/20261002_photo_film_stocks_v3.sql',import.meta.url),'utf8'));
    const expanded=(await pg.query('select presets from photo_print_preset_versions where version=4')).rows[0].presets;
    assert.equal(expanded.length,12);assert.equal(expanded.filter(p=>p.isDefault).length,1);
    for(const p of rows[2].presets)assert.deepEqual(expanded.find(item=>item.id===p.id),p);
    for(const stock of FILM_STOCK_PRESETS)assert.deepEqual(expanded.find(item=>item.id===stock.id),stock);
    assert.deepEqual((await pg.query('select presets from photo_print_preset_versions where version=3')).rows[0].presets,rows[2].presets);
  }finally{await pg.close();}
});

test('expressive film stocks separate palettes, preserve highlights and restore original at zero',()=>{
  const source=new Uint8ClampedArray([186,124,94,255,40,65,110,255,60,125,70,255,160,120,65,255,100,100,100,255]);
  const results=FILM_STOCK_PRESETS.map(p=>{
    const data=source.slice();transformPixels(data,5,1,{...computeEffectiveFilter(p),grain:0});
    const zero=source.slice();transformPixels(zero,5,1,computeEffectiveFilter(p,{intensity:0,brightness:0,warmth:0}));assert.deepEqual(zero,source);
    const whites=new Uint8ClampedArray([235,235,235,255,246,246,246,255,255,255,255,255]);
    transformPixels(whites,3,1,{...computeEffectiveFilter(p),grain:0});
    for(let i=0;i<12;i+=4)assert.ok(Math.max(...whites.slice(i,i+3))-Math.min(...whites.slice(i,i+3))<=1,`${p.id} tints white highlights`);
    assert.ok(whites[0]<whites[4]&&whites[4]<whites[8],`${p.id} loses white detail`);
    return data;
  });
  for(let i=0;i<results.length;i++)for(let j=i+1;j<results.length;j++){
    let difference=0;for(let c=0;c<source.length;c++)if(c%4!==3)difference+=Math.abs(results[i][c]-results[j][c]);
    assert.ok(difference/15>=18,`${FILM_STOCK_PRESETS[i].id} and ${FILM_STOCK_PRESETS[j].id} are too similar`);
  }
  const blue=4,green=8,gray=16;
  const velvia=results[0],retro=results[1],amber=results[2],bleach=results[3],sepia=results[4];
  assert.ok(velvia[green+1]-velvia[green]>source[green+1]-source[green],'Velvia should enrich greens');
  assert.ok(retro[green+2]>source[green+2]&&retro[green]<source[green],'Classic Neg should shift greens toward cyan');
  assert.ok(amber[0]>source[0]&&amber[blue]>source[blue],'Nostalgic should lift warm tones');
  assert.ok(Math.max(...bleach.slice(0,3))-Math.min(...bleach.slice(0,3))<30,'Bleach Bypass should strongly mute skin chroma');
  assert.ok(sepia[gray]>sepia[gray+1]&&sepia[gray+1]>sepia[gray+2],'Sepia should tone gray into brown');
});
