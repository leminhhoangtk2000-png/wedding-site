// Exercise the actual PATCH handler with Supabase HTTP + PostgreSQL + private storage fixtures.
// Avoid running a second Next compiler, which exhausted memory in the full API harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { renderPrintPhoto, editPrintPhoto } from '../../src/lib/photo/image.mjs';

const sourceURL = new URL('../../src/app/api/admin/printing/route.js', import.meta.url);
const routeSource = (await readFile(sourceURL, 'utf8'))
  .replace("'@/lib/photo/server'", JSON.stringify(new URL('../../src/lib/photo/server.js', import.meta.url).href))
  .replace("import { getPresetConfig } from '@/lib/photo/config-server';", 'const getPresetConfig = async () => ({});')
  .replace("'@/lib/photo/film.mjs'", JSON.stringify(new URL('../../src/lib/photo/film.mjs', import.meta.url).href))
  .replace("'@/lib/photo/print-storage'", JSON.stringify(new URL('../../src/lib/photo/print-storage.js', import.meta.url).href))
  .replace("'@/lib/photo/image.mjs'", JSON.stringify(new URL('../../src/lib/photo/image.mjs', import.meta.url).href));
const routeRoot = await mkdtemp(join(tmpdir(), 'wedding-admin-route-'));
await writeFile(join(routeRoot, 'route.mjs'), routeSource);
const { PATCH } = await import(pathToFileURL(join(routeRoot, 'route.mjs')).href);
await rm(routeRoot, {recursive:true,force:true});
const preview = process.argv.includes('--preview');

