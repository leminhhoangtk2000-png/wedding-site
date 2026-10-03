import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {startPolling} from '../../src/lib/photo/poll.mjs';
import {buildPhotoReleaseSQL} from '../../tools/photo-print/migrations.mjs';
import {command} from '../../src/lib/photo/server.js';

test('runtime admission is bounded across 100 callers, reads preserve quota, dashboard covers every page',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
    for(const file of ['20261002_photo_printing.sql','20261002_photo_film_presets.sql','20261002_remove_photo_quota_limit.sql','20261002180000_photo_admin_edit_safe.sql','20261003010000_photo_runtime.sql','20261003020000_photo_thumbnails.sql'])
      await pg.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
    const cmd=async(action,payload={})=>(await pg.query('select photo_print_runtime($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
    const acquired=await Promise.allSettled(Array.from({length:100},()=>cmd('processing_acquire',{job_key:randomUUID()})));
    const leases=acquired.filter(r=>r.status==='fulfilled').map(r=>r.value);
    assert.equal(leases.length,4); assert.equal(acquired.filter(r=>r.status==='rejected').length,96);
    await cmd('processing_release',{...leases[0],lease_token:randomUUID()});
    await assert.rejects(cmd('processing_acquire',{job_key:randomUUID()}),/PROCESSING_BUSY/);
    for(const lease of leases) await cmd('processing_release',lease);
    const stale=await cmd('processing_acquire',{job_key:randomUUID()});
    await pg.query("update photo_print_processing set expires_at=now()-interval '1 second'");
    const replacement=await cmd('processing_acquire',{job_key:stale.job_key});
    await cmd('processing_release',stale);
    assert.equal((await pg.query('select count(*)::int n from photo_print_processing')).rows[0].n,1);
    await cmd('processing_release',replacement);
    await pg.exec("insert into photo_print_processing_budget values(date_trunc('hour',now()),1200) on conflict(hour) do update set count=1200");
    await assert.rejects(cmd('processing_acquire',{job_key:randomUUID()}),/PROCESSING_LIMIT/);
    assert.equal((await cmd('read_session')).capacity,null);
    await pg.exec('update photo_print_session set capacity=100,reserved=100');
    assert.equal((await cmd('read_session')).remaining,0);
    for(let i=0;i<100;i++) await pg.query('insert into photo_print_requests(request_key,tracking_hash,fingerprint,guest_name,pickup_code,storage_path,orientation,status) values($1,\'t\',\'f\',$2,$3,\'print.jpg\',\'portrait\',$4)',[randomUUID(),`Guest ${i}`,`CODE${i}`,i<80?'pending':'ready']);
    const pages=await Promise.all([1,2,3,4].map(page=>cmd('dashboard',{page})));
    assert.equal(new Set(pages.flatMap(p=>p.requests.map(r=>r.id))).size,100);
    assert.equal(pages[0].counts.pending,80);assert.equal(pages[0].pagination.total,100);
    const filtered=await cmd('dashboard',{status:'ready',search:'Guest 9'});
    assert.equal(filtered.pagination.matched,10);assert.equal(filtered.counts.pending,80);
    assert.ok(filtered.requests.every(r=>r.status==='ready'));
    const target=pages[0].requests[0].id;
    const attempt=randomUUID();
    await pg.query("update photo_print_requests set status='claimed' where id=$1",[target]);
    await pg.query("insert into photo_print_attempts(id,request_id,operation_key,status,lease_until) values($1,$2,$3,'claimed',now()-interval '1 second')",[attempt,target,randomUUID()]);
    const tracking=await cmd('tracking',{id:target,tracking_hash:'t'});assert.equal(tracking.status,'review');
    assert.equal((await pg.query('select status from photo_print_requests where id=$1',[target])).rows[0].status,'claimed');
    assert.equal((await cmd('dashboard',{status:'review'})).counts.review,1);
    await assert.rejects(cmd('tracking',{id:target,tracking_hash:'invalid'}),/NOT_FOUND/);
    const single=await cmd('dashboard' ,{id:pages[3].requests[0].id});assert.equal(single.requests.length,1);
    await assert.rejects(cmd('dashboard',{status:'invalid'}),/INVALID_INPUT/);
    // Reapplying additive migrations must not recursively wrap the queue function.
    for(const file of ['20261003010000_photo_runtime.sql','20261003020000_photo_thumbnails.sql'])
      await pg.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
    await pg.query("select photo_print_command('pause','{}'::jsonb)");
  } finally {await pg.close();}
});

test('missing film RPC never returns invented saved settings or a snapshot-less fallback',async()=>{
  const actions=[];
  const client={rpc:async(name)=>{actions.push(name);return {error:{code:'PGRST202',message:'missing RPC'}};}};
  for(const action of ['preset_config','save_presets','create'])
    await assert.rejects(command(client,action,{filter_snapshot:{}}),e=>e.code==='DATABASE_UNAVAILABLE');
  assert.deepEqual(actions,Array(3).fill('photo_print_film_command'));
});

test('polling never overlaps, pauses hidden tabs, backs off errors and stops terminal status',async()=>{
  const callbacks=[],listeners=new Map();let pending, calls=0;
  const doc={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const timers=new Map();let id=0;
  const poll=startPolling(()=>{calls++;return new Promise((resolve,reject)=>{pending={resolve,reject};});},
    {document:doc,random:()=>0,setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});callbacks.push(ms);return id;},clearTimer:key=>timers.delete(key)});
  await poll.refresh(); assert.equal(calls,1);
  pending.reject(new Error('offline'));await new Promise(resolve=>setImmediate(resolve));assert.equal(callbacks.at(-1),10000);
  doc.hidden=true;listeners.get('visibilitychange')();assert.equal(timers.size,0);
  doc.hidden=false;listeners.get('visibilitychange')();assert.equal(calls,2);
  await poll.refresh();assert.equal(calls,2);
  pending.resolve(false);await new Promise(resolve=>setImmediate(resolve));assert.equal(timers.size,0);
  doc.hidden=false;listeners.get('visibilitychange')();assert.equal(calls,2);
  poll.stop();assert.equal(listeners.size,0);
});

test('release SQL upgrades an existing queue and is repeatable without changing saved presets',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
    await pg.exec(await readFile(new URL('../../supabase/migrations/20261002_photo_printing.sql',import.meta.url),'utf8'));
    await pg.exec("update photo_print_session set accepting=true,reserved=4");
    const sql=await buildPhotoReleaseSQL();await pg.exec(sql);
    assert.equal((await pg.query('select reserved from photo_print_session')).rows[0].reserved,4);
    assert.equal((await pg.query('select accepting from photo_print_session')).rows[0].accepting,true);
    assert.equal((await pg.query('select max(version) v from photo_print_preset_versions')).rows[0].v,3);
    await pg.exec("update photo_print_preset_versions set presets=jsonb_set(presets,'{1,settings,brightness}','19'::jsonb) where version=3");
    const snapshot=(await pg.query('select presets from photo_print_preset_versions where version=3')).rows[0].presets;
    await pg.exec(sql);
    assert.deepEqual((await pg.query('select presets from photo_print_preset_versions where version=3')).rows[0].presets,snapshot);
    assert.equal((await pg.query('select max(version) v from photo_print_preset_versions')).rows[0].v,3);
    await pg.query("select photo_print_command('pause','{}'::jsonb)");
  }finally{await pg.close();}
});