test('admin edits persist, retry exactly, reject stale/review writes and queue the saved image', async () => {
  const pg = new PGlite();
  const objects = new Map();
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
  for (const migration of ['20261002_photo_printing.sql','20261002_photo_film_presets.sql','20261002_remove_photo_quota_limit.sql','20261002180000_photo_admin_edit_safe.sql','20261003010000_photo_runtime.sql','20261003020000_photo_thumbnails.sql'])
    await pg.exec(await readFile(new URL('../../supabase/migrations/' + migration, import.meta.url), 'utf8'));
  await pg.exec(await readFile(new URL('../../supabase/migrations/20261002180000_photo_admin_edit_safe.sql',import.meta.url),'utf8'));
  const cmd = async (action, payload = {}) => (await pg.query('select photo_print_command($1,$2::jsonb) result', [action, JSON.stringify(payload)])).rows[0].result;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks), url = new URL(req.url, 'http://fixture');
    const json = (data, status = 200) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(data)); };
    try {
      if (['/rest/v1/rpc/photo_print_command','/rest/v1/rpc/photo_print_film_command'].includes(url.pathname)) {
        const body = JSON.parse(bytes);
        if (url.pathname.endsWith('photo_print_film_command')) return json((await pg.query('select photo_print_film_command($1,$2::jsonb) result',[body.p_action,JSON.stringify(body.p_payload)])).rows[0].result);
        return json(await cmd(body.p_action, body.p_payload));
      }
      if (url.pathname === '/rest/v1/photo_print_requests') {
        const id = url.searchParams.get('id').slice(3);
        return json((await pg.query('select * from photo_print_requests where id=$1', [id])).rows[0]);
      }
      if (url.pathname.startsWith('/storage/v1/object/sign/')) {
        const path = url.pathname.replace('/storage/v1/object/sign/photo_print_private/', '');
        if (req.method==='GET') { res.writeHead(200, {'Content-Type':'image/jpeg'}); return res.end(objects.get(path)); }
        return json({ signedURL: '/object/sign/photo_print_private/' + path + '?token=test' });
      }
      if (url.pathname === '/storage/v1/object/photo_print_private' && req.method === 'DELETE') {
        for (const path of JSON.parse(bytes).prefixes) objects.delete(path);
        return json([]);
      }
      const path = url.pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?photo_print_private\//, '');
      if (req.method === 'POST') { objects.set(path, bytes); return json({Key:path}); }
      if (!objects.has(path)) return json({error:'not found'},404);
      res.writeHead(200, {'Content-Type':'image/jpeg'}); res.end(objects.get(path));
    } catch (err) { json({message:err.message},400); }
  });
  server.listen(0, '127.0.0.1'); await once(server,'listening');
  const previous = {...process.env};
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  process.env.ADMIN_PASSWORD = 'fixture-admin';
  process.env.PHOTO_PRINT_HARDWARE_VERIFIED = 'true';
  const call = async (body, authorized = true) => {
    const response = await PATCH(new Request('http://local/api/admin/printing', {
      method:'PATCH', headers: {...(body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...(authorized ? {'x-admin-password':'fixture-admin'} : {})},
      body: body instanceof FormData ? body : JSON.stringify(body),
    }));
    return {status:response.status, data:await response.json()};
  };
  let next, previewRoot;
  try {
    await cmd('resume');
    const uid = randomUUID();
    await pg.query("insert into photo_print_uploads(id,token_hash,storage_path,width,height) values($1,'u','uploads/original.jpg',1000,1480)", [uid]);
    const bytes = await sharp({create:{width:1000,height:1480,channels:3,background:'#7799aa'}}).jpeg().toBuffer();
    const request = await cmd('create', {upload_id:uid,upload_hash:'u',request_key:randomUUID(),tracking_hash:'t',fingerprint:'f',guest_name:'Guest',orientation:'portrait',storage_path:'prints/original.jpg'});
    objects.set(request.storage_path, await renderPrintPhoto(bytes,{x:0,y:0,width:1,height:1},'portrait',1000,1480));
    const edit = {action:'edit',id:request.id,operation_key:randomUUID(),expected_revision:0,guest_name:'Edited',orientation:'landscape'};
    assert.equal((await call(edit,false)).status,401);
    for (const fallback of ['696969', 'etBM9eB71LTq2qE6jbnAFwgH6SjYckhE']) {
      const rejected = await PATCH(new Request('http://local/api/admin/printing', {
        method: 'PATCH', headers: {'Content-Type':'application/json','x-admin-password':fallback},
        body: JSON.stringify(edit),
      }));
      assert.equal(rejected.status,401,'Static fallback must never authorize a print mutation');
    }
    delete process.env.ADMIN_PASSWORD;
    assert.equal((await call(edit)).status,503,'Missing server password must fail closed');
    process.env.ADMIN_PASSWORD = 'fixture-admin';
    const saved = await call(edit); assert.equal(saved.status,200,JSON.stringify(saved));
    assert.equal(saved.data.request.guest_name,'Edited'); assert.equal(saved.data.request.edit_revision,1);
    assert.equal(saved.data.request.status,'pending'); assert.equal(saved.data.request.admin_image_edited,true);
    const meta = await sharp(objects.get(saved.data.request.storage_path)).metadata();
    assert.equal(meta.width,1748); assert.equal(meta.height,1181); assert.equal(meta.density,300);
    const count = objects.size;
    const retry = await call(edit); assert.equal(retry.status,200);
    assert.deepEqual(retry.data.request,saved.data.request); assert.equal(objects.size,count);
    assert.equal((await call({...edit,guest_name:'Different'})).data.code,'IDEMPOTENCY_CONFLICT');
    assert.equal((await call({...edit,operation_key:randomUUID()})).data.code,'STATE_CONFLICT');
    assert.equal((await call({...edit,operation_key:randomUUID(),expected_revision:1,adjustments:{brightness:'bad'}})).status,400);
    const replace = new FormData();
    for (const [key,value] of Object.entries({...edit,operation_key:randomUUID(),expected_revision:1,approve:true})) replace.set(key,String(value));
    replace.set('file',new Blob([bytes],{type:'image/jpeg'}),'replacement.jpg');
    replace.set('adjustments',JSON.stringify({brightness:10,monochrome:true}));
    process.env.PHOTO_PRINT_HARDWARE_VERIFIED='false';
    assert.equal((await call(replace)).data.code,'HARDWARE_NOT_VERIFIED');
    process.env.PHOTO_PRINT_HARDWARE_VERIFIED='true';
    const approved=await call(replace); assert.equal(approved.status,200,JSON.stringify(approved));
    assert.equal(approved.data.request.status,'approved'); assert.equal(approved.data.request.edit_revision,2);
    const afterApprove=objects.size;
    // Lost response retry remains valid even after hardware gate or request status changes.
    process.env.PHOTO_PRINT_HARDWARE_VERIFIED='false';
    assert.deepEqual((await call(replace)).data.request,approved.data.request); assert.equal(objects.size,afterApprove);
    assert.equal((await pg.query("select count(*)::int count from photo_print_attempts where request_id=$1",[request.id])).rows[0].count,1);
    const station=randomUUID(); await cmd('heartbeat',{station_id:station,printer:'test'});
    const claim=await cmd('claim',{station_id:station});
    assert.equal(claim.storage_path,approved.data.request.storage_path); assert.equal(claim.orientation,'landscape');
    await cmd('review',{station_id:station,attempt_id:claim.attempt_id,claim_token:claim.claim_token,error:'uncertain'});
    process.env.PHOTO_PRINT_HARDWARE_VERIFIED='true';
    assert.equal((await call({...edit,expected_revision:2,operation_key:randomUUID(),approve:true})).data.code,'STATE_CONFLICT');
    assert.equal((await pg.query('select count(*)::int count from photo_print_attempts where request_id=$1',[request.id])).rows[0].count,1);
    assert.deepEqual((await call(replace)).data.request,approved.data.request);
    for (const role of ['anon','authenticated']) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(cmd('edit_retry',edit),/permission denied/);
      await pg.exec('reset role');
    }
    if (!preview) {
      const second=await cmd('create',{upload_id:uid,upload_hash:'u',request_key:randomUUID(),tracking_hash:'t2',fingerprint:'f2',guest_name:'Concurrent',orientation:'portrait',storage_path:'prints/original.jpg'});
      const concurrent=await Promise.all(['Admin A','Admin B'].map(guest_name=>call({action:'edit',id:second.id,operation_key:randomUUID(),expected_revision:0,guest_name})));
      assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
      assert.equal((await pg.query('select edit_revision from photo_print_requests where id=$1',[second.id])).rows[0].edit_revision,1);
      // Existing queue commands must still work after adding operation metadata columns.
      const key=randomUUID(); await cmd('approve',{id:second.id,operation_key:key}); await cmd('approve',{id:second.id,operation_key:key});
      assert.equal((await pg.query('select count(*)::int count from photo_print_attempts where request_id=$1',[second.id])).rows[0].count,1);
      await cmd('reject',{id:second.id,operation_key:randomUUID()});
    }
    if (preview) {
      // Only reset the isolated fixture so the browser can edit the same request.
      await pg.query('delete from photo_print_attempts where request_id=$1',[request.id]);
      await pg.query("update photo_print_requests set status='pending' where id=$1",[request.id]);
      previewRoot=await mkdtemp(join(tmpdir(),'wedding-admin-preview-'));
      for (const name of ['src','public']) await cp(new URL('../../'+name,import.meta.url),join(previewRoot,name),{recursive:true});
      for (const name of ['package.json','jsconfig.json','next.config.mjs']) await cp(new URL('../../'+name,import.meta.url),join(previewRoot,name));
      await symlink(fileURLToPath(new URL('../../node_modules',import.meta.url)),join(previewRoot,'node_modules'));
      next=spawn(process.execPath,[join(process.cwd(),'node_modules/next/dist/bin/next'),'dev','--webpack','--port','3012'],{cwd:previewRoot,env:{...process.env},stdio:['ignore','pipe','pipe']});
      next.stdout.on('data',b=>process.stdout.write(b));next.stderr.on('data',b=>process.stderr.write(b));
      console.log('Admin preview: http://localhost:3012/admin/printing ; fixture-admin');
      await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});
    }
  } finally {
    if (next) { next.kill('SIGTERM'); await once(next,'exit'); }
    if (previewRoot) await rm(previewRoot,{recursive:true,force:true});
    for (const key of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_PASSWORD','PHOTO_PRINT_HARDWARE_VERIFIED']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key]=previous[key];
    }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await pg.close();
  }
});


test('editing a legacy unframed print preserves content near the original top edge', async () => {
  const stripe=await sharp({create:{width:1000,height:100,channels:3,background:'#ff0000'}}).png().toBuffer();
  const original=await sharp({create:{width:1000,height:1480,channels:3,background:'#0000ff'}}).composite([{input:stripe,left:0,top:0}]).jpeg().toBuffer();
  const edited=await editPrintPhoto({existingPrintBytes:original,existingOrientation:'portrait',existingFramed:false,targetOrientation:'portrait',adjustments:{brightness:1}});
  const pixel=await sharp(edited).extract({left:590,top:290,width:1,height:1}).removeAlpha().raw().toBuffer();
  assert.ok(pixel[0]>200 && pixel[2]<50, 'Top-edge red content must survive, instead of extracting a frame region from an unframed photo');
});
